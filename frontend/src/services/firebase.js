// DripRig Firebase Service
// Handles Authentication and Firestore database operations.
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyADjg37WfsGrCpdawX2dhBL_TmO5DIfmHQ",
  authDomain: "driprig210.firebaseapp.com",
  projectId: "driprig210",
  storageBucket: "driprig210.firebasestorage.app",
  messagingSenderId: "604118912195",
  appId: "1:604118912195:web:07458d275ed0d587f4e676",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ------------------------------------------------------------------
// AUTHENTICATION
// ------------------------------------------------------------------

/** Listen for auth state changes. Calls callback with the user object or null. */
export function initAuth(onUserChanged) {
  return onAuthStateChanged(auth, (user) => onUserChanged(user));
}

/** Get the current user's Firebase ID token to authenticate API calls. */
export async function getUserToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}

/** Sign in with Google popup. */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

/** Register with email and password. */
export async function registerWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred.user;
}

/** Sign in with email and password. */
export async function signInWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/** Sign out the current user. */
export async function signOut() {
  await fbSignOut(auth);
}

/** Returns true if the current user has the admin custom claim. */
export async function isCurrentUserAdmin() {
  const user = auth.currentUser;
  if (!user) return false;
  const token = await user.getIdTokenResult();
  return token.claims.admin === true;
}

// ------------------------------------------------------------------
// HELPERS — attach token to every API request
// ------------------------------------------------------------------

/**
 * Wrapper around fetch() that automatically attaches the Firebase ID token.
 * Use this instead of raw fetch() for all /api/* calls.
 *
 * Example:
 *   const res = await authFetch('/api/generate', { method: 'POST', body: ... });
 */
export async function authFetch(url, options = {}) {
  const token = await getUserToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export { auth, db };

