import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { ref, onValue } from "firebase/database";
import "../css/ChatBubble.css";

export const ChatBubble = ({ msg }) => {
  const isMe = msg.sender === auth.currentUser?.email;
  const [displayName, setDisplayName] = useState(msg.sender);

  useEffect(() => {
    const userRef = ref(db, "users");
    const unsubscribe = onValue(userRef, (snapshot) => {
      const users = snapshot.val() || {};
      const matched = Object.values(users).find((u) => u.email === msg.sender);
      if (matched?.userName) {
        setDisplayName(matched.userName);
      }
    });

    return () => unsubscribe();
  }, [msg.sender]);

  // Check if the message contains media
  const hasMedia = msg.mediaBase64;

  return (
    <div
      style={{
        backgroundColor: isMe ? "#4f46e5" : "#e5e7eb",
        color: isMe ? "white" : "black",
        margin: "10px",
        padding: "10px",
        borderRadius: "10px",
        alignSelf: isMe ? "flex-end" : "flex-start",
        maxWidth: "60%",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
        {displayName}
      </div>
      <div>{msg.text}</div>

      {/* Render media (image/video) if it exists */}
      {hasMedia && (
        <div className="media-container">
          {msg.mediaType.startsWith("image") ? (
            <img
              src={msg.mediaBase64}
              alt="Message media"
              className="media-image"
            />
          ) : msg.mediaType.startsWith("video") ? (
            <video controls className="media-video">
              <source src={msg.mediaBase64} type={msg.mediaType} />
            </video>
          ) : null}
        </div>
      )}
    </div>
  );
};
