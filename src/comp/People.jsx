import { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase";
import { ref, onValue, query as databaseQuery, orderByChild, equalTo } from "firebase/database";
import { useChat } from "./ChatContext";
import "../css/People.css"

export const People = () => {
  const [chats, setChats] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const currentUserId = auth.currentUser?.uid;
  const { selectedChatId, setSelectedChatId } = useChat();

  useEffect(() => {
    if (!currentUserId) return;

    const chatsQuery = databaseQuery(
      ref(db, "chats"),
      orderByChild(`members/${currentUserId}`),
      equalTo(true),
    );

    const unsubscribe = onValue(chatsQuery, (snapshot) => {
      const data = snapshot.val() || {};
      const chatList = [];

      for (const id in data) {
        const chat = data[id];

        if (
          chat.type === "group" &&
          chat.members &&
          chat.members[currentUserId]
        ) {
          chatList.push({
            id,
            name: chat.name || "Untitled group",
            memberCount: Object.values(chat.members).filter(Boolean).length,
            updatedAt: chat.updatedAt || chat.createdAt || 0,
            lastMessage: chat.lastMessage || "",
          });
        }
      }

      chatList.sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
      setChats(chatList);
      setIsLoading(false);
      setError("");
    }, () => {
      setError("Could not load your chats.");
      setIsLoading(false);
    });

    return unsubscribe;
  }, [currentUserId]);

  const filteredChats = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return chats;
    return chats.filter((chat) => chat.name.toLowerCase().includes(normalizedQuery));
  }, [chats, query]);

  return (
    <div className="people-container">
      <div className="people-header">
        <div>
          <h2>Chats</h2>
          <span>{chats.length} {chats.length === 1 ? "group" : "groups"}</span>
        </div>
        <label className="chat-search">
          <span className="sr-only">Search chats</span>
          <input
            type="search"
            placeholder="Search chats"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="people-list" aria-label="Group chats">
        {isLoading && <p className="list-status">Loading chats...</p>}
        {error && <p className="list-status error" role="alert">{error}</p>}
        {!isLoading && !error && chats.length === 0 && (
          <p className="list-status">No groups yet. Create one to get started.</p>
        )}
        {!isLoading && !error && chats.length > 0 && filteredChats.length === 0 && (
          <p className="list-status">No chats match your search.</p>
        )}
        {filteredChats.map((chat) => (
          <button
            type="button"
            className={`chat-info ${selectedChatId === chat.id ? "active" : ""}`}
            key={chat.id}
            onClick={() => setSelectedChatId(chat.id)}
            aria-current={selectedChatId === chat.id ? "true" : undefined}
          >
            <span className="chat-avatar" aria-hidden="true">
              {chat.name.charAt(0).toUpperCase()}
            </span>
            <span className="chat-list-copy">
              <strong>{chat.name}</strong>
              <small>
                {chat.lastMessage || `${chat.memberCount} ${chat.memberCount === 1 ? "member" : "members"}`}
              </small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
