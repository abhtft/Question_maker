from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv
import pytz
import openai
import json
from bson import ObjectId
import httpx
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import boto3
from botocore.exceptions import ClientError
import io

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

# Initialize MongoDB with configurable database and collections
try:
    MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
    DB_NAME = os.getenv('DB_NAME', 'question_paper_db')
    REQUEST_COLLECTION = os.getenv('REQUEST_COLLECTION', 'question_requests')
    PAPER_COLLECTION = os.getenv('PAPER_COLLECTION', 'question_papers')
    FEEDBACK_COLLECTION = os.getenv('FEEDBACK_COLLECTION', 'paper_feedback')
    
    client = MongoClient(MONGODB_URI)
    db = client[DB_NAME]
    requests_collection = db[REQUEST_COLLECTION]
    papers_collection = db[PAPER_COLLECTION]
    feedback_collection = db[FEEDBACK_COLLECTION]
    print("✅ MongoDB Connection Successful!")
except Exception as e:
    print("❌ MongoDB Connection Error:", e)
    db = None

# Initialize OpenAI client
try:
    http_client = httpx.Client(
        base_url="https://api.openai.com/v1",
        timeout=60.0,
        follow_redirects=True
    )
    
    openai_client = openai.OpenAI(
        api_key=os.getenv('OPENAI_API_KEY'),
        http_client=http_client
    )
    print("✅ OpenAI client initialized successfully")
except Exception as e:
    print(f"❌ Error initializing OpenAI client: {e}")
    raise

# Initialize AWS S3 client
try:
    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'us-east-1')
    )
    S3_BUCKET = os.getenv('S3_BUCKET_NAME')
    print("✅ AWS S3 Connection Successful!")
except Exception as e:
    print("❌ AWS S3 Connection Error:", e)
    s3_client = None

def get_feedback_context(paper_id):
    """Get relevant feedback for a paper to improve question generation"""
    try:
        feedback = list(feedback_collection.find(
            {'paper_id': paper_id},
            {'_id': 0, 'feedback': 1, 'suggestions': 1}
        ))
        if feedback:
            feedback_text = "\n".join([
                f"Feedback: {f['feedback']}\nSuggestions: {f['suggestions']}"
                for f in feedback
            ])
            return f"\nPrevious feedback to consider:\n{feedback_text}"
        return ""
    except Exception as e:
        print(f"Error getting feedback: {e}")
        return ""
    


def generate_question_prompt(topic_data, paper_id=None):
    feedback_context = get_feedback_context(paper_id) if paper_id else ""
    
    return f"""You are an expert educator tasked to create questions.

Generate {topic_data['numQuestions']} {topic_data['questionType']} questions for:

- Subject: {topic_data['subjectName']}
- Class/Grade: {topic_data['classGrade']}
- Topic: {topic_data['sectionName']}
- Difficulty Level: {topic_data['difficulty']}
- Bloom's Taxonomy Level: {topic_data['bloomLevel']}
- Intelligence Type: {topic_data['intelligenceType']}
- Intelligence SubType: {topic_data.get('intelligenceSubType', 'General')}


Additional Instructions: {topic_data['additionalInstructions']}

{feedback_context}

🔵 Strict Requirements:
1. Match exactly the specified difficulty and Bloom's level.
2. Test deep conceptual understanding, not rote memorization (unless instructed).
3. Use technical language appropriate for Class {topic_data['classGrade']} level.
4. Follow the {topic_data['questionType']} format precisely.
5. If MCQ:
    - Provide exactly 4 options.
    - Ensure all options are realistic, meaningful, and non-trivial (no obviously wrong answers).
6. For each question, provide:
    - Clear and concise question text
    - Correct answer
    - Step-by-step detailed explanation (why the correct answer is correct and why others are wrong, if relevant)
7. Avoid ambiguity or overlaps in options or question phrasing.
8. Do not repeat or slightly vary questions.
9. Incorporate feedback (if provided).

🟢 Output Format (strictly JSON):
Example:
{{
  "questions": [
    {{
      "question": "What is the capital of France?",
      "options": ["Berlin", "London", "Paris", "Rome"],
      "answer": "Paris",
      "explanation": "Paris is the capital and most populous city of France."
    }}
  ]
}}
"""

def create_pdf(questions, filename):
    # Create PDF in memory
    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    # Add title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=30
    )
    story.append(Paragraph("Question Paper", title_style))
    story.append(Spacer(1, 12))
    
    # Add questions
    for i, topic in enumerate(questions, 1):
        # Add topic header
        story.append(Paragraph(f"Topic {i}: {topic['topic']}", styles['Heading2']))
        story.append(Spacer(1, 12))
        
        # Add questions
        for j, q in enumerate(topic['questions'], 1):
            story.append(Paragraph(f"Q{j}. {q['question']}", styles['Normal']))
            if 'options' in q:
                for opt in q['options']:
                    story.append(Paragraph(f"   {opt}", styles['Normal']))
            story.append(Paragraph(f"Answer: {q['answer']}", styles['Normal']))
            story.append(Paragraph(f"Explanation: {q['explanation']}", styles['Normal']))
            story.append(Spacer(1, 12))
    
    doc.build(story)
    pdf_buffer.seek(0)
    return pdf_buffer

