import { useEffect, useRef, useState } from 'react';
import { auth, googleAuth, db } from "../firebase";
import { set, ref, get } from "firebase/database"
import { Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import "../css/SignIn.css";
import logo from '../assets/logonobg.png'; 

const signInErrorMessage = (error) => {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/popup-blocked":
      return "Allow pop-ups for this site, then try Google sign-in again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was cancelled. Please try again.";
    case "auth/network-request-failed":
      return "Could not connect to sign-in. Check your internet connection and try again.";
    case "auth/unauthorized-domain":
      return `Sign-in is not enabled for ${window.location.hostname}. Add this domain to Firebase Authentication's authorized domains.`;
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled in Firebase Authentication.";
    case "auth/too-many-requests":
      return "Too many sign-in attempts. Please wait a moment and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    default:
      return `Could not sign in. Please try again${error.code ? ` (${error.code})` : ""}.`;
  }
};

const saveGoogleProfile = async (user) => {
  const userRef = ref(db, "users/" + user.uid);
  const snapshot = await get(userRef);
  if (!snapshot.exists()) {
    await set(userRef, {
      userName: user.displayName || user.email || "Member",
      email: user.email || "",
    });
  }
};

export const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPass] = useState("");
  const [pendingMethod, setPendingMethod] = useState(null);
  const [error, setError] = useState("");
  const signInPending = useRef(false);
  const nav = useNavigate();

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (user) nav("/chat", { replace: true });
  }, (authError) => setError(signInErrorMessage(authError))), [nav]);

  const signIn = async (method) => {
    if (signInPending.current) return;
    signInPending.current = true;
    setPendingMethod(method);
    setError("");

    try {
      if (method === "google") {
        const { user } = await signInWithPopup(auth, googleAuth);
        // Profile availability must not block an authenticated user's navigation.
        void saveGoogleProfile(user).catch((profileError) => {
          console.warn("Signed in, but could not save the chat profile:", profileError.code);
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (authError) {
      setError(signInErrorMessage(authError));
    } finally {
      signInPending.current = false;
      setPendingMethod(null);
    }
  };

  return (
    <div className="signin-wrapper">
      <img src={logo} alt="Logo" className="signin-logo" />

      <form onSubmit={(e) => { e.preventDefault(); signIn("email"); }} className="signin-card" aria-busy={pendingMethod !== null}>
        <h2>Sign in</h2>
        <p className="subtext">Stay connected with your chat world</p>
        
        <input
          type="email"
          placeholder="Email"
          aria-label="Email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={pendingMethod !== null}
        />

        <input
          type="password"
          placeholder="Password"
          aria-label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPass(e.target.value)}
          required
          disabled={pendingMethod !== null}
        />

        {error && <p className="error-text" role="alert">{error}</p>}

        <button className="primary-btn" type="submit" disabled={pendingMethod !== null}>
          {pendingMethod === "email" ? "Signing in..." : "Sign In"}
        </button>

        <div className="divider"><span>or</span></div>

        <button className="alt-btn" type="button" onClick={() => signIn("google")} disabled={pendingMethod !== null}>
          {pendingMethod === "google" ? "Signing in with Google..." : "Sign in with Google"}
        </button>

        <p className="signup-link">
          New here? <Link to="/signup">Register</Link>
        </p>
      </form>
    </div>
  );
};
