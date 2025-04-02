#!/bin/bash

echo "Starting build process..."

# Upgrade pip and install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt --no-cache-dir

echo "Python dependencies installed successfully."

# Build React frontend
echo "Building React frontend..."
npm install
npm run build

# Verify the build output
if [ ! -d "dist" ]; then
    echo "Error: dist directory not found after build"
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    echo "Error: index.html not found in dist directory"
    exit 1
fi

echo "Build completed successfully!" 