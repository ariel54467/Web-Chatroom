import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import { ChatBubble } from "./ChatBubble";

export const Messages = () => {
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef();

  useEffect(() => {
    const msgRef = ref(db, "chatroom/messages");

    onValue(msgRef, (snapshot) => {
      const data = snapshot.val();
      const msgList = data ? Object.values(data) : [];
      msgList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(msgList);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="message-container">
      {messages.map((msg, i) => (
        <ChatBubble key={i} msg={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
