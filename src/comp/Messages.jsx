import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../firebase";
import { ref, onValue } from "firebase/database";
import { useChat } from "./ChatContext";
import { ChatBubble } from "./ChatBubble";
import "../css/Messages.css";

export const Messages = () => {
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef();
  const { selectedChatId } = useChat();

  useEffect(() => {
    if (!selectedChatId) return;

    const msgRef = ref(db, `chats/${selectedChatId}/messages`);

    const unsubscribe = onValue(msgRef, (snapshot) => {
      const data = snapshot.val();
      const msgList = data ? Object.values(data) : [];

      msgList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      // Get latest message
      const lastMsg = msgList[msgList.length - 1];

  
      if (
        lastMsg &&
        lastMsg.sender !== auth.currentUser?.email &&
        Notification.permission === "granted" &&
        document.visibilityState !== "visible"
      ) {
        new Notification("New Message", {
          body: `${lastMsg.sender}: ${lastMsg.text}`,
        });
      }

      setMessages(msgList);
    });

    return () => unsubscribe();
  }, [selectedChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!selectedChatId) {
    return <div className="message-container">Select a chat to view messages.</div>;
  }

  return (
    <div className="message-container">
      {messages.map((msg, i) => (
        <ChatBubble key={i} msg={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
