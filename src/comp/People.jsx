import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { ref, onValue } from "firebase/database";
import { useChat } from "./ChatContext";
import "../css/People.css"

export const People = () => {
  const [chats, setChats] = useState([]);
  const currentUser = auth.currentUser;
  const { setselectedChatId } = useChat();

  useEffect(() => {
    const chatRef = ref(db, "chats");

    onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      const chatList = [];

      for (let id in data) {
        const chat = data[id];

        if (
          chat.type === "group" &&
          chat.members &&
          chat.members[currentUser.uid]
        ) {
          chatList.push({
            id,
            name: chat.name,
          });
        }
      }

      setChats(chatList);
    });
  }, [currentUser]);

  return (
    <div className="people-container">
      <div className="people-header">
        <h2>Group Chats</h2>
      </div>

      <div className="people-list">
        {chats.map((chat) => (
          <div
            className="chat-info"
            key={chat.id}
            onClick={() => setselectedChatId(chat.id)}
          >
            <span>{chat.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
