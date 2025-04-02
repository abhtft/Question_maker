from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv
from transformers import pipeline
import re

# Load environment variables
load_dotenv()

# Initialize Flask app with static files configuration
app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "allow_headers": ["Content-Type"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

# Initialize MongoDB
mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
client = MongoClient(mongo_uri)
db = client.shopping_list

# Initialize the multilingual NER pipeline
try:
    ner_pipeline = pipeline("ner", model="Davlan/bert-base-multilingual-cased-ner-hrl")
    print("✅ NLP Model loaded successfully")
except Exception as e:
    print(f"❌ Error loading NLP model: {e}")
    ner_pipeline = None

def extract_entities(text):
    """Extract entities from text using multilingual model."""
    try:
        # Get NER results
        ner_results = ner_pipeline(text)
        
        # Initialize variables
        quantity = ""
        brand = ""
        item_name = ""
        
        # Process NER results
        current_entity = {"text": "", "type": ""}
        
        for result in ner_results:
            # Merge subwords of the same entity
            if result['entity'].startswith('B-'):  # Beginning of entity
                if current_entity["text"]:
                    # Store previous entity
                    if current_entity["type"] == "ORG":
                        brand = current_entity["text"].strip()
                    elif current_entity["type"] == "QUANTITY":
                        quantity = current_entity["text"].strip()
                
                current_entity = {
                    "text": result['word'],
                    "type": result['entity'][2:]  # Remove B- prefix
                }
            elif result['entity'].startswith('I-'):  # Inside of entity
                current_entity["text"] += " " + result['word']
        
        # Store last entity
        if current_entity["text"]:
            if current_entity["type"] == "ORG":
                brand = current_entity["text"].strip()
            elif current_entity["type"] == "QUANTITY":
                quantity = current_entity["text"].strip()
        
        # Extract numbers for quantity
        numbers = re.findall(r'\d+', text)
        if numbers and not quantity:
            quantity = numbers[0]
        
        # Extract brand if not found by NER
        if not brand:
            # Common brand indicators
            brand_indicators = ['brand', 'company', 'make']
            words = text.lower().split()
            for i, word in enumerate(words):
                if word in brand_indicators and i + 1 < len(words):
                    brand = words[i + 1]
                    break
        
        # Get item name by removing brand and quantity
        words = text.split()
        item_words = []
        for word in words:
            if word.lower() not in [brand.lower(), quantity.lower(), 'brand', 'piece', 'pieces', 'kg', 'g', 'ml', 'l', 'pcs']:
                item_words.append(word)
        item_name = ' '.join(item_words).strip()
        
        return {
            'quantity': quantity,
            'brand': brand,
            'itemName': item_name,
            'description': text
        }
    except Exception as e:
        print(f"Error in extract_entities: {e}")
        return {
            'quantity': '',
            'brand': '',
            'itemName': text,
            'description': text
        }

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

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'mongodb': 'connected'
    }), 200

@app.route('/api/analyze', methods=['POST'])
def analyze_text():
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
            
        result = extract_entities(text)
        return jsonify(result)
        
    except Exception as e:
        print("❌ Error in text analysis:", str(e))
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    print("🚀 Server starting on https://localhost:" + str(port))
    
    try:
        app.run(
            host='0.0.0.0',
            port=port,
            ssl_context='adhoc',
            debug=True
        )
    except Exception as e:
        print(f"Error starting server: {e}")
        print("Falling back to HTTP (not secure)")
        app.run(
            host='0.0.0.0',
            port=port,
            debug=True
        )