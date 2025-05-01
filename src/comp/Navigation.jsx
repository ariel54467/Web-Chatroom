import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { ref, onValue } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { Link } from 'react-router-dom';
import "../css/Navigation.css";
import profile from "../assets/default-avatar.png"

export const Navigation = () => {
    const [displayName, setDisplayName] = useState("");
    const [photo, setPhoto] = useState(null);
  
    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          const userRef = ref(db, `users/${user.uid}`);
          onValue(userRef, (snapshot) => {
            const data = snapshot.val();
            setDisplayName(data?.userName || user.displayName || user.email);
            
            if (data?.photoBase64) {
              setPhoto(data.photoBase64);
            } else if (user.photoURL) {
              setPhoto(user.photoURL);
            } else {
              setPhoto(`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data?.userName || 'User')}`);
            }
          });
        }
      });
  
      return () => unsubscribe();
    }, []);
  
    return (
      <div className="nav-bar">
        <Link to='/edit'>
          <div className="userinfo">
            <img 
              src={photo || profile} 
              className="profile-photo" 
              alt="Profile"
              onError={(e) => {
                e.target.src = {profile};
              }}
            />
            <span className="username">{displayName}</span>
          </div>
        </Link>
      </div>
    );
};