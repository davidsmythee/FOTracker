# Firebase Setup Instructions

Follow these steps to connect your Face-Off Tracker to Firebase:

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name: `face-off-tracker` (or your preferred name)
4. (Optional) Enable Google Analytics
5. Click "Create project"

## Step 2: Register Your Web App

1. In your Firebase project, click the **Web icon** (`</>`) to add a web app
2. App nickname: `Face-Off Tracker Web`
3. Check "Also set up Firebase Hosting" (optional)
4. Click "Register app"
5. Copy the `firebaseConfig` object shown

## Step 3: Update firebase-config.js

1. Open `firebase-config.js` in your project
2. Replace the `firebaseConfig` object with your copied config:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

## Step 4: Enable Authentication

1. In Firebase Console, go to **Build** > **Authentication**
2. Click "Get started"
3. Click on **Sign-in method** tab
4. Enable "Google" provider:
   - Click "Google"
   - Toggle "Enable"
   - Add support email (your email)
   - Click "Save"

## Step 5: Set Up Firestore Database

1. In Firebase Console, go to **Build** > **Firestore Database**
2. Click "Create database"
3. Select "Start in **production mode**" (we'll update rules next)
4. Choose your Firestore location (select closest to you)
5. Click "Enable"

## Step 6: Configure Firestore Security Rules

1. Go to **Firestore Database** > **Rules** tab
2. Replace the default rules with these:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click "Publish"

## Step 7: Test Your Setup

1. Open `index.html` in your browser
2. You should see the sign-in screen
3. Click "Sign in with Google"
4. Grant permissions
5. You should now see the app with your profile in the header

## Troubleshooting

### "Firebase: Error (auth/unauthorized-domain)"
- Go to Authentication > Settings > Authorized domains
- Add your domain (e.g., `localhost` for local testing)

### Data not syncing
- Check browser console for errors
- Verify Firestore rules are published
- Check that you're signed in

### Can't sign in
- Verify Google sign-in is enabled in Authentication
- Check that you have a support email set
- Try a different browser or clear cache

## Firebase Free Tier Limits

Your app will work perfectly within Firebase's free tier:
- **Authentication**: Unlimited
- **Firestore Reads**: 50,000/day (you'll use ~100/day)
- **Firestore Writes**: 20,000/day (you'll use ~50/day)
- **Storage**: 1 GB (your data is ~1-5 MB)

## Data Structure

Your data will be organized in Firestore as:
```
users/
  {userId}/
    games/
      {gameId}/
        - opponent, date, notes, pins, roster
    players/
      {playerId}/
        - name, number, team
```

## Next Steps

Once Firebase is configured, your data will:
- ✅ Automatically sync across all devices
- ✅ Be backed up in the cloud
- ✅ Work offline (with sync when reconnected)
- ✅ Be accessible from any browser where you sign in

