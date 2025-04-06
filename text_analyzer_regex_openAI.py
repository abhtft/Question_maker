import openai
from dotenv import load_dotenv
import os
import re
import json
import time
from functools import lru_cache

# Load environment variables
load_dotenv()

# Set up OpenAI API key
client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

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
        
        # Compile regex patterns for better performance
        self.quantity_unit_pattern = re.compile(
            r'(\d+(?:\.\d+)?)\s*(dozen|dz|dozens|kg|g|l|ml|pcs|packet|packets|pack|packs|pkt|pkts|box|boxes|bx|carton|cartons|liter|litre)s?\b',
            re.IGNORECASE
        )
        
        # Brand pattern - matches brand names after "from" until the next keyword or end
        self.brand_pattern = re.compile(
            r'from\s+([A-Z][A-Za-z\s]+?)(?=\s+(?:with|and|$))',
            re.IGNORECASE
        )
        
        # Details pattern - matches details after "with" or "and", excluding priority phrases
        self.details_pattern = re.compile(
            r'(?:with|and)\s+(?!(?:high|medium|low|urgent|normal)\s+priority)(.+?)(?=$|\s+(?:with|and)\s+(?:high|medium|low|urgent|normal)\s+priority)',
            re.IGNORECASE
        )
        
        # Priority pattern - specifically matches priority phrases
        self.priority_pattern = re.compile(
            r'(?:with|and)\s+(high|medium|low|urgent|normal)\s+priority',
            re.IGNORECASE
        )
        
        # Priority keywords with weights for better matching
        self.priorities = {
            'HIGH': {
                'keywords': ['high', 'urgent', 'important', 'asap', 'critical'],
                'weight': 3
            },
            'MEDIUM': {
                'keywords': ['medium', 'normal', 'regular', 'average'],
                'weight': 2
            },
            'LOW': {
                'keywords': ['low', 'not urgent', 'relaxed', 'later'],
                'weight': 1
            }
        }
        
        # Common connecting words to filter out
        self.connecting_words = set(['of', 'from', 'with', 'and', 'the'])
        
        # Initialize OpenAI API with optimized settings
        self.openai_model = "gpt-3.5-turbo"
        self.openai_temperature = 0.2  # Lower temperature for more consistent results
        self.openai_max_tokens = 100   # Limit tokens for faster response
        
        # System prompt for OpenAI
        self.system_prompt = """You are a shopping item analyzer. Extract the following information from the given text:
1. Item name (main product)
2. Brand name (if mentioned)
3. Priority level (HIGH, MEDIUM, or LOW)
4. Additional details or specifications

Return the information in this exact JSON format:
{
  "itemName": "product name",
  "brand": "brand name or empty string",
  "priority": "HIGH/MEDIUM/LOW",
  "details": "additional details or empty string"
}"""

    def extract_brand(self, text):
        """Extract brand name using regex pattern."""
        match = self.brand_pattern.search(text)
        if match:
            return match.group(1).strip()
        return ""

    def extract_details(self, text):
        """Extract additional details using regex pattern."""
        # First, remove any priority phrases
        text_without_priority = self.priority_pattern.sub('', text)
        
        match = self.details_pattern.search(text_without_priority)
        if match:
            details = match.group(1).strip()
            if details.endswith('.'):
                details = details[:-1]
            return details
        return ""

    def extract_item_name(self, text, quantity_unit_match=None):
        """Extract item name using regex patterns."""
        # Remove quantity and unit if present
        if quantity_unit_match:
            text = text.replace(quantity_unit_match['matched_text'], '').strip()
        
        # Remove brand if present
        brand_match = self.brand_pattern.search(text)
        if brand_match:
            text = text.replace(brand_match.group(0), '').strip()
        
        # Remove priority phrase if present
        text = self.priority_pattern.sub('', text)
        
        # Remove details if present
        text = self.details_pattern.sub('', text)
        
        # Remove connecting words
        for word in self.connecting_words:
            text = re.sub(fr'\b{word}\b', ' ', text, flags=re.IGNORECASE)
        
        # Clean up spaces and remove trailing period
        text = ' '.join(text.split()).strip()
        if text.endswith('.'):
            text = text[:-1]
        
        return text

    @lru_cache(maxsize=100)
    def analyze_with_openai(self, text):
        """Analyze text using OpenAI API with caching for repeated queries."""
        try:
            start_time = time.time()
            
            response = client.chat.completions.create(
                model=self.openai_model,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": text}
                ],
                temperature=self.openai_temperature,
                max_tokens=self.openai_max_tokens
            )
            
            # Log performance metrics
            elapsed_time = time.time() - start_time
            print(f"OpenAI API call took {elapsed_time:.2f} seconds")
            
            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI API error: {e}")
            return None

    def extract_quantity_and_unit(self, text):
        """Extract quantity and unit using compiled regex pattern."""
        match = self.quantity_unit_pattern.search(text)
        if match:
            quantity = match.group(1)
            raw_unit = match.group(2).lower()
            
            # Find standardized unit
            for std_unit, variations in self.units.items():
                if raw_unit in variations:
                    return {
                        'quantity': quantity,
                        'unit': std_unit,
                        'matched_text': match.group(0)
                    }
        
        return None

    def determine_priority(self, text):
        """Determine priority level using weighted keyword matching."""
        # First check for explicit priority phrases
        priority_match = self.priority_pattern.search(text)
        if priority_match:
            priority_word = priority_match.group(1).upper()
            if priority_word == 'URGENT':
                return 'HIGH'
            if priority_word == 'NORMAL':
                return 'MEDIUM'
            return priority_word
        
        # Fall back to weighted keyword matching
        text = text.lower()
        scores = {level: 0 for level in self.priorities}
        
        for level, info in self.priorities.items():
            for keyword in info['keywords']:
                if keyword in text:
                    scores[level] += info['weight']
        
        # Find the highest scoring priority
        max_score = max(scores.values())
        if max_score > 0:
            for level, score in scores.items():
                if score == max_score:
                    return level
        
        return 'MEDIUM'  # Default priority

    def parse_text(self, text):
        """Parse text using a combination of regex and OpenAI for optimal performance."""
        start_time = time.time()
        
        # Start with regex-based extraction (fast)
        result = {
            'quantity': '',
            'unit': '',
            'itemName': '',
            'brand': '',
            'priority': 'MEDIUM',
            'details': '',
            'description': text
        }
        
        # Extract quantity and unit using regex (fast)
        quantity_unit = self.extract_quantity_and_unit(text)
        if quantity_unit:
            result['quantity'] = quantity_unit['quantity']
            result['unit'] = quantity_unit['unit']
        
        # Extract brand using regex (fast)
        result['brand'] = self.extract_brand(text)
        
        # Extract item name using regex (fast)
        result['itemName'] = self.extract_item_name(text, quantity_unit)
        
        # Extract details using regex (fast)
        result['details'] = self.extract_details(text)
        
        # Determine priority using keyword matching (fast)
        result['priority'] = self.determine_priority(text)
        
        # Try to use OpenAI for advanced understanding (if available)
        openai_response = self.analyze_with_openai(text)
        if openai_response:
            try:
                openai_data = json.loads(openai_response)
                
                # Update result with OpenAI data, preserving regex-extracted values
                if not result['itemName'] and 'itemName' in openai_data and openai_data['itemName']:
                    result['itemName'] = openai_data['itemName']
                
                if not result['brand'] and 'brand' in openai_data and openai_data['brand']:
                    result['brand'] = openai_data['brand']
                
                if not result['details'] and 'details' in openai_data and openai_data['details']:
                    result['details'] = openai_data['details']
                
                # Only update priority if OpenAI found one and regex didn't find a strong match
                if result['priority'] == 'MEDIUM' and 'priority' in openai_data and openai_data['priority']:
                    result['priority'] = openai_data['priority']
                
            except json.JSONDecodeError:
                print("Failed to parse OpenAI response as JSON")
        
        # Log performance metrics
        elapsed_time = time.time() - start_time
        print(f"Total processing took {elapsed_time:.2f} seconds")
        
        return result

# Initialize the parser
shopping_parser = ShoppingItemParser()

def analyze_text(text):
    """Main function to analyze shopping item text."""
    return shopping_parser.parse_text(text)

if __name__ == '__main__':
    # Test with various examples
    test_cases = [
        "3 packets pasta from Italian Delight with medium priority and make sure they are whole wheat.",
        "2 liters of milk from Farm Fresh with high priority.",
        "1 kg rice from Basmati with low priority.",
        "5 pcs apples from Fresh Farms with urgent priority."
    ]
    
    for text in test_cases:
        print(f"\nAnalyzing: {text}")
        result = analyze_text(text)
        print(f"Result: {json.dumps(result, indent=2)}")
