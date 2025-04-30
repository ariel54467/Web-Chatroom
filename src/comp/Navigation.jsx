import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { ref, onValue } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import "../css/Navigation.css"


export const Navigation = () =>{
    const [displayName, setDisplayName] = useState("");
    const [photo, setPhoto] = useState(null);
  
    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          const userRef = ref(db, `users/${user.uid}`);
          onValue(userRef, (snapshot) => {
            const data = snapshot.val();
            setDisplayName(data?.userName || user.email);
          });
  
          if (user.photoURL) {
            setPhoto(user.photoURL);
          }
        }
      });
  
      return () => unsubscribe();
    }, []);
  
    return (
      <div className="nav-bar">
        <div className="userinfo">
          <img src={photo} className="profile-photo" />
          <span className="userinfo">{displayName}</span>
        </div>
      </div>
    );
}