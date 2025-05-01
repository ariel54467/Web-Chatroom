import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { ref, set } from "firebase/database"
import "../css/SignUp.css";
import logo from "../assets/logonobg.png";

export const SignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPass] = useState("");
  const [userName, setuserName] = useState("");
  const [phoneNum, setphoneNum] = useState("");
  const [address, setAddress] = useState("");
  const nav = useNavigate();

  const signUp = async () => {
    try {
      const userInfo = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userInfo.user.uid;
      const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${userName || "User"}`;
      
      await updateProfile(userInfo.user, {
        displayName: userName,
        photoURL: avatarUrl
      });

      await set(ref(db, "users/" + uid), {
        userName,
        email,
        phoneNum: phoneNum || null,
        address: address || null,
        photoURL: avatarUrl
      });
      
      await signOut(auth);
      nav("/signin");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="signup-wrapper">
      <img src={logo} alt="Logo" className="signup-logo" />

      <form onSubmit={(e) => { e.preventDefault(); signUp(); }} className="signup-card">
        <h2>Sign up</h2>
        <p className="subtext">Create your account to start chatting</p>

        <input
          placeholder="Display Name"
          value={userName}
          onChange={(e) => setuserName(e.target.value)} 
          required 
        />
        
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

        <input 
          type="text" 
          placeholder="Phone Number (Optional)" 
          value={phoneNum} 
          onChange={(e) => setphoneNum(e.target.value)}
        />

        <input 
          type="text" 
          placeholder="Address (Optional)" 
          value={address} 
          onChange={(e) => setAddress(e.target.value)}
        />

        <button className="signupbtn" type="submit">Sign Up</button>

        <p className="signin-link">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </form>
    </div>
  );
};