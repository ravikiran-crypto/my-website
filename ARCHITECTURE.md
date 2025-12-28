# 🏗️ Architecture Overview

## Before (❌ INSECURE)
```
┌─────────────────┐
│   Browser       │
│  (dashboard.html)│
│                 │
│ const API_KEY = │───┐  Anyone can see this
│   "exposed!"    │   │  in browser DevTools!
└─────────────────┘   │
         │            │
         ▼            │
    Direct API Call   │
         │            │
         ▼            │
┌─────────────────┐   │
│  Gemini API     │◄──┘
│  googleapis.com │
└─────────────────┘
```

## After (✅ SECURE)
```
┌─────────────────┐
│   Browser       │
│  (dashboard.html)│
│                 │
│ callGeminiAPI() │  No API key visible!
└─────────────────┘
         │
         │ Fetch to localhost:3000/api/gemini
         ▼
┌─────────────────┐
│  Your Server    │
│   (server.js)   │
│                 │
│  .env file:     │  API key stored securely
│  GEMINI_API_KEY │  Never sent to browser
└─────────────────┘
         │
         │ Server makes API call
         ▼
┌─────────────────┐
│  Gemini API     │
│  googleapis.com │
└─────────────────┘
```

---

## 🔄 Request Flow

### User asks Hub Bot a question:

1. **Browser** → Calls `callGeminiAPI("What is React?")`
2. **api-config.js** → Sends POST to `http://localhost:3000/api/gemini`
3. **server.js** → Receives request, reads `GEMINI_API_KEY` from `.env`
4. **server.js** → Calls Gemini API with the key
5. **Gemini API** → Returns AI response
6. **server.js** → Forwards response to browser
7. **Browser** → Displays answer to user

**🔒 Security:** The API key never leaves the server!

---

## 📁 File Responsibilities

### Frontend (Client-Side)
| File | Purpose |
|------|---------|
| `dashboard.html` | Main UI, calls API helper functions |
| `api-config.js` | Helper functions to call backend |
| `auth.js` | Firebase authentication |
| `login.html` | Login page |
| `course-view.html` | Course viewing page |

### Backend (Server-Side)
| File | Purpose |
|------|---------|
| `server.js` | Express server, proxies Gemini API |
| `.env` | 🔒 **SECRET** - Stores API keys |
| `package.json` | Server dependencies |

### Firebase Functions (Production Alternative)
| File | Purpose |
|------|---------|
| `functions/index.js` | Cloud Functions for Gemini API |
| `functions/package.json` | Function dependencies |
| `firebase.json` | Firebase project config |

### Security
| File | Purpose |
|------|---------|
| `.gitignore` | Prevents `.env` from being committed |

---

## 🌐 Deployment Options

### Option 1: Express Server
```
Your Code
    ↓
  GitHub (without .env)
    ↓
  Heroku/Railway/etc
    ↓
  Set GEMINI_API_KEY env var
    ↓
  Server runs on https://yourapp.com
    ↓
  Update api-config.js with production URL
```

### Option 2: Firebase Functions
```
Your Code
    ↓
  Firebase CLI
    ↓
  Set API key: firebase functions:config:set
    ↓
  Deploy: firebase deploy --only functions
    ↓
  Functions run on https://YOUR-PROJECT.cloudfunctions.net
    ↓
  Update api-config.js with Functions URL
```

---

## 🔐 Environment Variables

### Development (.env file)
```env
GEMINI_API_KEY=AIza...your_key
PORT=3000
NODE_ENV=development
```

### Production (Set on hosting platform)
```bash
# Heroku
heroku config:set GEMINI_API_KEY=your_key

# Railway
railway variables set GEMINI_API_KEY=your_key

# Firebase
firebase functions:config:set gemini.api_key=your_key
```

---

## 🎯 API Endpoints

### Local Development
| Endpoint | Method | Description |
|----------|--------|-------------|
| `http://localhost:3000/api/health` | GET | Health check |
| `http://localhost:3000/api/gemini` | POST | Simple Gemini API call |
| `http://localhost:3000/api/gemini/custom` | POST | Advanced Gemini API call |

### Firebase Functions
| Endpoint | Method | Description |
|----------|--------|-------------|
| `https://PROJECT.cloudfunctions.net/gemini` | POST | Simple Gemini API call |
| `https://PROJECT.cloudfunctions.net/geminiCustom` | POST | Advanced Gemini API call |

---

## 🔄 Configuration Changes

### Switch from Local Server to Firebase Functions:

**In api-config.js**, comment out lines 1-57 and uncomment lines 59-103:

```javascript
// Local development (COMMENT OUT for production)
/*
const API_BASE_URL = 'http://localhost:3000';
async function callGeminiAPI(prompt, model) { ... }
*/

// Firebase Functions (UNCOMMENT for production)
const FIREBASE_FUNCTIONS_URL = 'https://YOUR-PROJECT.cloudfunctions.net';
async function callGeminiAPIFirebase(prompt, model) { ... }
```

Then rename the functions in dashboard.html or create aliases.

---

## 📊 Security Comparison

| Aspect | Before | After |
|--------|--------|-------|
| API Key Visible | ✅ Yes (in browser) | ❌ No |
| Can be stolen | ✅ Yes | ❌ No |
| Git commits | ❌ Key exposed | ✅ Key in .env |
| Public deployment | ❌ Key visible | ✅ Key hidden |
| Rate limiting | ❌ User controlled | ✅ Server controlled |

---

## 🚀 Quick Commands

```bash
# Development
npm install              # Install dependencies
npm start                # Start server (production mode)
npm run dev              # Start server (dev mode with auto-reload)

# Firebase
firebase login           # Login to Firebase
firebase init            # Initialize project
firebase deploy          # Deploy functions and hosting
firebase functions:config:set gemini.api_key="KEY"  # Set API key

# Git
git status               # Check files to be committed
git add .                # Stage all files (.env will be ignored)
git commit -m "message"  # Commit changes
git push                 # Push to GitHub
```

---

See [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) for step-by-step setup guide.
