import re
import nltk
from nltk import word_tokenize, pos_tag
import spacy
from google.cloud import language_v1
from google.oauth2 import service_account

# Load the spaCy model
nlp = spacy.load("en_core_web_sm")

# Set up Google Cloud Natural Language API client
credentials = service_account.Credentials.from_service_account_file('path/to/your/service-account-file.json')
client = language_v1.LanguageServiceClient(credentials=credentials)

# TextRazor API key
API_KEY = '27afd7a49772ee31e35c2c78bcd111d74263bcb5f60d064373768bb8'
url = "https://api.textrazor.com"

# Example text
text = "2 liters of milk from Farm Fresh with high priority."

# Step 1: Preprocess with Regex
quantity_pattern = r'(\d+)\s*(liters?|litre|kg|g|pcs|units?)'
quantities = re.findall(quantity_pattern, text)

# Step 2: Analyze with spaCy
doc = nlp(text)
spacy_entities = [(ent.text, ent.label_) for ent in doc.ents]

# Step 3: Analyze with TextRazor
data = {'text': text, 'extractors': 'entities'}
headers = {'x-api-key': API_KEY}
response = requests.post(url, data=data, headers=headers)
textrazor_entities = response.json().get('response', {}).get('entities', [])

# Step 4: Combine Results
combined_results = {
    'quantities': quantities,
    'spacy_entities': spacy_entities,
    'textrazor_entities': textrazor_entities
}

#print(combined_results)

############














