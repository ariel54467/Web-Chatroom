import { useState } from 'react';
import { auth, googleAuth, db } from "../firebase";
import { set, ref, get } from "firebase/database"
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import "../css/SignIn.css";
import logo from '../assets/logonobg.png'; 

export const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPass] = useState("");
  const nav = useNavigate();

  const googleSignIn = async () => {
    try {
        const result = await signInWithPopup(auth, googleAuth);
        const user = result.user;
        const userRef = ref(db, "users/" + user.uid);
    
        const snapshot = await get(userRef);
        if (!snapshot.exists()) {
          await set(userRef, {
            userName: user.displayName,
            email: user.email,
          });
        }
        nav("/chat");
    } catch (error) {
      alert(error.message);
    }
  };

  const emailSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      nav('/chat');

    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="signin-wrapper">
      <img src={logo} alt="Logo" className="signin-logo" />

      <form onSubmit={(e) => { e.preventDefault(); emailSignIn(); }} className="signin-card">
        <h2>Sign in</h2>
        <p className="subtext">Stay connected with your chat world</p>
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPass(e.target.value)}
          required
        />

        <button className="primary-btn" type="submit">Sign In</button>

        <div className="divider"><span>or</span></div>

        <button className="alt-btn" onClick={googleSignIn}>Sign in with Google</button>

        <p className="signup-link">
          New here? <Link to="/signup">Register</Link>
        </p>
      </form>
    </div>
  );
};
