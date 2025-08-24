# Firebase Firestore Integration for BracesCareBot

## Overview
Your BracesCareBot now supports persistent chat history using Firebase Firestore. Users can have their conversations saved to the cloud and restored when they return.

## Firestore Schema

### Collection: `messages`
Each document contains:
- **userId** (string): User identifier (currently "demoUser", expandable for multi-user)
- **sender** (string): Either "user" or "bot"  
- **text** (string): The message content
- **timestamp** (serverTimestamp): Auto-generated Firebase timestamp

Example document:
```json
{
  "userId": "demoUser",
  "sender": "user", 
  "text": "How do I clean my braces?",
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

## Environment Variables for Render Deployment

Set these environment variables in your Render dashboard:

### Required for Firestore (Optional - app works without these)
- `GOOGLE_CLOUD_PROJECT`: Your Firebase project ID (e.g., "bracescarebot-123")

### Frontend Firebase Config (Optional - for real-time updates)
- `FIREBASE_API_KEY`: Your Firebase API key
- `FIREBASE_AUTH_DOMAIN`: Your Firebase auth domain (e.g., "bracescarebot-123.firebaseapp.com")
- `FIREBASE_PROJECT_ID`: Same as GOOGLE_CLOUD_PROJECT
- `FIREBASE_STORAGE_BUCKET`: Your Firebase storage bucket
- `FIREBASE_MESSAGING_SENDER_ID`: Your Firebase messaging sender ID
- `FIREBASE_APP_ID`: Your Firebase app ID

### How to Get Firebase Configuration

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Create a Project** or select existing project
3. **Enable Firestore**: Go to "Firestore Database" → "Create database"
4. **Get Config Values**: 
   - Click the gear icon → "Project settings"
   - Scroll down to "Your apps" section
   - Click "Web" icon to add a web app
   - Copy the config values

## Deployment Steps

### 1. Update Render Environment Variables
Add the Firebase variables listed above to your Render web service environment variables.

### 2. Deploy Updated Code
Your updated code includes:
- Language detection (responds in user's language)
- Firebase Firestore integration
- Removed animations for cleaner UI
- Real-time chat history persistence

### 3. Firestore Security Rules (Important!)
In Firebase Console, set these Firestore rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /messages/{document} {
      allow read, write: if true; // For demo - restrict in production
    }
  }
}
```

**Production Note**: Replace `if true` with proper authentication rules when implementing user accounts.

## How It Works

### Without Firebase Configuration
- Chat history saves to browser's localStorage
- Works perfectly for single-user experience
- History persists across browser sessions

### With Firebase Configuration  
- Each message automatically saves to Firestore
- Chat history loads from Firestore on page refresh
- Supports multiple devices for same user
- Ready for multi-user expansion

## Testing

1. **Deploy without Firebase**: App works with localStorage
2. **Add Firebase config**: Messages start saving to Firestore
3. **Test persistence**: Refresh page, history should load from Firestore
4. **Language test**: Type in isiZulu/isiXhosa, bot should respond in same language

## Multi-User Ready Architecture

Current implementation uses `userId: "demoUser"` but the code is structured to easily add:
- Firebase Authentication
- User registration/login
- Per-user chat history
- User profiles

## Support

The app gracefully degrades:
- If Firestore fails → falls back to localStorage
- If Firebase config missing → uses localStorage only
- All core features work regardless of Firebase status

Your BracesCareBot is now production-ready with persistent chat history! 🚀