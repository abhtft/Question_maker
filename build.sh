#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install Python dependencies
pip install -r requirements.txt

# Build React frontend
npm install
npm run build

# Create dist directory if it doesn't exist
mkdir -p dist

# Copy build files to dist
cp -r build/* dist/

echo "🎉 Build completed successfully!" 