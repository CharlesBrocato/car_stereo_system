"""
CarPlay Module
Manages FastCarPlay engine for Apple CarPlay and Android Auto receiver functionality
Works with Carlinkit/CPC200-CCPM USB dongles
"""

import subprocess
import os
import signal
import time
import threading
from pathlib import Path


class CarPlayManager:
    """Manager class for FastCarPlay integration with Flask backend"""
    
    def __init__(self):
        self.is_running = False
        self.carplay_process = None
        self.process_lock = threading.Lock()
        
        # Paths - relative to project root
        self.project_root = Path(__file__).parent.parent
        self.engine_dir = self.project_root / 'carplay_engine'
        self.executable_path = self.engine_dir / 'out' / 'app'
        self.settings_path = self.engine_dir / 'conf' / 'settings.txt'
        self.pipe_path = '/tmp/fastcarplay_pipe'
        
        # Status tracking
        self.last_status = 'stopped'
        self.connected_device = None
        self.error_message = None
        
    def is_built(self):
        """Check if FastCarPlay has been compiled"""
        return self.executable_path.exists()
    
    def is_dongle_connected(self):
        """Check if a CarPlay dongle is connected via USB"""
        try:
            result = subprocess.run(
                ['lsusb'],
                capture_output=True,
                text=True,
                timeout=5
            )
            # Check for common Carlinkit vendor IDs
            # 1314:1520 is common, but there are variants
            dongle_ids = ['1314:', '1234:', '154b:']
            for dongle_id in dongle_ids:
                if dongle_id in result.stdout:
                    return True
            return False
        except Exception as e:
            print(f"[CarPlay] USB check error: {e}")
            return False
    
    def get_status(self):
        """Get current CarPlay status"""
        return {
            'running': self.is_running,
            'built': self.is_built(),
            'status': self.last_status,
            'connected_device': self.connected_device,
            'dongle_detected': self.is_dongle_connected(),
            'error': self.error_message,
            'executable_path': str(self.executable_path),
            'settings_path': str(self.settings_path)
        }
    
    def start(self, fullscreen=True, width=800, height=480):
        """Start the FastCarPlay engine"""
        with self.process_lock:
            try:
                if self.is_running:
                    return {
                        'success': True, 
                        'message': 'CarPlay already running',
                        'status': self.get_status()
                    }
                
                if not self.is_built():
                    return {
                        'success': False,
                        'message': 'FastCarPlay not built. Run build script first.',
                        'status': self.get_status()
                    }
                
                # Ensure settings directory exists
                settings_dir = self.settings_path.parent
                settings_dir.mkdir(parents=True, exist_ok=True)
                
                # Create/update settings file for touchscreen
                self._write_settings(fullscreen, width, height)
                
                # Set environment for display
                env = os.environ.copy()
                if 'DISPLAY' not in env:
                    env['DISPLAY'] = ':0'
                
                # Start FastCarPlay process
                cmd = [str(self.executable_path)]
                if self.settings_path.exists():
                    cmd.append(str(self.settings_path))
                
                self.carplay_process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    env=env,
                    cwd=str(self.engine_dir)
                )
                
                # Give it time to initialize
                time.sleep(0.5)
                
                # Check if process is still running
                if self.carplay_process.poll() is None:
                    self.is_running = True
                    self.last_status = 'running'
                    self.error_message = None
                    
                    # Start output monitoring thread
                    threading.Thread(
                        target=self._monitor_output, 
                        daemon=True
                    ).start()
                    
                    return {
                        'success': True,
                        'message': 'CarPlay started successfully',
                        'status': self.get_status()
                    }
                else:
                    # Process died immediately
                    stdout, stderr = self.carplay_process.communicate()
                    self.error_message = stderr.decode() if stderr else 'Process terminated unexpectedly'
                    return {
                        'success': False,
                        'message': f'CarPlay failed to start: {self.error_message}',
                        'status': self.get_status()
                    }
                    
            except FileNotFoundError:
                self.error_message = 'FastCarPlay executable not found'
                return {
                    'success': False,
                    'message': self.error_message,
                    'status': self.get_status()
                }
            except Exception as e:
                self.error_message = str(e)
                print(f"[CarPlay] Start error: {e}")
                return {
                    'success': False,
                    'message': str(e),
                    'status': self.get_status()
                }
    
    def stop(self):
        """Stop the FastCarPlay engine"""
        with self.process_lock:
            try:
                if not self.is_running or not self.carplay_process:
                    self.is_running = False
                    self.last_status = 'stopped'
                    return {
                        'success': True,
                        'message': 'CarPlay was not running',
                        'status': self.get_status()
                    }
                
                # Send SIGTERM for graceful shutdown
                self.carplay_process.terminate()
                
                # Wait up to 3 seconds for graceful shutdown
                try:
                    self.carplay_process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    # Force kill if not responding
                    self.carplay_process.kill()
                    self.carplay_process.wait()
                
                self.carplay_process = None
                self.is_running = False
                self.last_status = 'stopped'
                self.connected_device = None
                self.error_message = None
                
                return {
                    'success': True,
                    'message': 'CarPlay stopped successfully',
                    'status': self.get_status()
                }
                
            except Exception as e:
                print(f"[CarPlay] Stop error: {e}")
                self.is_running = False
                self.last_status = 'stopped'
                return {
                    'success': True,
                    'message': 'CarPlay stopped',
                    'status': self.get_status()
                }
    
    def send_key(self, key_code):
        """Send a key command to FastCarPlay via named pipe"""
        try:
            if not os.path.exists(self.pipe_path):
                return {'success': False, 'message': 'Key pipe not available'}
            
            # Key codes from FastCarPlay protocol
            key_map = {
                'left': 100,
                'right': 101,
                'select_down': 104,
                'select_up': 105,
                'select': 104,  # Will send both down and up
                'back': 106,
                'home': 200
            }
            
            code = key_map.get(key_code.lower())
            if code is None:
                return {'success': False, 'message': f'Unknown key: {key_code}'}
            
            with open(self.pipe_path, 'wb') as pipe:
                pipe.write(bytes([code]))
                if key_code.lower() == 'select':
                    pipe.write(bytes([105]))  # Also send select_up
            
            return {'success': True, 'message': f'Key {key_code} sent'}
            
        except Exception as e:
            return {'success': False, 'message': str(e)}
    
    def _write_settings(self, fullscreen=True, width=800, height=480):
        """Write optimized settings for Raspberry Pi touchscreen"""
        settings = f"""# FastCarPlay Settings - Auto-generated for Car Stereo System
# Raspberry Pi 5 with 7" Touchscreen Configuration

# Display settings for 7" touchscreen (800x480)
width = {width}
height = {height}
source-fps = 30
fps = 30
fullscreen = {'true' if fullscreen else 'false'}
cursor = false

# Dongle settings (adjust vendor/product ID if needed)
# Use lsusb to find your dongle's ID
# vendor-id = 4884
# product-id = 5408

# Enable encryption for newer dongles
encryption = false

# Connection settings
autoconnect = true
weak-charge = true
left-hand-drive = true
night-mode = 2

# WiFi settings
wifi-5 = true
bluetooth-audio = false
mic-type = 1

# Android Auto settings
android-dpi = 140
android-resolution = 1
android-media-delay = 300

# Performance settings for Pi 5
font-size = 24
vsync = false
hw-decode = true
fast-render-scale = true
video-buffer-size = 32
audio-buffer-size = 32
audio-buffer-wait = 2
audio-buffer-wait-call = 8
audio-fade = 0.3

# Audio driver (pipewire recommended for Pi 5)
# audio-driver = pipewire

# Named pipe for key commands from Flask
key-pipe-path = {self.pipe_path}

# Enable logging for debugging (disable in production)
logging = false
"""
        # Ensure directory exists
        self.settings_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.settings_path, 'w') as f:
            f.write(settings)
    
    def _monitor_output(self):
        """Monitor FastCarPlay stdout for status updates"""
        try:
            while self.is_running and self.carplay_process:
                if self.carplay_process.poll() is not None:
                    # Process has ended
                    self.is_running = False
                    self.last_status = 'stopped'
                    break
                    
                line = self.carplay_process.stdout.readline()
                if line:
                    decoded = line.decode().strip()
                    print(f"[CarPlay] {decoded}")
                    
                    # Parse status from output
                    if 'Connected' in decoded:
                        self.last_status = 'connected'
                        self.connected_device = 'CarPlay/Android Auto'
                    elif 'Disconnected' in decoded:
                        self.last_status = 'waiting'
                        self.connected_device = None
                    elif 'Error' in decoded:
                        self.error_message = decoded
                        
        except Exception as e:
            print(f"[CarPlay] Monitor error: {e}")
    
    def is_active(self):
        """Check if CarPlay is currently active"""
        return self.is_running
    
    def restart(self):
        """Restart the CarPlay engine"""
        self.stop()
        time.sleep(1)
        return self.start()

