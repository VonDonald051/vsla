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

# Keep existing data. Resetting db.json here would erase the source snapshot
# needed by the Convex migration and would delete real VSLA records on restart.
mkdir -p data
if [ ! -f data/db.json ]; then
    echo '{"users":[],"groups":[],"loans":[],"fines":[],"savings":[],"items":[],"safeCodes":[],"chats":[],"notes":[],"logs":[],"settings":{"safeCodeEnabled":false,"globalLockout":false}}' > data/db.json
fi

echo "Starting VSLA Secure Financial Platform on http://localhost:8000 ..."
node server.js
