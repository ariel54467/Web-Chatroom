import { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import { useChat } from "./ChatContext";
import { ChatBubble } from "./ChatBubble";
import "../css/Messages.css"

export const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef();
  const { selectedChatId } = useChat();

  useEffect(() => {
    const usersRef = ref(db, "users");
    return onValue(usersRef, (snapshot) => {
      setUsers(snapshot.val() || {});
    });
  }, []);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    const msgRef = ref(db, `chats/${selectedChatId}/messages`);

    const unsubscribe = onValue(msgRef, (snapshot) => {
      const data = snapshot.val() || {};
      const msgList = Object.entries(data).map(([id, message]) => ({ id, ...message }));
      msgList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(msgList);
      setIsLoading(false);
      setError("");
    }, () => {
      setError("Messages could not be loaded. Please try again.");
      setIsLoading(false);
    });

    return unsubscribe;
  }, [selectedChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getDisplayName = (message) => {
    if (message.senderId && users[message.senderId]) {
      return users[message.senderId].userName || users[message.senderId].email || message.sender;
    }

    const matchedUser = Object.values(users).find((user) => user.email === message.sender);
    return matchedUser?.userName || message.sender || "Unknown user";
  };

  return (
    <div className="message-container" aria-live="polite">
      {isLoading && <div className="messages-status">Loading messages...</div>}
      {error && <div className="messages-status error" role="alert">{error}</div>}
      {!isLoading && !error && messages.length === 0 && (
        <div className="messages-status empty">
          <strong>No messages yet</strong>
          <span>Start the conversation with this group.</span>
        </div>
      )}
      {messages.map((msg) => (
        <ChatBubble key={msg.id} msg={msg} displayName={getDisplayName(msg)} />
      ))}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
};
