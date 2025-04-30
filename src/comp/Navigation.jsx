import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { ref, onValue } from "firebase/database";


export const Navigation = () =>{
    const [displayName, setName] = useState("");
    const [photo, setPhoto] = useState(null);

    const user = auth.currentUser;
    useEffect(()=>{
        if (!user) return;
        const userInfo = ref(db, `users/${user.uid}`);
        onValue(userInfo, (snapshot)=>{
            const data = snapshot.val();
            setName(data?.userName);
        });
        if(user.photoURL){
            setPhoto(user.photoURL);
        }
    } , [user]);

    return(
        <div className="nav-bar">
            <div className="userinfo">
                <img src={photo} className="profile-photo"></img>
                <span className="userinfo">{displayName}</span>
            </div>
        </div>
    )
}