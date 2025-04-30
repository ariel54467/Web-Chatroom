import React, { useEffect, useState } from "react";
import { useChat } from "./ChatContext";
import { Messages } from "./Messages";
import { Input } from "./Input";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import "../css/Chat.css";

export const Chatcon = () => {
  const { selectedChatId } = useChat();
  const [chatName, setChatName] = useState("");

  useEffect(() => {
    if (!selectedChatId) return;

    const chatRef = ref(db, `chats/${selectedChatId}`);
    const unsub = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      setChatName(data?.name || "Group Chat");
    });

    return () => unsub();
  }, [selectedChatId]);

  if (!selectedChatId) {
    return (
      <div className="chatcon empty">
        <div className="empty-state">
          <h2>Select a chat to start messaging</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="chatcon">
      <div className="chatcon-header">
        <h3>{chatName}</h3>
      </div>
      <div className="chatcon-body">
        <Messages />
      </div>
      <div className="chatcon-footer">
        <Input />
      </div>
    </div>
  );
};
