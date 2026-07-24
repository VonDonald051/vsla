#!/bin/bash
echo "Checking and installing dependencies automatically..."
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js packages..."
    npm install
fi

if ! python3 -c "import flask, reportlab, bcrypt, cryptography, pypdf" 2>/dev/null; then
    echo "Installing Python security & report packages..."
    pip install flask reportlab pandas bcrypt cryptography pypdf
fi

echo "Clearing database for fresh start..."
mkdir -p data
echo '{"users":[],"groups":[],"loans":[],"fines":[],"savings":[],"items":[],"safeCodes":[],"chats":[],"notes":[],"logs":[],"settings":{"safeCodeEnabled":false,"registrationEnabled":true,"globalLockout":false}}' > data/db.json

echo "Starting VSLA Secure Financial Platform on http://localhost:8000 ..."
node server.js
