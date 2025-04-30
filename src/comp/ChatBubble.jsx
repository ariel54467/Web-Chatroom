import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { ref, onValue } from "firebase/database";
import "../css/ChatBubble.css"

export const ChatBubble = ({ msg }) => {
  const isMe = msg.sender === auth.currentUser?.email;
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const userRef = ref(db, "users");
    onValue(userRef, (snapshot) => {
      const users = snapshot.val() || {};
      const matched = Object.values(users).find((u) => u.email === msg.sender);
      setDisplayName(matched?.userName || msg.sender);
    });
  }, [msg.sender]);

  return (
    <div className={`chat-bubble ${isMe ? "right" : "left"}`}>
      <div className="sender-name">{displayName}</div>
      <div className="bubble-text">{msg.text}</div>
    </div>
  );
};
