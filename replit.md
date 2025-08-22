# BracesCareBot

## Overview

BracesCareBot is a web-based orthodontic care assistant that provides AI-powered guidance for patients with braces and other orthodontic treatments. The application combines a Flask backend with Google's Gemini AI model to deliver personalized advice based on a curated knowledge base of orthodontic care information. The bot includes safety features to identify medical emergencies and can optionally store chat history in Firestore for improved user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Single-Page Application**: Built with vanilla HTML, CSS, and JavaScript without complex frameworks
- **Bootstrap Integration**: Uses Bootstrap for responsive design and dark theme support
- **Real-time Chat Interface**: Provides a conversational UI with user/bot message distinction
- **Local Storage**: Implements client-side chat history persistence
- **Progressive Enhancement**: Includes character counting, auto-resize input, and loading indicators

### Backend Architecture
- **Flask Web Framework**: Lightweight Python web server handling HTTP requests
- **RESTful API Design**: Primary `/chat` endpoint accepts POST requests with JSON payloads
- **Knowledge Base Integration**: Loads orthodontic information from local JSON file (`kb/ortho_kb.json`)
- **Safety Filter System**: Implements red-flag keyword detection for medical emergencies
- **Prompt Engineering**: Constructs detailed prompts combining knowledge base content with system instructions

### AI Integration
- **Google Gemini API**: Primary AI model for generating orthodontic care responses
- **Context-Aware Responses**: Incorporates relevant knowledge base sections into AI prompts
- **Safety-First Approach**: Programmed to provide cautious medical advice and recommend professional consultation

### Data Storage
- **Firestore Integration**: Optional cloud database for chat history storage
- **Graceful Degradation**: Application functions without database if Firestore is unavailable
- **Consent-Based Storage**: Only saves chat data when user explicitly provides consent
- **Local Knowledge Base**: JSON file containing structured orthodontic care information

### Security and Safety
- **Medical Safety Filters**: Monitors for emergency keywords requiring immediate medical attention
- **Environment-Based Configuration**: Uses environment variables for sensitive credentials
- **User Consent Management**: Implements explicit consent mechanism for data storage
- **Professional Disclaimer**: Clearly communicates limitations and encourages professional consultation

## External Dependencies

### AI Services
- **Google Gemini API**: Core AI functionality for generating responses
- **google-generativeai**: Python client library for Gemini integration

### Cloud Services
- **Google Firestore**: NoSQL document database for chat history storage
- **Firebase Admin SDK**: Server-side Firebase integration for secure database access

### Frontend Libraries
- **Bootstrap 5**: CSS framework for responsive design and dark theme
- **Font Awesome**: Icon library for UI enhancement

### Python Dependencies
- **Flask**: Web framework for HTTP server functionality
- **firebase-admin**: Google Cloud Firestore integration
- **google-generativeai**: Google AI model integration

### Development Tools
- **Environment Variables**: Configuration management for API keys and secrets
- **JSON**: Knowledge base storage and API communication format
- **Logging**: Built-in Python logging for debugging and monitoring