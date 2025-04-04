from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv
import nltk
import re
import assemblyai as aai
from text_analyzer import analyze_text, ShoppingItemParser

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__, static_folder='dist', static_url_path='')

# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Initialize MongoDB
try:
    MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
    client = MongoClient(MONGODB_URI)
    db = client.shopping_list_db
    print("✅ MongoDB Connection Successful!")
except Exception as e:
    print("❌ MongoDB Connection Error:", e)
    db = None

# Download required NLTK data
try:
    nltk.download('punkt')
    nltk.download('averaged_perceptron_tagger')
    nltk.download('maxent_ne_chunker', quiet=True)
    nltk.download('words', quiet=True)
    print("✅ NLP resources downloaded successfully")
except Exception as e:
    print(f"❌ Error downloading NLP resources: {e}")

# Configure AssemblyAI
aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY")

# Initialize the shopping item parser
parser = ShoppingItemParser()

@app.route('/')
def serve():
    try:
        response = make_response(send_from_directory(app.static_folder, 'index.html'))
        response.headers['Content-Type'] = 'text/html; charset=utf-8'
        return response
    except Exception as e:
        print(f"Error serving index.html: {e}")
        return "Server Error", 500

@app.route('/<path:path>')
def serve_static(path):
    try:
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return "Not Found", 404
    except Exception as e:
        print(f"Error serving static file {path}: {e}")
        return "Server Error", 500

@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
            
        # Use our new text analyzer
        result = analyze_text(text)
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in analyze endpoint: {e}")
        return jsonify({'error': str(e)}), 500

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
        result = db.lists.insert_one(data)
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

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'mongodb': 'connected'
    }), 200

@app.route('/api/transcribe', methods=['POST', 'OPTIONS'])
def transcribe_audio():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
            
        audio_file = request.files['audio']
        if not audio_file.filename:
            return jsonify({'error': 'No audio file selected'}), 400
            
        # Save the audio file temporarily
        temp_path = os.path.join('temp', audio_file.filename)
        os.makedirs('temp', exist_ok=True)
        audio_file.save(temp_path)
        
        # Transcribe using AssemblyAI
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(temp_path)
        
        # Clean up the temporary file
        os.remove(temp_path)
        
        if transcript.error:
            return jsonify({'error': transcript.error}), 500
            
        return jsonify({
            'text': transcript.text,
            'confidence': transcript.confidence
        })
        
    except Exception as e:
        print(f"❌ Error in transcription: {str(e)}")
        return jsonify({
            'error': str(e)
        }), 500

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f"🚀 Server starting on http://localhost:{port}")
    print(f"📁 Serving static files from: {os.path.abspath(app.static_folder)}")
    app.run(host='0.0.0.0', port=port, debug=True)