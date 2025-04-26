#!/bin/bash

echo "Starting build process..."

# Upgrade pip and install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt && npm run build && python app.py


npm install
npm run build


if [ ! -d "dist" ]; then
    echo "Error: dist directory not found after build"
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    echo "Error: index.html not found in dist directory"
    exit 1
fi

echo "Build completed successfully!" 
# Run the server
python server.py