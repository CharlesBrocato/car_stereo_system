#!/usr/bin/env bash
# =============================================================================
# Raspberry Pi Bluetooth Setup Script
# =============================================================================
# This script installs and configures Bluetooth on Raspberry Pi for the
# car stereo system. Run this ONLY on Raspberry Pi (not on macOS).
#
# Usage:
#   chmod +x scripts/setup_rpi_bluetooth.sh
#   bash scripts/setup_rpi_bluetooth.sh
# =============================================================================

set -e

echo "=============================================="
echo "  Car Stereo System - Bluetooth Setup"
echo "  For Raspberry Pi (Linux/BlueZ)"
echo "=============================================="
echo ""

# Check if running on Linux
if [[ "$(uname)" != "Linux" ]]; then
    echo "ERROR: This script is intended for Raspberry Pi (Linux) only."
    echo "       On macOS, Bluetooth works automatically via CoreBluetooth."
    exit 1
fi

echo "[1/5] Updating apt package lists..."
sudo apt-get update

echo ""
echo "[2/5] Installing Bluetooth packages and tools..."
sudo apt-get install -y \
    bluetooth \
    bluez \
    bluez-tools \
    libbluetooth-dev \
    python3-dev \
    python3-venv

echo ""
echo "[3/5] Enabling Bluetooth service..."
sudo systemctl enable bluetooth
sudo systemctl start bluetooth

echo ""
echo "[4/5] Checking Bluetooth adapter status..."
if command -v bluetoothctl &> /dev/null; then
    echo "Running 'bluetoothctl show':"
    bluetoothctl show || echo "  (No adapter info available - adapter may need reset)"
else
    echo "  bluetoothctl not found - BlueZ may not be fully installed"
fi

echo ""
echo "[5/5] Optional: Allow Python to access Bluetooth without sudo"
echo ""
echo "  If you want to run the car stereo system without sudo, uncomment and run:"
echo ""
echo "  # Replace 'pi' with your username if different"
echo "  sudo setcap 'cap_net_raw,cap_net_admin+eip' \"\$(readlink -f \"\$(which python3)\")\""
echo ""
echo "  Or run the Flask app with sudo."
echo ""

echo "=============================================="
echo "  Bluetooth setup complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Reboot the Raspberry Pi (recommended):"
echo "     sudo reboot"
echo ""
echo "  2. After reboot, verify Bluetooth is working:"
echo "     bluetoothctl show"
echo "     bluetoothctl scan on"
echo ""
echo "  3. Start the car stereo system:"
echo "     cd /path/to/car_stereo_system"
echo "     source venv/bin/activate"
echo "     python3 app.py"
echo ""

