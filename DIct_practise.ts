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

        # Function to determine priority based on keywords in the text
        print(a.keys)