#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "🔧 Starting build process..."

# Install Python dependencies with pip cache
pip install --upgrade pip
pip install -r requirements.txt --no-cache-dir

echo "✅ Python dependencies installed"

# Build React frontend
echo "🏗️ Building frontend..."
npm install
npm run build

# Create dist directory if it doesn't exist
mkdir -p dist

# Copy build files to dist
cp -r build/* dist/

echo "🎉 Build completed successfully!" 