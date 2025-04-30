// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth,GoogleAuthProvider } from "firebase/auth"
import { getDatabase } from "firebase/database"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA65NxtPW7X_U7mdt3vlnTE9lIgcO_z5s8",
  authDomain: "midterm-project-11200626-998dd.firebaseapp.com",
  databaseURL: "https://midterm-project-11200626-998dd-default-rtdb.firebaseio.com",
  projectId: "midterm-project-11200626-998dd",
  storageBucket: "midterm-project-11200626-998dd.firebasestorage.app",
  messagingSenderId: "151479703757",
  appId: "1:151479703757:web:1512d87e25c599435ff184"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuth = new GoogleAuthProvider();
export const db = getDatabase(app);
