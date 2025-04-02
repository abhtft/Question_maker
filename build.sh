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

echo "Build completed successfully!" 