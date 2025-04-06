
a = {
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

scores = {}
for level, priority_info in a.items():
    score = self._get_priority_score(text, priority_info['keywords'])
    scores[level] = score
    print(f"Priority {priority_info['display']} score: {score}")