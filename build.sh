#!/bin/bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies and build React app
npm install
npm run build 