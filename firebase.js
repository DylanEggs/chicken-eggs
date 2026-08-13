import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCSruU8Sae0mFI16N2tcIh2GRLartzYhHE",
  authDomain: "chicken-eggs-53358.firebaseapp.com",
  projectId: "chicken-eggs-53358",
  storageBucket: "chicken-eggs-53358.firebasestorage.app",
  messagingSenderId: "461720066101",
  appId: "1:461720066101:web:6b19a7c4d245f399cf797c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.FirebaseApp = app;
window.FirestoreDB = db;
window.FirebaseAuth = auth;

onAuthStateChanged(auth, user => {
  if (user) {
    window.FirebaseUser = user;
    console.log("✅ Firebase signed in:", user.uid);
  }
});

signInAnonymously(auth).catch(error => {
  console.error("❌ Firebase anonymous sign-in failed:", error);
});

console.log("✅ Firebase initialized");
