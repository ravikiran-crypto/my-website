# Deploy to Vercel - Quick Guide

## ✅ What I've Done:

1. Created Vercel serverless functions in `/api` folder
2. Updated configuration for Vercel deployment
3. Simplified API_BASE_URL to work automatically

---

## 🚀 Next Steps:

### **1. Add Environment Variable in Vercel Dashboard**

Go to your Vercel project: https://vercel.com/dashboard

1. Click on your project: `my-website-lemon-iota`
2. Go to **Settings** → **Environment Variables**
3. Add new variable:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** `your_gemini_api_key_here`
   - **Environment:** Check all (Production, Preview, Development)
4. Click **Save**

Add these Firebase variables too (used by `/api/runtime-config`):
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

### **2. Redeploy Your Project**

Push the new changes to your Git repository:

```bash
git add .
git commit -m "Add Vercel serverless API functions"
git push
```

Vercel will automatically redeploy with the API functions.

---

## 📁 New Files Created:

- `/api/gemini.js` - Handles `/api/gemini` endpoint
- `/api/gemini-custom.js` - Handles `/api/gemini/custom` endpoint  
- `/vercel.json` - Vercel configuration
- Updated `/api-config.js` - Simplified for Vercel

---

## ✅ After Deployment:

Your app at `https://my-website-lemon-iota.vercel.app/` will have:
- ✅ Working API endpoints at `/api/gemini` and `/api/gemini/custom`
- ✅ Secure API key (stored in Vercel environment variables)
- ✅ All features working: News, Hub Bot, Courses, Role Management

---

## 🧪 Test After Deployment:

1. Go to `https://my-website-lemon-iota.vercel.app/`
2. Login with your email
3. Try the News section (should load AI news)
4. Try Hub Bot (should respond)
5. All API features should work!

---

**Just add the environment variable and push to Git!** 🚀
