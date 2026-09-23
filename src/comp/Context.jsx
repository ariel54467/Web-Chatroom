import { useState } from "react";
import { ChatContext } from "./ChatContext";

export const Context = ({ children }) => {
  const [selectedChatId, setSelectedChatId] = useState(null);

  return (
    <ChatContext.Provider value={{ selectedChatId, setSelectedChatId }}>
      {children}
    </ChatContext.Provider>
  );
};
