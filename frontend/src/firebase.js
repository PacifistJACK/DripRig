import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBzfyOiXhCbqV3Qw-P6srvwWqt7OG7xX5k",
  authDomain: "driprig-383be.firebaseapp.com",
  projectId: "driprig-383be",
  storageBucket: "driprig-383be.firebasestorage.app",
  messagingSenderId: "269498335034",
  appId: "1:269498335034:web:a17aa8bbd393c79e3eda03",
  measurementId: "G-W2568LWR7F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