@app.route('/')
def serve():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/generate-questions', methods=['POST'])
def generate_questions():
    try:
        print("Received request at /api/generate-questions")
        data = request.json
        print("Request data:", data)

        # Save request to MongoDB
        data['created_at'] = datetime.now(pytz.timezone('Asia/Kolkata')).strftime('%Y-%m-%d %H:%M:%S')
        request_id = requests_collection.insert_one(data).inserted_id
        print("Inserted request with ID:", request_id)

        # Get previous paper ID if provided (for feedback consideration)
        previous_paper_id = data.get('previous_paper_id')

        # Generate questions for each topic
        all_questions = []
        for topic in data['topics']:
            topic_data = {
                **topic,
                'subjectName': data['subjectName'],
                'classGrade': data['classGrade']
            }
            prompt = generate_question_prompt(topic_data, previous_paper_id)
            print("Prompt:", prompt)

            response = openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert educational question generator."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            print("OpenAI response:", response)

            questions = json.loads(response.choices[0].message.content)
            all_questions.append({
                'topic': topic['sectionName'],
                'questions': questions['questions']
            })

        # Save generated questions to MongoDB
        paper_data = {
            'request_id': str(request_id),
            'questions': all_questions,
            'created_at': datetime.now(pytz.timezone('Asia/Kolkata')).strftime('%Y-%m-%d %H:%M:%S'),
            'previous_paper_id': previous_paper_id  # Store reference to previous paper for feedback tracking
        }
        paper_id = papers_collection.insert_one(paper_data).inserted_id
        print("Inserted paper with ID:", paper_id)

        # Generate PDF and upload to S3
        pdf_filename = f"question_paper_{paper_id}.pdf"
        pdf_buffer = create_pdf(all_questions, pdf_filename)
        
        # Upload to S3
        try:
            s3_client.upload_fileobj(
                pdf_buffer,
                S3_BUCKET,
                pdf_filename,
                ExtraArgs={'ContentType': 'application/pdf'}
            )
            print(f"PDF uploaded to S3: {pdf_filename}")
        except Exception as e:
            print(f"Error uploading PDF to S3: {e}")
            raise

        # Generate pre-signed URL for download
        try:
            url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': S3_BUCKET,
                    'Key': pdf_filename
                },
                ExpiresIn=3600  # URL expires in 1 hour
            )
        except Exception as e:
            print(f"Error generating pre-signed URL: {e}")
            url = None

        return jsonify({
            'success': True,
            'paper_id': str(paper_id),
            'questions': all_questions,
            'pdf_url': url
        })

    except Exception as e:
        print("Error in /api/generate-questions:", str(e))
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/download-pdf/<paper_id>', methods=['GET'])
def download_pdf(paper_id):
    try:
        filename = f"question_paper_{paper_id}.pdf"
        # Generate a pre-signed URL for the S3 object
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': S3_BUCKET,
                'Key': filename
            },
            ExpiresIn=3600  # URL expires in 1 hour
        )
        return jsonify({
            'success': True,
            'url': url
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/requests', methods=['GET'])
def get_requests():
    try:
        requests = list(requests_collection.find({}, {'_id': 1, 'created_at': 1, 'subjectName': 1, 'classGrade': 1}))
        for req in requests:
            req['_id'] = str(req['_id'])
        return jsonify(requests)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/papers', methods=['GET'])
def get_papers():
    try:
        papers = list(papers_collection.find({}, {'_id': 1, 'created_at': 1, 'request_id': 1}))
        for paper in papers:
            paper['_id'] = str(paper['_id'])
        return jsonify(papers)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/submit-feedback', methods=['POST'])
def submit_feedback():
    try:
        data = request.json
        paper_id = data.get('paper_id')
        feedback = data.get('feedback')
        suggestions = data.get('suggestions')
        
        if not all([paper_id, feedback]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
            
        feedback_data = {
            'paper_id': paper_id,
            'feedback': feedback,
            'suggestions': suggestions,
            'created_at': datetime.now(pytz.timezone('Asia/Kolkata')).strftime('%Y-%m-%d %H:%M:%S')
        }
        
        feedback_id = feedback_collection.insert_one(feedback_data).inserted_id
        return jsonify({
            'success': True,
            'feedback_id': str(feedback_id)
        })
        
    except Exception as e:
        print("Error in /api/submit-feedback:", str(e))
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/get-feedback/<paper_id>', methods=['GET'])
def get_feedback(paper_id):
    try:
        feedback = list(feedback_collection.find(
            {'paper_id': paper_id},
            {'_id': 0, 'feedback': 1, 'suggestions': 1, 'created_at': 1}
        ))
        return jsonify({
            'success': True,
            'feedback': feedback
        })
    except Exception as e:
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
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Server starting on http://localhost:{port}")
    print(f"📁 Serving static files from: {os.path.abspath(app.static_folder)}")
    app.run(
        host='0.0.0.0',
        port=port,
        debug=True
    )