class ShoppingItemParser:
    def __init__(self):
        self.units = {
            'dozen': ['dozen', 'dz', 'dozens'],
            'kg': ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms'],
            'g': ['g', 'gram', 'grams'],
            'l': ['l', 'liter', 'liters', 'litre', 'litres'],
            'ml': ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
            'pcs': ['pcs', 'piece', 'pieces', 'pc'],
            'packet': ['packet', 'packets', 'pack', 'packs', 'pkt', 'pkts'],
            'box': ['box', 'boxes', 'bx', 'carton', 'cartons']
        }
        
        self.quantity_unit_patterns = [
            r'(\d+(?:\.\d+)?)\s*(dozen|dz|dozens|kg|g|l|ml|pcs|packet|packets|pack|packs|pkt|pkts|box|boxes|bx|carton|cartons|liter|litre)s?\b'
        ]
        
        # Priority indicators with case variations
        self.priorities = {
            'HIGH': {
                'keywords': ['high', 'urgent', 'important', 'asap', 'quick', 'immediately',
                           'rush', 'priority', 'critical', 'essential', 'vital'],
                'display': 'High'  # Display format
            },
            'MEDIUM': {
                'keywords': ['medium', 'normal', 'regular', 'standard', 'moderate',
                           'average', 'ordinary', 'usual'],
                'display': 'Medium'  # Display format
            },
            'LOW': {
                'keywords': ['low', 'can wait', 'not urgent', 'whenever', 'flexible',
                           'casual', 'relaxed', 'later', 'eventually'],
                'display': 'Low'  # Display format
            }
        }
        
        self.connecting_words = ['of', 'from', 'with', 'and', 'the']
        
        # Download required NLTK data if not already present
        try:
            nltk.data.find('tokenizers/punkt')
            nltk.data.find('averaged_perceptron_tagger')
        except LookupError:
            nltk.download('punkt')
            nltk.download('averaged_perceptron_tagger')
    
    def _normalize_text(self, text):
        """Normalize text for comparison"""
        if not text:
            return ""
        # Convert to lowercase and strip whitespace
        text = text.lower().strip()
        # Remove extra whitespace
        text = ' '.join(text.split())
        return text
    
    def _get_priority_score(self, text, priority_keywords):
        """Calculate how well the text matches priority words using word similarity"""
        text = self._normalize_text(text)
        words = word_tokenize(text)
        score = 0
        matched_words = []
        
        # First look for exact phrase "X priority"
        priority_phrases = [f"{keyword} priority" for keyword in priority_keywords]
        for phrase in priority_phrases:
            if phrase in text:
                score += 2  # Give higher score for exact "X priority" matches
                matched_words.append(phrase)
                #print(f"Found exact priority phrase: {phrase}")
                return score  # Return immediately if we find an exact priority phrase
        
        # If no exact priority phrase found, look for individual words
        for word in words:
            # Check for exact matches (case-insensitive)
            if word in priority_keywords:
                score += 1
                matched_words.append(word)
                #print(f"Found priority keyword: {word}")
                continue
                
            # Check for word within priority keyword phrases
            for keyword in priority_keywords:
                if ' ' in keyword:  # Multi-word keyword
                    if keyword in text:
                        score += 1
                        matched_words.append(keyword)
                        #print(f"Found multi-word priority: {keyword}")
                        break
                # Check if keyword is part of the word
                elif keyword in word:
                    score += 0.5
                    matched_words.append(word)
                    #print(f"Found partial priority match: {word} contains {keyword}")
                    break
        
        #print(f"Priority score: {score} with matched words: {matched_words}")
        return score
    
    def _extract_priority_from_text(self, text):
        """Extract priority level from text using semantic matching"""
        if not text:
            return None
            
        # Normalize text
        text = self._normalize_text(text)
        #print(f"\nAnalyzing priority in text: {text}")
        
        # Calculate priority scores
        scores = {}
        for level, priority_info in self.priorities.items():
            score = self._get_priority_score(text, priority_info['keywords'])
            scores[level] = score
            #print(f"Priority {priority_info['display']} score: {score}")
        
        # Get the priority level with highest score
        if any(scores.values()):
            max_priority = max(scores.items(), key=lambda x: x[1])
            if max_priority[1] > 0:
                priority_level = max_priority[0]
                #print(f"Selected priority level: {self.priorities[priority_level]['display']} with score {max_priority[1]}")
                # Return the priority level in the exact format needed by frontend
                return priority_level  # This will be 'HIGH', 'MEDIUM', or 'LOW'
        
        #print("No clear priority found, using default MEDIUM")
        return 'MEDIUM'  # Default priority in correct case
    
    def analyze_with_google(self, text):
        """Analyze text using Google Cloud Natural Language API."""
        document = language_v1.Document(content=text, type_=language_v1.Document.Type.PLAIN_TEXT)
        response = client.analyze_entities(document=document)
        entities = [(entity.name, entity.type_) for entity in response.entities]
        return entities

    def parse_with_context(self, text):
        """Parse text using context windows and state tracking."""
        try:
            result = {
                'quantity': '',
                'unit': '',
                'itemName': '',
                'brand': '',
                'priority': '',
                'description': text,
                'details': ''
            }
            
            # Step 1: Preprocess with Regex
            quantity_match = self._extract_quantity_unit(text)
            if quantity_match:
                result['quantity'] = quantity_match['quantity']
                result['unit'] = quantity_match['unit']
                result['itemName'] = text.replace(quantity_match['matched_text'], '').strip()
            
            # Step 2: Analyze with spaCy
            doc = nlp(text)
            for ent in doc.ents:
                if ent.label_ == "PRODUCT":
                    result['itemName'] = ent.text
            
            # Step 3: Analyze with Google Cloud Natural Language API
            google_entities = self.analyze_with_google(text)
            for entity_name, entity_type in google_entities:
                if entity_type == 'ORGANIZATION':
                    result['brand'] = entity_name
            
            # Step 4: Extract details
            details_pattern = r'with (.+?)(?:\s+and|\.$)'
            details_match = re.search(details_pattern, text)
            if details_match:
                result['details'] = details_match.group(1).strip()
            
            # Process priority with semantic matching
            #print("\nProcessing priority...")
            if result['itemName']:
                #print(f"Checking full text for priority...")
                priority_level = self._extract_priority_from_text(text)
                if priority_level:
                    result['priority'] = priority_level
                else:
                    result['priority'] = 'MEDIUM'  # default
                    #print(f"Using default priority: {self.priorities['MEDIUM']['display']}")
            
            # Process details
            if result['itemName']:
                # Remove any remaining connecting words
                for word in self.connecting_words:
                    result['itemName'] = re.sub(fr'\b{word}\b', ' ', result['itemName'], flags=re.IGNORECASE)
                result['itemName'] = ' '.join(result['itemName'].split())  # Clean up spaces
            
            #print(f"\nFinal result: {result}")
            return result
            
        except Exception as e:
            #print(f"Error in parse_with_context: {e}")
            return {
                'quantity': '',
                'unit': '',
                'itemName': text,
                'brand': '',
                'priority': 'MEDIUM',
                'description': text,
                'details': ''
            }
    
    def _extract_quantity_unit(self, text):
        """Extract quantity and unit using regex."""
        for pattern in self.quantity_unit_patterns:
            match = re.search(pattern, text)
            if match:
                quantity = match.group(1)
                raw_unit = match.group(2)
                std_unit = next((unit for unit, variations in self.units.items() if raw_unit in variations), None)
                if std_unit:
                    return {
                        'quantity': quantity,
                        'unit': std_unit,
                        'matched_text': match.group(0)
                    }
        return None

# Initialize the global parser instance
shopping_parser = ShoppingItemParser()

def analyze_text(text):
    """Main function to analyze shopping item text"""
    return shopping_parser.parse_with_context(text) 

if __name__ == '__main__':
    text='3 packets pasta from Italian Delight with medium priority and make sure they are whole wheat.'
    print(analyze_text(text))

    #print(result)

