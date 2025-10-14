# Face-Off Tracker - Firebase Integration

## 🚀 Quick Start

Your Face-Off Tracker is now ready for Firebase integration! Follow these steps to get cloud sync working.

## What You've Got

✅ Authentication UI with Google Sign-in  
✅ User profile display with avatar  
✅ Sync status indicators  
✅ Firebase SDK configured  
✅ Security rules ready  

## What You Need To Do

### 1. Create Your Firebase Project (5 minutes)

1. Visit: https://console.firebase.google.com/
2. Click "Create a project"
3. Name it: `face-off-tracker`
4. Follow the wizard (you can skip Analytics)

### 2. Get Your Firebase Config

1. In your Firebase project dashboard, click the **Web icon** (`</>`)
2. Register app nickname: `Face-Off Tracker`
3. Copy the `firebaseConfig` object

### 3. Update firebase-config.js

Open `firebase-config.js` and replace this section:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",  // Replace with your actual values
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 4. Enable Google Authentication

1. Firebase Console > Build > **Authentication**
2. Click "Get started"
3. Click "Sign-in method" tab
4. Enable **Google** provider
5. Add your support email
6. Save

### 5. Create Firestore Database

1. Firebase Console > Build > **Firestore Database**
2. Click "Create database"
3. Choose "Start in production mode"
4. Select your region (closest to you)
5. Click "Enable"

### 6. Add Security Rules

1. Go to Firestore Database > **Rules** tab
2. Paste these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click "Publish"

### 7. Authorize Your Domain

1. Authentication > Settings > **Authorized domains**
2. Add `localhost` (for local testing)
3. Add your production domain when you deploy

## 🎯 Current Status

**What's Working:**
- ✅ UI is ready with auth overlay
- ✅ Sign-in/sign-out buttons configured
- ✅ User profile display
- ✅ Sync status indicators

**What's Next:**
The full Firebase data layer integration requires:
- Converting localStorage operations to Firestore
- Real-time sync listeners
- Offline capability
- Data migration tool

**Want me to complete the full integration?**

I can implement:
1. Firebase data service layer
2. Real-time sync across devices
3. Migrate existing localStorage data to Firebase
4. Offline support with auto-sync
5. Error handling and recovery

This will take about 500-1000 more lines of code but will give you a production-ready cloud-synced app.

## Testing Without Firebase (Optional)

If you want to test the current app without Firebase first:
1. Comment out line 239-240 in `index.html` (the Firebase scripts)
2. The app will work as before with localStorage
3. Re-enable when you're ready for Firebase

## Firebase Free Tier

Your usage will be well within free limits:
- 50,000 reads/day (you'll use ~100)
- 20,000 writes/day (you'll use ~50)  
- Unlimited authentication
- 1 GB storage (you'll use ~1-5 MB)

## Need Help?

Common issues and solutions in `FIREBASE_SETUP.md`

---

**Ready to continue with full Firebase integration?** Let me know and I'll implement the complete data layer!

