import re
import nltk
from nltk import word_tokenize, pos_tag

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
                print(f"Found exact priority phrase: {phrase}")
                return score  # Return immediately if we find an exact priority phrase
        
        # If no exact priority phrase found, look for individual words
        for word in words:
            # Check for exact matches (case-insensitive)
            if word in priority_keywords:
                score += 1
                matched_words.append(word)
                print(f"Found priority keyword: {word}")
                continue
                
            # Check for word within priority keyword phrases
            for keyword in priority_keywords:
                if ' ' in keyword:  # Multi-word keyword
                    if keyword in text:
                        score += 1
                        matched_words.append(keyword)
                        print(f"Found multi-word priority: {keyword}")
                        break
                # Check if keyword is part of the word
                elif keyword in word:
                    score += 0.5
                    matched_words.append(word)
                    print(f"Found partial priority match: {word} contains {keyword}")
                    break
        
        print(f"Priority score: {score} with matched words: {matched_words}")
        return score
    
    def _extract_priority_from_text(self, text):
        """Extract priority level from text using semantic matching"""
        if not text:
            return None
            
        # Normalize text
        text = self._normalize_text(text)
        print(f"\nAnalyzing priority in text: {text}")
        
        # Calculate priority scores
        scores = {}
        for level, priority_info in self.priorities.items():
            score = self._get_priority_score(text, priority_info['keywords'])
            scores[level] = score
            print(f"Priority {priority_info['display']} score: {score}")
        
        # Get the priority level with highest score
        if any(scores.values()):
            max_priority = max(scores.items(), key=lambda x: x[1])
            if max_priority[1] > 0:
                priority_level = max_priority[0]
                print(f"Selected priority level: {self.priorities[priority_level]['display']} with score {max_priority[1]}")
                # Return the priority level in the exact format needed by frontend
                return priority_level  # This will be 'HIGH', 'MEDIUM', or 'LOW'
        
        print("No clear priority found, using default MEDIUM")
        return 'MEDIUM'  # Default priority in correct case
    
    def parse_with_context(self, text):
        """Parse text using context windows and state tracking"""
        try:
            result = {
                'quantity': '',
                'unit': '',
                'itemName': '',
                'brand': '',
                'priority': '',
                'description': text,  # Keep original description
                'details': ''
            }
            
            # Normalize text while preserving original case
            text = text.strip()
            print(f"\nProcessing text: {text}")
            
            # Split text into main parts using key markers
            parts = {
                'before_from': '',
                'brand': '',
                'priority': '',
                'details': ''
            }
            
            # Split by "from" first
            if ' from ' in text:
                before_from, rest = text.split(' from ', 1)
                parts['before_from'] = before_from.strip()
                
                # Split rest by "with" if exists
                if ' with ' in rest:
                    brand_part, priority_rest = rest.split(' with ', 1)
                    parts['brand'] = brand_part.strip()
                    
                    # Split priority and details
                    if ' and ' in priority_rest:
                        priority_part, rest = priority_rest.split(' and ', 1)
                        parts['priority'] = priority_part.strip()
                        parts['details'] = rest.strip()
                    else:
                        parts['priority'] = priority_rest.strip()
            else:
                parts['before_from'] = text
            
            print(f"Split parts: {parts}")
            
            # Extract quantity and unit from before_from
            quantity_unit = self._extract_quantity_unit(parts['before_from'])
            if quantity_unit:
                result['quantity'] = quantity_unit['quantity']
                result['unit'] = quantity_unit['unit']
                # Remove quantity and unit from before_from to get item name
                item_text = parts['before_from'].replace(quantity_unit['matched_text'], '').strip()
                result['itemName'] = item_text
            
            # Process brand
            if parts['brand']:
                result['brand'] = parts['brand'].strip()
            
            # Process priority with semantic matching
            print("\nProcessing priority...")
            if parts['priority']:
                print(f"Checking priority section: {parts['priority']}")
                priority_level = self._extract_priority_from_text(parts['priority'])
                if priority_level:
                    result['priority'] = priority_level
                else:
                    # If no priority found in priority part, check full text
                    print("Checking full text for priority...")
                    priority_level = self._extract_priority_from_text(text)
                    if priority_level:
                        result['priority'] = priority_level
                    else:
                        result['priority'] = 'MEDIUM'  # default
                        print(f"Using default priority: {self.priorities['MEDIUM']['display']}")
            else:
                # If no priority part found, check full text
                print("No priority section found, checking full text...")
                priority_level = self._extract_priority_from_text(text)
                if priority_level:
                    result['priority'] = priority_level
                else:
                    result['priority'] = 'MEDIUM'  # default
                    print(f"Using default priority: {self.priorities['MEDIUM']['display']}")
            
            # Process details
            if parts['details']:
                result['details'] = parts['details']
            
            # Clean up item name
            if result['itemName']:
                # Remove any remaining connecting words
                for word in self.connecting_words:
                    result['itemName'] = re.sub(fr'\b{word}\b', ' ', result['itemName'], flags=re.IGNORECASE)
                result['itemName'] = ' '.join(result['itemName'].split())  # Clean up spaces
            
            print(f"\nFinal result: {result}")
            return result
            
        except Exception as e:
            print(f"Error in parse_with_context: {e}")
            return {
                'quantity': '',
                'unit': '',
                'itemName': text,
                'brand': '',
                'priority': 'MEDIUM',
                'description': text,  # Keep original description
                'details': ''
            }
    
    def _extract_quantity_unit(self, text):
        """Extract quantity and unit using context"""
        text = text.lower()
        for pattern in self.quantity_unit_patterns:
            match = re.search(pattern, text)
            if match:
                quantity = match.group(1)
                raw_unit = match.group(2)
                
                # Standardize unit
                std_unit = None
                for unit, variations in self.units.items():
                    if raw_unit.rstrip('s') in variations:
                        std_unit = unit
                        break
                
                if std_unit:
                    return {
                        'quantity': quantity,
                        'unit': std_unit,
                        'matched_text': match.group(0)
                    }
        
        # Debug print
        print("No quantity-unit match found in:", text)
        return None

# Initialize the global parser instance
shopping_parser = ShoppingItemParser()

def analyze_text(text):
    """Main function to analyze shopping item text"""
    return shopping_parser.parse_with_context(text) 

if __name__ == '__main__':
    text='3 packets pasta from Italian Delight with medium priority and make sure they are whole wheat.'
    result=analyze_text(text)
    #print(result)
