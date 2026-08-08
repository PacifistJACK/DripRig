import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBzfyOiXhCbqV3Qw-P6srvwWqt7OG7xX5k",
  authDomain: "auth.j4du.in",
  projectId: "driprig-383be",
  storageBucket: "driprig-383be.firebasestorage.app",
  messagingSenderId: "269498335034",
  appId: "1:269498335034:web:a17aa8bbd393c79e3eda03",
  measurementId: "G-W2568LWR7F"
};

// Initialize Firebase App & Services
export const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged };

// Safe Analytics initialization
export let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch(() => {});
