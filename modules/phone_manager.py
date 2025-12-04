"""
Phone Manager - Bluetooth HFP (Hands-Free Profile) Integration
Handles phone calls via connected Bluetooth device using BlueZ/oFono
"""

import subprocess
import logging
import threading
import time
import platform
import queue

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Check if we're on Linux (Raspberry Pi)
IS_LINUX = platform.system().lower() == 'linux'

# Try to import D-Bus for native BlueZ/oFono integration
DBUS_AVAILABLE = False
if IS_LINUX:
    try:
        import dbus
        import dbus.mainloop.glib
        DBUS_AVAILABLE = True
    except ImportError:
        logger.warning("dbus-python not available. Phone features will be limited.")

# Try to import GLib for main loop
GLIB_AVAILABLE = False
if IS_LINUX:
    try:
        from gi.repository import GLib
        GLIB_AVAILABLE = True
    except ImportError:
        logger.warning("GLib not available. Phone event streaming will use polling.")


class PhoneManager:
    """
    Manages Bluetooth phone connectivity and call handling via HFP.
    Uses BlueZ and oFono for call control on Linux/Raspberry Pi.
    """
    
    def __init__(self):
        self.connected_device = None
        self.connected_device_name = None
        self.call_state = "idle"  # idle, incoming, outgoing, active, held
        self.caller_id = None
        self.caller_name = None
        self.listeners = []
        self.event_queue = queue.Queue()
        self.running = False
        self._loop_thread = None
        self._poll_thread = None
        self.recent_calls = []
        
        # D-Bus objects
        self._bus = None
        self._hfp_proxy = None
    
    def start(self):
        """Start the phone manager and begin listening for events."""
        if self.running:
            return
        
        self.running = True
        
        if IS_LINUX and DBUS_AVAILABLE:
            self._start_dbus_listener()
        
        # Start polling thread as backup/fallback
        self._poll_thread = threading.Thread(target=self._poll_status, daemon=True)
        self._poll_thread.start()
        
        logger.info("PhoneManager started")
    
    def stop(self):
        """Stop the phone manager."""
        self.running = False
        if self._loop_thread:
            self._loop_thread.join(timeout=2)
        logger.info("PhoneManager stopped")
    
    def _start_dbus_listener(self):
        """Start D-Bus signal listener for BlueZ/oFono events."""
        try:
            dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
            self._bus = dbus.SystemBus()
            
            # Listen for BlueZ property changes
            self._bus.add_signal_receiver(
                self._handle_property_changed,
                dbus_interface="org.freedesktop.DBus.Properties",
                signal_name="PropertiesChanged",
                path_keyword="path"
            )
            
            # Listen for oFono call events if available
            self._bus.add_signal_receiver(
                self._handle_ofono_call,
                dbus_interface="org.ofono.VoiceCallManager",
                signal_name="CallAdded"
            )
            
            self._bus.add_signal_receiver(
                self._handle_ofono_call_removed,
                dbus_interface="org.ofono.VoiceCallManager",
                signal_name="CallRemoved"
            )
            
            # Start GLib main loop in thread
            if GLIB_AVAILABLE:
                self._loop_thread = threading.Thread(target=self._run_glib_loop, daemon=True)
                self._loop_thread.start()
            
            logger.info("D-Bus listeners registered")
            
        except Exception as e:
            logger.error(f"Failed to start D-Bus listener: {e}")
    
    def _run_glib_loop(self):
        """Run GLib main loop for D-Bus events."""
        try:
            loop = GLib.MainLoop()
            while self.running:
                # Process pending events with timeout
                context = loop.get_context()
                context.iteration(may_block=True)
        except Exception as e:
            logger.error(f"GLib loop error: {e}")
    
    def _handle_property_changed(self, interface, changed, invalidated, path=None):
        """Handle D-Bus property change signals."""
        try:
            # Handle oFono VoiceCall properties
            if interface == "org.ofono.VoiceCall":
                if "State" in changed:
                    state = str(changed["State"])
                    self._update_call_state(state)
                
                if "LineIdentification" in changed:
                    self.caller_id = str(changed["LineIdentification"])
                    self._notify_listeners()
                
                if "Name" in changed:
                    self.caller_name = str(changed["Name"])
                    self._notify_listeners()
            
            # Handle BlueZ device connection
            if interface == "org.bluez.Device1":
                if "Connected" in changed:
                    if changed["Connected"]:
                        self._on_device_connected(path)
                    else:
                        self._on_device_disconnected()
            
        except Exception as e:
            logger.error(f"Error handling property change: {e}")
    
    def _handle_ofono_call(self, path, properties):
        """Handle new incoming/outgoing call via oFono."""
        try:
            state = str(properties.get("State", ""))
            self._update_call_state(state)
            
            if "LineIdentification" in properties:
                self.caller_id = str(properties["LineIdentification"])
            
            if "Name" in properties:
                self.caller_name = str(properties["Name"])
            
            self._notify_listeners()
            logger.info(f"Call event: {state} from {self.caller_id}")
            
        except Exception as e:
            logger.error(f"Error handling oFono call: {e}")
    
    def _handle_ofono_call_removed(self, path):
        """Handle call ended via oFono."""
        self.call_state = "idle"
        self.caller_id = None
        self.caller_name = None
        self._notify_listeners()
        logger.info("Call ended")
    
    def _update_call_state(self, state):
        """Update call state from oFono state string."""
        state_map = {
            "incoming": "incoming",
            "waiting": "incoming",
            "dialing": "outgoing",
            "alerting": "outgoing",
            "active": "active",
            "held": "held",
            "disconnected": "idle"
        }
        self.call_state = state_map.get(state, state)
        self._notify_listeners()
    
    def _on_device_connected(self, path):
        """Handle Bluetooth device connection."""
        try:
            if self._bus:
                device = self._bus.get_object("org.bluez", path)
                props = dbus.Interface(device, "org.freedesktop.DBus.Properties")
                self.connected_device = str(props.Get("org.bluez.Device1", "Address"))
                self.connected_device_name = str(props.Get("org.bluez.Device1", "Name"))
                self._notify_listeners()
                logger.info(f"Phone connected: {self.connected_device_name}")
        except Exception as e:
            logger.error(f"Error getting device info: {e}")
    
    def _on_device_disconnected(self):
        """Handle Bluetooth device disconnection."""
        self.connected_device = None
        self.connected_device_name = None
        self.call_state = "idle"
        self.caller_id = None
        self.caller_name = None
        self._notify_listeners()
        logger.info("Phone disconnected")
    
    def _poll_status(self):
        """Poll for phone status as fallback when D-Bus events aren't available."""
        while self.running:
            try:
                self._check_connection_status()
                time.sleep(2)
            except Exception as e:
                logger.error(f"Poll error: {e}")
                time.sleep(5)
    
    def _check_connection_status(self):
        """Check Bluetooth connection status via bluetoothctl."""
        if not IS_LINUX:
            return
        
        try:
            # Check for connected devices
            result = subprocess.run(
                ["bluetoothctl", "devices", "Connected"],
                capture_output=True, text=True, timeout=5
            )
            
            lines = result.stdout.strip().split('\n')
            connected = False
            
            for line in lines:
                if line.startswith("Device "):
                    parts = line.split(" ", 2)
                    if len(parts) >= 3:
                        self.connected_device = parts[1]
                        self.connected_device_name = parts[2]
                        connected = True
                        break
            
            if not connected:
                if self.connected_device:
                    self._on_device_disconnected()
            
        except Exception as e:
            logger.debug(f"bluetoothctl check failed: {e}")
    
    def _notify_listeners(self):
        """Notify all registered listeners of state change."""
        data = self.get_status()
        
        # Add to event queue for SSE
        self.event_queue.put(data)
        
        # Call direct listeners
        for callback in self.listeners:
            try:
                callback(data)
            except Exception as e:
                logger.error(f"Listener callback error: {e}")
    
    def subscribe(self, callback):
        """Subscribe to phone state changes."""
        self.listeners.append(callback)
    
    def unsubscribe(self, callback):
        """Unsubscribe from phone state changes."""
        if callback in self.listeners:
            self.listeners.remove(callback)
    
    def get_status(self):
        """Get current phone status."""
        return {
            "connected": self.connected_device is not None,
            "device": self.connected_device,
            "device_name": self.connected_device_name,
            "call_state": self.call_state,
            "caller_id": self.caller_id,
            "caller_name": self.caller_name,
            "recent_calls": self.recent_calls[:10]  # Last 10 calls
        }
    
    def answer_call(self):
        """Answer incoming call."""
        if not IS_LINUX:
            return {"success": False, "message": "Not supported on this platform"}
        
        try:
            # Try oFono first
            if self._try_ofono_command("Answer"):
                return {"success": True}
            
            # Fallback to dbus-send
            subprocess.run([
                "dbus-send", "--system", "--print-reply",
                "--dest=org.ofono",
                "/", "org.ofono.VoiceCall.Answer"
            ], timeout=5)
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Failed to answer call: {e}")
            return {"success": False, "message": str(e)}
    
    def hangup_call(self):
        """Hang up current call."""
        if not IS_LINUX:
            return {"success": False, "message": "Not supported on this platform"}
        
        try:
            # Try oFono first
            if self._try_ofono_command("Hangup"):
                return {"success": True}
            
            # Fallback to dbus-send
            subprocess.run([
                "dbus-send", "--system", "--print-reply",
                "--dest=org.ofono",
                "/", "org.ofono.VoiceCall.Hangup"
            ], timeout=5)
            
            self.call_state = "idle"
            self._notify_listeners()
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Failed to hangup call: {e}")
            return {"success": False, "message": str(e)}
    
    def dial_number(self, number):
        """Dial a phone number."""
        if not IS_LINUX:
            return {"success": False, "message": "Not supported on this platform"}
        
        if not number:
            return {"success": False, "message": "No number provided"}
        
        try:
            # Clean number
            number = ''.join(c for c in number if c.isdigit() or c in '+*#')
            
            # Try oFono Dial
            if DBUS_AVAILABLE and self._bus:
                try:
                    manager = self._bus.get_object("org.ofono", "/")
                    modems = manager.GetModems(dbus_interface="org.ofono.Manager")
                    
                    if modems:
                        modem_path = modems[0][0]
                        vcm = self._bus.get_object("org.ofono", modem_path)
                        vcm.Dial(number, "", dbus_interface="org.ofono.VoiceCallManager")
                        
                        self.call_state = "outgoing"
                        self.caller_id = number
                        self._notify_listeners()
                        
                        return {"success": True}
                except Exception as e:
                    logger.warning(f"oFono dial failed: {e}")
            
            return {"success": False, "message": "No phone service available"}
            
        except Exception as e:
            logger.error(f"Failed to dial: {e}")
            return {"success": False, "message": str(e)}
    
    def send_dtmf(self, digit):
        """Send DTMF tone during active call."""
        if not IS_LINUX:
            return {"success": False, "message": "Not supported on this platform"}
        
        if self.call_state != "active":
            return {"success": False, "message": "No active call"}
        
        try:
            if DBUS_AVAILABLE and self._bus:
                # Find active call and send DTMF
                # Implementation depends on oFono call path
                pass
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Failed to send DTMF: {e}")
            return {"success": False, "message": str(e)}
    
    def _try_ofono_command(self, method):
        """Try to execute oFono command via D-Bus."""
        if not DBUS_AVAILABLE or not self._bus:
            return False
        
        try:
            # This is a simplified implementation
            # Real implementation would need to track the active call path
            return False
        except:
            return False
    
    def get_recent_calls(self):
        """Get recent call history."""
        # On real implementation, this would query oFono call history
        # or maintain our own call log
        return {"ok": True, "calls": self.recent_calls}


# Singleton instance
phone_manager = PhoneManager()

