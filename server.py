from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app with static files configuration
app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Get MongoDB URI from environment variable
MONGODB_URI = os.getenv('MONGODB_URI')
if not MONGODB_URI:
    raise ValueError("No MONGODB_URI environment variable found")

try:
    client = MongoClient(MONGODB_URI)
    print("✅ MongoDB Connection Successful!")
    db = client.kirana_suvidha
    shopping_lists = db.shopping_lists
except Exception as e:
    print("❌ MongoDB Connection Error:", str(e))
    raise e

# Serve React app - root route
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    try:
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')
    except Exception as e:
        print(f"Error serving static files: {e}")
        return jsonify({"error": "File not found"}), 404

# API endpoint for saving shopping lists
@app.route('/api', methods=['POST', 'OPTIONS'])
def save_shopping_list():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        print("📥 Received data at /api:", data)

        data['created_at'] = datetime.utcnow()
        result = shopping_lists.insert_one(data)
        print("✅ Saved to MongoDB with ID:", result.inserted_id)

        return jsonify({
            'success': True,
            'id': str(result.inserted_id)
        }), 201
    except Exception as e:
        print("❌ Error while processing /api request:", str(e))
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'mongodb': 'connected'
    }), 200

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    print("🚀 Server starting on http://localhost:" + str(port))
    app.run(host='0.0.0.0', port=port)