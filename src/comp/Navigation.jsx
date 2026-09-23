import { useEffect, useState } from "react";
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
      let unsubscribeUser = () => {};

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribeUser();

        if (user) {
          const fallbackName = user.displayName || user.email || "Member";
          setDisplayName(fallbackName);
          const userRef = ref(db, `users/${user.uid}`);
          unsubscribeUser = onValue(userRef, (snapshot) => {
            const data = snapshot.val();
            setDisplayName(data?.userName || fallbackName);
          }, () => {
            setDisplayName(fallbackName);
          });

          setPhoto(user.photoURL || null);
        }
      });
  
      return () => {
        unsubscribe();
        unsubscribeUser();
      };
    }, []);

    const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  
    return (
      <div className="nav-bar">
        <div className="userinfo">
          {photo ? (
            <img
              src={photo}
              className="profile-photo"
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setPhoto(null)}
            />
          ) : (
            <span className="profile-photo profile-fallback" aria-hidden="true">{initial}</span>
          )}
          <span className="user-details">
            <strong>{displayName || "Loading..."}</strong>
            <small>Signed in</small>
          </span>
        </div>
      </div>
    );
}
