import os
import json
import logging
import base64
import io
from flask import Flask, request, jsonify, render_template, send_from_directory
try:
    from google import genai
except ImportError:
    # Handle import error gracefully
    genai = None
from google.genai import types
# Firebase Admin SDK removed - using frontend Firebase Web SDK instead
from datetime import datetime
from PIL import Image

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

# Initialize Gemini client
gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", "default_key"))

# Initialize Firestore (optional) - For production, disable backend Firestore
# The frontend will handle Firestore directly via Firebase Web SDK
firestore_enabled = False
db = None
logging.info("Backend Firestore disabled - using frontend Firebase Web SDK for chat history")

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

def detect_language(text):
    """Simple language detection based on common patterns"""
    text_lower = text.lower()
    
    # isiZulu patterns
    if any(word in text_lower for word in ['ngiyabonga', 'sawubona', 'yebo', 'cha', 'kanjani', 'ngicela', 'amazinyo', 'ukudla']):
        return 'isiZulu'
    
    # isiXhosa patterns  
    if any(word in text_lower for word in ['enkosi', 'molo', 'ewe', 'hayi', 'kunjani', 'ndicela', 'amazinyo', 'ukutya']):
        return 'isiXhosa'
    
    # Afrikaans patterns
    if any(word in text_lower for word in ['dankie', 'hallo', 'ja', 'nee', 'hoe gaan dit', 'asseblief', 'tande', 'eet']):
        return 'Afrikaans'
    
    # Sesotho patterns
    if any(word in text_lower for word in ['kea leboha', 'dumela', 'ee', 'tjhe', 'ho joang', 'ke kopa', 'meno', 'ho ja']):
        return 'Sesotho'
    
    # Default to English
    return 'English'

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

def process_image(image_data):
    """Process base64 image data for Gemini API"""
    try:
        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        
        # Verify it's a valid image
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()
        
        return image_bytes
    except Exception as e:
        logging.error(f"Image processing error: {e}")
        return None

def generate_gemini_response(user_message, knowledge_info, red_flags, image_data=None):
    """Generate response using Gemini API with emoji support, image analysis, and language awareness"""
    try:
        # Detect user language for response
        user_language = detect_language(user_message)
        
        # Construct system prompt with emoji support and language awareness
        system_prompt = f"""You are BracesCareBot, a helpful and cautious assistant providing orthodontic care advice.
        
        CRITICAL: The user is communicating in {user_language}. You MUST respond in the same language ({user_language}) that the user used.
        
        IMPORTANT GUIDELINES:
        - Always respond in {user_language} - the same language the user used
        - Always be supportive and encouraging 😊
        - Provide helpful, evidence-based information
        - If you detect serious symptoms or red flags, immediately recommend seeing an orthodontist or medical professional 🚨
        - Never provide specific medical diagnoses
        - Always remind users that your advice doesn't replace professional medical care 👩‍⚕️
        - Be empathetic and understanding about orthodontic concerns
        - Use appropriate emojis occasionally to make responses friendly and engaging (1-3 per response)
        - For dental topics, use relevant emojis like 🦷, 😬, ✨, 🪥, 💙
        
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
        
        # Handle image if provided
        contents = []
        image_context = ""
        
        if image_data:
            processed_image = process_image(image_data)
            if processed_image:
                # Add image analysis context
                image_context = f"\n\nIMAGE ANALYSIS: The user has shared an image. Please analyze the image in the context of orthodontic care and provide relevant advice about what you observe in {user_language}. Look for braces, dental issues, or orthodontic appliances. Be specific about what you see and provide helpful guidance."
                
                contents = [
                    types.Part.from_bytes(
                        data=processed_image,
                        mime_type="image/jpeg"
                    ),
                    f"{system_prompt}\n\nUser question: {user_message}{kb_context}{red_flag_warning}{image_context}"
                ]
            else:
                # If image processing failed, continue without image
                contents = f"{system_prompt}\n\nUser question: {user_message}{kb_context}{red_flag_warning}"
        else:
            # No image, standard text prompt
            contents = f"{system_prompt}\n\nUser question: {user_message}{kb_context}{red_flag_warning}"
        
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=1000
            )
        )
        
        return response.text or "I apologize, but I'm having trouble generating a response right now. Please try again or contact your orthodontist if you have urgent concerns. 😔"
        
    except Exception as e:
        logging.error(f"Gemini API error: {e}")
        if red_flags:
            return "I'm experiencing technical difficulties, but I noticed you mentioned some concerning symptoms. Please contact your orthodontist or seek medical attention immediately for proper care. 🚨"
        return "I'm sorry, I'm experiencing technical difficulties right now. Please try again later or contact your orthodontist if you have urgent questions. 💙"

# Firestore operations now handled by frontend Firebase Web SDK

@app.route('/')
def index():
    """Serve the main chat interface with Firebase config"""
    # Read the HTML file and inject Firebase config
    with open('static/index.html', 'r') as f:
        html_content = f.read()
    
    # Inject Firebase configuration from environment variables
    firebase_config = {
        'apiKey': os.environ.get('FIREBASE_API_KEY', ''),
        'authDomain': os.environ.get('FIREBASE_AUTH_DOMAIN', ''),
        'projectId': os.environ.get('GOOGLE_CLOUD_PROJECT', ''),
        'storageBucket': os.environ.get('FIREBASE_STORAGE_BUCKET', ''),
        'messagingSenderId': os.environ.get('FIREBASE_MESSAGING_SENDER_ID', ''),
        'appId': os.environ.get('FIREBASE_APP_ID', '')
    }
    
    # Replace the Firebase config placeholder in HTML
    config_script = f"""
        window.FIREBASE_API_KEY = "{firebase_config['apiKey']}";
        window.FIREBASE_AUTH_DOMAIN = "{firebase_config['authDomain']}";
        window.FIREBASE_PROJECT_ID = "{firebase_config['projectId']}";
        window.FIREBASE_STORAGE_BUCKET = "{firebase_config['storageBucket']}";
        window.FIREBASE_MESSAGING_SENDER_ID = "{firebase_config['messagingSenderId']}";
        window.FIREBASE_APP_ID = "{firebase_config['appId']}";
    """
    
    # Inject the script before the Firebase configuration script
    html_content = html_content.replace(
        '// Firebase configuration - will be set via environment variables',
        config_script + '\n        // Firebase configuration - will be set via environment variables'
    )
    
    return html_content

@app.route('/static/<path:filename>')
def static_files(filename):
    """Serve static files"""
    return send_from_directory('static', filename)

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat messages with optional image support"""
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400
        
        user_message = data['message'].strip()
        consent = data.get('consent', False)
        image_data = data.get('image', None)  # Base64 encoded image
        
        if not user_message:
            return jsonify({'error': 'Message cannot be empty'}), 400
        
        # Check for red flags
        red_flags = check_red_flags(user_message)
        
        # Search knowledge base
        knowledge_info = search_knowledge_base(user_message)
        
        # Generate response (with image support and language awareness)
        bot_response = generate_gemini_response(user_message, knowledge_info, red_flags, image_data)
        
        # Note: Chat history is now handled by frontend Firebase Web SDK
        
        return jsonify({
            'response': bot_response,
            'red_flags': red_flags,
            'knowledge_used': len(knowledge_info) > 0,
            'image_analyzed': image_data is not None
        })
        
    except Exception as e:
        logging.error(f"Chat endpoint error: {e}")
        return jsonify({'error': 'An error occurred processing your message. Please try again. 😔'}), 500

# Chat history endpoint removed - handled by frontend Firebase Web SDK

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)