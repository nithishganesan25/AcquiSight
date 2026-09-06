/**
 * firebase.ts
 * ===========
 * Firebase Authentication & Firestore Service for AcquiSight AI.
 * Handles official officer authentication via Google OAuth.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const cleanEnv = (val?: string) => (val || "").replace(/^["']|["']$/g, "").trim();

const rawApiKey = cleanEnv(import.meta.env.VITE_FIREBASE_API_KEY);
const isFirebaseConfigured = Boolean(
  rawApiKey &&
  rawApiKey !== "AIzaSyDemoKeyAcquiSight2026" &&
  rawApiKey.length > 10
);

const firebaseConfig = {
  apiKey: rawApiKey || "AIzaSyDemoKeyAcquiSight2026",
  authDomain: cleanEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || "acquisight-ai.firebaseapp.com",
  projectId: cleanEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID) || "acquisight-ai",
  storageBucket: cleanEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || "acquisight-ai.appspot.com",
  messagingSenderId: cleanEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || "1029384756",
  appId: cleanEnv(import.meta.env.VITE_FIREBASE_APP_ID) || "1:1029384756:web:acquisight2026",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

try {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });
} catch (err) {
  console.error("[Firebase] Initialization error:", err);
}

export { app, auth, db, googleProvider, isFirebaseConfigured };
