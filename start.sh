#!/bin/bash
# Startup script for Car Stereo System

cd "$(dirname "$0")"

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "Installing dependencies..."
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Start the application
echo "Starting Car Stereo System..."
echo "Open http://localhost:5000 in your browser"
python3 app.py

