import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCd5VUYjjncL5X64MJM3LsqZ9LYmEtv1Fw",
  authDomain: "mein-app-25e08.firebaseapp.com",
  projectId: "mein-app-25e08",
  storageBucket: "mein-app-25e08.firebasestorage.app",
  messagingSenderId: "52824604144",
  appId: "1:52824604144:web:65f9b77f0bb0fa8e853135",
  measurementId: "G-YCFFH5QWF4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const db = getFirestore(app);
export default app;
