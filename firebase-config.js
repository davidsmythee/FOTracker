// Firebase Configuration and Initialization
// Replace these values with your Firebase project credentials from the Firebase Console
// (https://console.firebase.google.com/)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAzXhKB1LX201OR5HUyC0zIo8mMNiL_1mc",
    authDomain: "faceoff-tracker-51d65.firebaseapp.com",
    projectId: "faceoff-tracker-51d65",
    storageBucket: "faceoff-tracker-51d65.firebasestorage.app",
    messagingSenderId: "950435119285",
    appId: "1:950435119285:web:fa4ca42ee2ab339b887efc",
    measurementId: "G-MM5YBEYCLD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Export Firebase services
export {
    auth,
    db,
    googleProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where
};

