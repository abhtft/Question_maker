from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv
import nltk
from nltk.tokenize import word_tokenize
from nltk.tag import pos_tag
import re

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
    mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
    client = MongoClient(mongo_uri)
    db = client.shopping_list
    print("✅ MongoDB Connection Successful!")
except Exception as e:
    print("❌ MongoDB Connection Error:", str(e))
    raise e

# Download required NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('averaged_perceptron_tagger', quiet=True)
    nltk.download('maxent_ne_chunker', quiet=True)
    nltk.download('words', quiet=True)
    print("✅ NLP resources downloaded successfully")
except Exception as e:
    print(f"❌ Error downloading NLP resources: {e}")

def extract_entities(text):
    """Extract entities from text using NLTK."""
    try:
        # Tokenize and tag the text
        tokens = word_tokenize(text)
        tagged = pos_tag(tokens)
        
        # Initialize variables
        quantity = ""
        brand = ""
        item_name = []
        unit = ""
        
        # Extract numbers for quantity
        numbers = re.findall(r'\d+(?:\.\d+)?', text)
        if numbers:
            quantity = numbers[0]
            # Look for units after the number
            num_index = text.find(numbers[0])
            if num_index != -1:
                after_num = text[num_index + len(numbers[0]):].strip()
                units = ['kg', 'g', 'l', 'ml', 'piece', 'pieces', 'pcs']
                for u in units:
                    if after_num.lower().startswith(u):
                        unit = u
                        quantity += f" {u}"
                        break
        
        # Extract brand (look for words after "brand" or company names)
        words = text.lower().split()
        for i, word in enumerate(words):
            if word in ['brand', 'company', 'make'] and i + 1 < len(words):
                brand = words[i + 1].title()
                break
        
        # Extract item name (use POS tagging to find nouns)
        for word, tag in tagged:
            # Skip numbers, units, and brand-related words
            if (word.lower() not in ['brand', 'company', 'make'] and 
                not re.match(r'\d+', word) and 
                word.lower() not in ['kg', 'g', 'l', 'ml', 'piece', 'pieces', 'pcs']):
                if tag.startswith('NN'):  # If it's a noun
                    item_name.append(word)
        
        # Clean up item name
        item_name = ' '.join(item_name).strip()
        if not item_name and tokens:  # Fallback: use first token if no nouns found
            item_name = tokens[0]
            
        return {
            'quantity': quantity,
            'brand': brand,
            'itemName': item_name,
            'unit': unit,
            'description': text
        }
    except Exception as e:
        print(f"Error in extract_entities: {e}")
        return {
            'quantity': '',
            'brand': '',
            'itemName': text,
            'unit': '',
            'description': text
        }

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

@app.route('/api/analyze', methods=['POST', 'OPTIONS'])
def analyze_text():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        text = data.get('text', '')
        if not text:
            return jsonify({'error': 'No text provided'}), 400
            
        print(f"Analyzing text: {text}")
        result = extract_entities(text)
        print(f"Analysis result: {result}")
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error in text analysis: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

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

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    print("🚀 Server starting on http://localhost:" + str(port))
    print(f"📁 Serving static files from: {os.path.abspath(app.static_folder)}")
    app.run(host='0.0.0.0', port=port, debug=True)