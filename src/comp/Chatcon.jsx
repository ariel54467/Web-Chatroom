import { useEffect, useState } from "react";
import { useChat } from "./ChatContext";
import { Messages } from "./Messages";
import { Input } from "./Input";
import { db } from "../firebase";
import { ref, onValue } from "firebase/database";
import "../css/Chatcon.css";

export const Chatcon = () => {
  const { selectedChatId, setSelectedChatId } = useChat();
  const [chatName, setChatName] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedChatId) {
      setChatName("");
      setMemberCount(0);
      setError("");
      return;
    }

    setIsLoading(true);
    const nameRef = ref(db, `chats/${selectedChatId}/name`);
    const membersRef = ref(db, `chats/${selectedChatId}/members`);
    const handleError = () => {
      setError("Could not load this chat.");
      setIsLoading(false);
    };

    const unsubscribeName = onValue(nameRef, (snapshot) => {
      if (!snapshot.exists()) {
        setError("This chat is no longer available.");
      } else {
        setChatName(snapshot.val() || "Group chat");
        setError("");
      }
      setIsLoading(false);
    }, handleError);

    const unsubscribeMembers = onValue(membersRef, (snapshot) => {
      setMemberCount(Object.values(snapshot.val() || {}).filter(Boolean).length);
    }, handleError);

    return () => {
      unsubscribeName();
      unsubscribeMembers();
    };
  }, [selectedChatId]);

  if (!selectedChatId) {
    return (
      <div className="chatcon empty">
        <div className="empty-state">
          <div className="empty-state-mark" aria-hidden="true">#</div>
          <h2>Your conversations</h2>
          <p>Select a group from the sidebar to start messaging.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chatcon">
      <div className="chatcon-header">
        <button
          type="button"
          className="mobile-back-button"
          onClick={() => setSelectedChatId(null)}
          aria-label="Back to chats"
          title="Back to chats"
        >
          <span aria-hidden="true">{"\u2190"}</span>
        </button>
        <div className="chat-title">
          <h1>{isLoading ? "Loading..." : chatName}</h1>
          {!isLoading && !error && (
            <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
          )}
        </div>
      </div>
      {error ? (
        <div className="conversation-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setSelectedChatId(null)}>Back to chats</button>
        </div>
      ) : (
        <>
          <div className="chatcon-body">
            <Messages />
          </div>
          <div className="chatcon-footer">
            <Input />
          </div>
        </>
      )}
    </div>
  );
};
