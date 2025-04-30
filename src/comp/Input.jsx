import React, { useState } from "react";
import { db, auth } from "../firebase";
import { push, ref, serverTimestamp } from "firebase/database";
import { useChat } from "./ChatContext";
import "../css/Input.css"
import send from "../assets/send.png"

export const Input = () => {
  const [message, setMessage] = useState("");
  const { selectedChatId } = useChat();

  const sendMessage = () => {
    if (!selectedChatId || message.trim() === "") return;

    const msgRef = ref(db, `chats/${selectedChatId}/messages`);
    push(msgRef, {
      text: message,
      sender: auth.currentUser.email,
      timestamp: serverTimestamp(),
    });

    setMessage("");
  };

  return (
    <div className="input-container">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
      />
      <button  onClick={sendMessage}>
          <img src={send}></img>
      </button>
    </div>
  );
};
