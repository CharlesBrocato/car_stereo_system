# Quick Start Guide

## Fast Setup (5 minutes)

1. **Create virtual environment and install dependencies:**
   ```bash
   cd /home/cqb5990/car_stereo_system
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Run the application:**
   ```bash
   source venv/bin/activate  # If not already activated
   python3 app.py
   ```
   
   **Or simply:**
   ```bash
   ./start.sh
   ```

3. **Open in browser:**
   - On Raspberry Pi: Open Chromium and go to `http://localhost:5000`
   - The interface is optimized for your 7" touch screen!

## First Time Setup

### Enable I2C for Sense HAT
```bash
sudo raspi-config
# Navigate to: Interface Options → I2C → Enable
```

### Enable Bluetooth
```bash
sudo systemctl enable bluetooth
sudo systemctl start bluetooth
```

### Set Audio Output
```bash
# List available audio outputs
pactl list sinks

# Set default (example for HDMI)
pactl set-default-sink 1
```

## Using the System

### Main Menu
- **Music**: Play Bluetooth audio or local files
- **Map**: Navigation with OpenStreetMap
- **Android Auto**: Connect your Android phone
- **Settings**: Configure system preferences

### Music Player
1. Click "Scan for Devices"
2. Select your phone or Bluetooth speaker
3. Click "Connect"
4. Play music from your device!

### Map Navigation
1. Enter coordinates (lat,lon) or use current location
2. Click "Get Route" to see directions
3. Map updates in real-time

### Settings
- Adjust volume, brightness, screen timeout
- View sensor data from Sense HAT
- Configure audio output

## Troubleshooting

**Sense HAT not working?**
- Check I2C is enabled
- Application runs in simulation mode if hardware unavailable

**Bluetooth not connecting?**
- Ensure Bluetooth service is running
- Make sure device is in pairing mode

**Audio not playing?**
- Check audio output settings
- Verify PulseAudio is running: `pulseaudio --check`

## Next Steps

- See README.md for detailed documentation
- Install OpenAuto for full Android Auto support
- Configure auto-start on boot (see README.md)

