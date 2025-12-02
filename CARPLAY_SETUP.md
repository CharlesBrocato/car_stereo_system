# CarPlay / Android Auto Integration Guide

This guide explains how to set up and use the FastCarPlay integration for your Raspberry Pi 5 car stereo system.

## Overview

The system uses [FastCarPlay](https://github.com/niellun/FastCarPlay), a C++ implementation of CarPlay and Android Auto receivers that work with Carlinkit USB dongles.

### Features
- ✅ Apple CarPlay support (wired & wireless)
- ✅ Android Auto support (wired & wireless)
- ✅ Touchscreen navigation
- ✅ Audio playback (music, navigation, calls)
- ✅ Microphone support (Siri, Google Assistant)
- ✅ Optimized for Raspberry Pi 5

## Hardware Requirements

1. **Raspberry Pi 5** (4GB+ RAM recommended)
2. **7" Official Touchscreen** or compatible display (800x480)
3. **Carlinkit USB Dongle** - Compatible models:
   - Carlinkit CPC200-CCPM (recommended)
   - Carlinkit 4.0 / 5.0
   - CPC200-Autokit
   - Other "Autobox" dongles with vendor ID `1314`

4. **USB Microphone** (optional, for Siri/voice commands)
5. **Speakers/Audio output** (3.5mm or HDMI/USB audio)

## Quick Start

### 1. Build FastCarPlay

Run the build script (first time only):

```bash
cd ~/car_stereo_system
./build_carplay.sh
```

This will:
- Install all required dependencies (SDL2, FFmpeg, etc.)
- Configure USB permissions for the dongle
- Compile FastCarPlay for ARM64
- Create default configuration

### 2. Connect Hardware

1. Plug in the Carlinkit dongle to a USB port
2. Verify detection: `lsusb | grep -i "1314\|carlin"`

### 3. Start the System

**Development mode** (Flask only):
```bash
./start.sh
```

**Kiosk mode** (fullscreen browser):
```bash
./start.sh --kiosk
```

**Production mode** (everything):
```bash
./start.sh --full
```

### 4. Access CarPlay

1. Open http://localhost:5000 in browser (or use kiosk mode)
2. Click "CarPlay" from the main menu
3. Click "Start CarPlay"
4. Connect your iPhone or Android phone

## Connecting Your Phone

### iPhone (CarPlay)

**Wireless CarPlay:**
1. Ensure WiFi is enabled on both Pi and iPhone
2. Start CarPlay from the web interface
3. On iPhone: Settings → General → CarPlay → Available Cars
4. Select your car stereo system
5. First connection requires USB, then wireless works

**Wired CarPlay:**
1. Connect iPhone via Lightning-to-USB cable
2. Trust the computer when prompted
3. CarPlay should start automatically

### Android Phone (Android Auto)

**Wireless Android Auto:**
1. Install Android Auto app on your phone
2. Enable developer options in Android Auto:
   - Open Android Auto app
   - Tap version number 10 times
   - Enable "Unknown sources" in developer settings
3. Connect initially via USB to pair
4. After pairing, wireless connection is available

**Wired Android Auto:**
1. Connect phone via USB-C cable
2. Accept prompts on phone
3. Enable screen mirroring if needed

## Configuration

### Display Settings

Edit `carplay_engine/conf/settings.txt`:

```ini
# Resolution for 7" touchscreen
width = 800
height = 480
source-fps = 30
fps = 30
fullscreen = true
cursor = false
```

### Dongle Settings

If your dongle has different vendor/product IDs:

```bash
# Find your dongle's ID
lsusb
# Look for something like: ID 1314:1520 Magic Communication Tec.

# Convert hex to decimal and update settings.txt:
# 0x1314 = 4884 (decimal)
# 0x1520 = 5408 (decimal)
```

```ini
vendor-id = 4884
product-id = 5408
```

### Performance Tuning

For best performance on Pi 5:

```ini
hw-decode = true        # Hardware video decoding
vsync = false           # Disable vsync for lower latency
fast-render-scale = true # Faster image scaling
video-buffer-size = 32
audio-buffer-size = 32
```

## Systemd Services

For automatic startup on boot:

### Install Services

```bash
# Copy service files
sudo cp car-stereo.service /etc/systemd/system/
sudo cp carplay.service /etc/systemd/system/

# Update paths in service files if needed
sudo nano /etc/systemd/system/car-stereo.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable car-stereo
sudo systemctl start car-stereo
```

### Service Commands

```bash
# Check status
sudo systemctl status car-stereo
sudo systemctl status carplay

# View logs
journalctl -u car-stereo -f
journalctl -u carplay -f

# Restart
sudo systemctl restart car-stereo
```

## Kiosk Mode Setup

For a dedicated car display, set up automatic kiosk mode:

### Option 1: Autostart Script

```bash
# Copy kiosk script
sudo cp kiosk_autostart.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/kiosk_autostart.sh

# Add to LXDE autostart
mkdir -p ~/.config/lxsession/LXDE-pi
echo "@/usr/local/bin/kiosk_autostart.sh" >> ~/.config/lxsession/LXDE-pi/autostart
```

### Option 2: Systemd User Service

```bash
# Create user service directory
mkdir -p ~/.config/systemd/user

# Enable lingering for user services
sudo loginctl enable-linger pi
```

## Troubleshooting

### CarPlay Not Starting

1. **Check dongle connection:**
   ```bash
   lsusb | grep -i "1314"
   ```

2. **Check USB permissions:**
   ```bash
   ls -la /dev/bus/usb/*/*
   ```

3. **Rebuild if needed:**
   ```bash
   cd carplay_engine
   make clean
   make release
   ```

### No Video Display

1. **Check DISPLAY variable:**
   ```bash
   echo $DISPLAY  # Should be :0
   export DISPLAY=:0
   ```

2. **Test SDL:**
   ```bash
   sudo apt install libsdl2-dev
   ```

### Audio Issues

1. **Check audio output:**
   ```bash
   aplay -l  # List audio devices
   ```

2. **Set correct audio driver in settings.txt:**
   ```ini
   audio-driver = pipewire  # or pulseaudio, alsa
   ```

3. **Test audio:**
   ```bash
   speaker-test -t sine -f 440
   ```

### Phone Not Connecting

1. **For wireless connection:**
   - Ensure WiFi is enabled
   - Check firewall isn't blocking connections
   - Try wired connection first

2. **For Android Auto:**
   - Enable developer mode in Android Auto app
   - Allow unknown sources

## File Structure

```
car_stereo_system/
├── app.py                    # Flask backend
├── modules/
│   ├── carplay_module.py     # CarPlay manager
│   └── ...
├── templates/
│   ├── carplay.html          # CarPlay UI
│   └── ...
├── static/js/
│   ├── carplay.js            # CarPlay frontend logic
│   └── ...
├── carplay_engine/           # FastCarPlay source
│   ├── out/app               # Compiled executable
│   ├── conf/settings.txt     # Configuration
│   └── src/                  # Source code
├── build_carplay.sh          # Build script
├── start.sh                  # Startup script
├── carplay.service           # Systemd service
└── kiosk_autostart.sh        # Kiosk mode script
```

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/carplay` | GET | CarPlay UI page |
| `/api/carplay/status` | GET | Get current status |
| `/api/carplay/start` | POST | Start CarPlay engine |
| `/api/carplay/stop` | POST | Stop CarPlay engine |
| `/api/carplay/restart` | POST | Restart CarPlay engine |
| `/api/carplay/key` | POST | Send navigation key |

### Key Commands

```json
// POST /api/carplay/key
{ "key": "left" }     // Navigate left
{ "key": "right" }    // Navigate right
{ "key": "select" }   // Select/confirm
{ "key": "back" }     // Go back
{ "key": "home" }     // Home button
```

## Credits

- [FastCarPlay](https://github.com/niellun/FastCarPlay) by niellun
- Built on SDL2, FFmpeg, and libusb
- Inspired by pycarplay, react-carplay, and carplay-receiver projects

## License

FastCarPlay is licensed under GPL-3.0. See the `carplay_engine/LICENSE` file for details.

