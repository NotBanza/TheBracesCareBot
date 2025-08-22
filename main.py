import os
import json
import logging
from flask import Flask, request, jsonify, render_template, send_from_directory
from google import genai
from google.genai import types
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

# Initialize Gemini client
gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", "default_key"))

# Initialize Firestore (optional)
try:
    if not firebase_admin._apps:
        # Initialize Firebase Admin SDK
        # In production, use service account key from environment
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    firestore_enabled = True
    logging.info("Firestore initialized successfully")
except Exception as e:
    logging.warning(f"Firestore initialization failed: {e}. Chat history will not be saved.")
    firestore_enabled = False

# Load knowledge base
def load_knowledge_base():
    try:
        with open('kb/ortho_kb.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Failed to load knowledge base: {e}")
        return {}

knowledge_base = load_knowledge_base()

# Red flag keywords for medical safety
RED_FLAG_KEYWORDS = [
    'fever', 'swelling', 'uncontrolled bleeding', 'severe pain', 
    'infection', 'pus', 'emergency', 'urgent', 'difficulty breathing',
    'difficulty swallowing', 'allergic reaction', 'rash', 'nausea',
    'vomiting', 'dizziness', 'fainting'
]

def check_red_flags(message):
    """Check if message contains red flag keywords"""
    message_lower = message.lower()
    found_flags = []
    for keyword in RED_FLAG_KEYWORDS:
        if keyword in message_lower:
            found_flags.append(keyword)
    return found_flags

def search_knowledge_base(message):
    """Search knowledge base for relevant information"""
    message_lower = message.lower()
    relevant_info = []
    
    for topic, info in knowledge_base.items():
        # Simple keyword matching - can be enhanced with more sophisticated search
        if any(keyword in message_lower for keyword in info.get('keywords', [])):
            relevant_info.append({
                'topic': topic,
                'content': info.get('content', ''),
                'tips': info.get('tips', [])
            })
    
    return relevant_info

def generate_gemini_response(user_message, knowledge_info, red_flags):
    """Generate response using Gemini API"""
    try:
        # Construct system prompt
        system_prompt = """You are BracesCareBot, a helpful and cautious assistant providing orthodontic care advice. 
        
        IMPORTANT GUIDELINES:
        - Always be supportive and encouraging
        - Provide helpful, evidence-based information
        - If you detect serious symptoms or red flags, immediately recommend seeing an orthodontist or medical professional
        - Never provide specific medical diagnoses
        - Always remind users that your advice doesn't replace professional medical care
        - Be empathetic and understanding about orthodontic concerns
        
        Use the provided knowledge base information to give accurate advice about braces, retainers, and orthodontic care."""
        
        # Prepare context from knowledge base
        kb_context = ""
        if knowledge_info:
            kb_context = "\n\nRelevant information from knowledge base:\n"
            for info in knowledge_info:
                kb_context += f"Topic: {info['topic']}\n"
                kb_context += f"Content: {info['content']}\n"
                if info['tips']:
                    kb_context += f"Tips: {', '.join(info['tips'])}\n"
                kb_context += "\n"
        
        # Add red flag warning if needed
        red_flag_warning = ""
        if red_flags:
            red_flag_warning = f"\n\nIMPORTANT: The user mentioned potentially serious symptoms: {', '.join(red_flags)}. Please prioritize recommending they contact their orthodontist or seek medical attention immediately."
        
        # Construct full prompt
        full_prompt = f"{system_prompt}\n\nUser question: {user_message}{kb_context}{red_flag_warning}"
        
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=1000
            )
        )
        
        return response.text or "I apologize, but I'm having trouble generating a response right now. Please try again or contact your orthodontist if you have urgent concerns."
        
    except Exception as e:
        logging.error(f"Gemini API error: {e}")
        if red_flags:
            return "I'm experiencing technical difficulties, but I noticed you mentioned some concerning symptoms. Please contact your orthodontist or seek medical attention immediately for proper care."
        return "I'm sorry, I'm experiencing technical difficulties right now. Please try again later or contact your orthodontist if you have urgent questions."

def save_to_firestore(user_message, bot_response):
    """Save chat interaction to Firestore"""
    if not firestore_enabled:
        return False
    
    try:
        doc_ref = db.collection('chat_history').document()
        doc_ref.set({
            'user_message': user_message,
            'bot_response': bot_response,
            'timestamp': datetime.utcnow(),
            'session_id': request.remote_addr  # Simple session identification
        })
        logging.info("Chat saved to Firestore successfully")
        return True
    except Exception as e:
        logging.error(f"Failed to save to Firestore: {e}")
        return False

@app.route('/')
def index():
    """Serve the main chat interface"""
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    """Serve static files"""
    return send_from_directory('static', filename)

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat messages"""
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400
        
        user_message = data['message'].strip()
        consent = data.get('consent', False)
        
        if not user_message:
            return jsonify({'error': 'Message cannot be empty'}), 400
        
        # Check for red flags
        red_flags = check_red_flags(user_message)
        
        # Search knowledge base
        knowledge_info = search_knowledge_base(user_message)
        
        # Generate response
        bot_response = generate_gemini_response(user_message, knowledge_info, red_flags)
        
        # Save to Firestore if consent given
        if consent and firestore_enabled:
            save_to_firestore(user_message, bot_response)
        
        return jsonify({
            'response': bot_response,
            'red_flags': red_flags,
            'knowledge_used': len(knowledge_info) > 0
        })
        
    except Exception as e:
        logging.error(f"Chat endpoint error: {e}")
        return jsonify({'error': 'An error occurred processing your message. Please try again.'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
