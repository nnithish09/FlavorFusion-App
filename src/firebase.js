import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
const e = import.meta.env;
const app = initializeApp({
  apiKey: e.VITE_FIREBASE_API_KEY, authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: e.VITE_FIREBASE_PROJECT_ID, storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: e.VITE_FIREBASE_APP_ID,
  ...(e.VITE_FIREBASE_MEASUREMENT_ID && { measurementId: e.VITE_FIREBASE_MEASUREMENT_ID }),
});
export const auth = getAuth(app);
export const db = getFirestore(app);
export const google = new GoogleAuthProvider();
