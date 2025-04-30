import React from "react";
import { auth } from "../firebase";

export const ChatBubble = ({ msg }) => {
  const isMe = msg.sender === auth.currentUser?.email;

  return (
    <div className={`chat-bubble ${isMe ? "right" : "left"}`}>
      <div className="sender-name">{msg.userName || msg.sender}</div>
      <div className="bubble-text">{msg.text}</div>
    </div>
  );
};
