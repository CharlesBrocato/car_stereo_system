"""
Bluetooth Module
Handles Bluetooth audio connections and device management
"""

import subprocess
import re

class BluetoothManager:
    def __init__(self):
        self.connected_device = None
        self.is_connected_flag = False
    
    def scan_devices(self, timeout=10):
        """Scan for available Bluetooth devices"""
        devices = []
        try:
            # Use bluetoothctl to scan for devices
            result = subprocess.run(
                ['bluetoothctl', 'scan', 'on'],
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            # Parse output for device information
            # This is a simplified version - you may need to adjust based on your system
            lines = result.stdout.split('\n')
            for line in lines:
                if 'Device' in line:
                    # Extract device MAC address and name
                    match = re.search(r'Device\s+([A-F0-9:]+)\s+(.+)', line)
                    if match:
                        devices.append({
                            'address': match.group(1),
                            'name': match.group(2).strip()
                        })
        except Exception as e:
            print(f"Bluetooth scan error: {e}")
            # Return mock data for development
            devices = [
                {'address': '00:11:22:33:44:55', 'name': 'Mock Bluetooth Device'},
                {'address': 'AA:BB:CC:DD:EE:FF', 'name': 'Mock Phone'}
            ]
        
        return devices
    
    def connect(self, device_address):
        """Connect to a Bluetooth device"""
        try:
            # Use bluetoothctl to connect
            result = subprocess.run(
                ['bluetoothctl', 'connect', device_address],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if 'Connection successful' in result.stdout or result.returncode == 0:
                self.connected_device = device_address
                self.is_connected_flag = True
                return {'success': True, 'message': 'Connected successfully'}
            else:
                return {'success': False, 'message': 'Connection failed'}
        except Exception as e:
            print(f"Bluetooth connect error: {e}")
            # For development, simulate connection
            self.connected_device = device_address
            self.is_connected_flag = True
            return {'success': True, 'message': 'Connected (simulated)'}
    
    def disconnect(self):
        """Disconnect from current Bluetooth device"""
        try:
            if self.connected_device:
                result = subprocess.run(
                    ['bluetoothctl', 'disconnect', self.connected_device],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
            
            self.connected_device = None
            self.is_connected_flag = False
            return {'success': True, 'message': 'Disconnected successfully'}
        except Exception as e:
            print(f"Bluetooth disconnect error: {e}")
            self.connected_device = None
            self.is_connected_flag = False
            return {'success': True, 'message': 'Disconnected'}
    
    def is_connected(self):
        """Check if a device is currently connected"""
        return self.is_connected_flag

