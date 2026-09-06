/**
 * auth-context.tsx
 * ================
 * Context & hook for Firebase Google OAuth Officer Authentication.
 * Enforces real authentication without fake bypasses.
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "./firebase";

export interface OfficerProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  designation: string;
  department: string;
}

interface AuthContextType {
  user: User | null;
  officerProfile: OfficerProfile | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutOfficer: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          try {
            const idToken = await currentUser.getIdToken();
            setToken(idToken);
          } catch (err) {
            console.warn("Could not retrieve ID token:", err);
            setToken(null);
          }
        } else {
          setToken(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Auth state change error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      setError(
        "Firebase Authentication is not configured. Please supply valid VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID in your environment (.env)."
      );
      return;
    }

    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      const idToken = await result.user.getIdToken();
      setToken(idToken);
      setLoading(false);
    } catch (err: any) {
      console.error("Firebase Google Sign-In Error:", err);
      let msg = err.message || "Failed to sign in with Google.";
      if (err.code === "auth/popup-closed-by-user") {
        msg = "Sign-in popup was closed before completing.";
      } else if (err.code === "auth/cancelled-popup-request") {
        msg = "Popup request cancelled.";
      } else if (err.code === "auth/invalid-api-key") {
        msg = "Invalid Firebase API Key provided in environment configuration.";
      } else if (err.code === "auth/configuration-not-found") {
        msg = "Google Sign-In is not enabled yet in your Firebase Console. Go to Firebase Console -> Authentication -> Sign-in method -> Enable 'Google' and set support email.";
      } else if (err.code === "auth/unauthorized-domain") {
        msg = "This domain is not authorized. Add 'localhost' to Firebase Console -> Authentication -> Settings -> Authorized domains.";
      }
      setError(msg);
      setLoading(false);
    }
  };

  const signOutOfficer = async () => {
    setError(null);
    if (!auth) return;
    try {
      await signOut(auth);
      setUser(null);
      setToken(null);
    } catch (err: any) {
      console.error("Sign-out error:", err);
      setError(err.message);
    }
  };

  const officerProfile: OfficerProfile | null = user
    ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split("@")[0] || "Officer",
        photoURL: user.photoURL,
        designation: "Land Administration Officer (Special DRO)",
        department: "Revenue & Disaster Management, Govt. of Tamil Nadu",
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        officerProfile,
        token,
        loading,
        error,
        isConfigured: isFirebaseConfigured,
        signInWithGoogle,
        signOutOfficer,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
