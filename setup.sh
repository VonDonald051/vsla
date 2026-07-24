#!/bin/bash
echo "Installing Node.js dependencies..."
npm install
echo "Installing Python security & report dependencies..."
pip install flask reportlab pandas bcrypt cryptography pypdf
echo "Setup complete successfully!"
