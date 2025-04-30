import React, { useState } from "react";
import { db, auth } from "../firebase";
import { push, ref, serverTimestamp } from "firebase/database";

export const Input = () => {
  const [message, setMessage] = useState("");

  const sendMessage = () => {
    if (message === "") return;

    const msgRef = ref(db, "chatroom/messages");
    push(msgRef, {
      text: message,
      sender: auth.currentUser.userName,
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
      <button onClick={sendMessage}>Send</button>
    </div>
  );
};
