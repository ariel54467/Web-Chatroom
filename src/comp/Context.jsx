import React, { useState } from "react";
import { ChatContext } from "./ChatContext";

export const Context = ({ children }) => {
  const [selectedChatId, setselectedChatId] = useState(null);

  const resetChatId = () => {
    setselectedChatId(null);
  };

  return (
    <ChatContext.Provider value={{ selectedChatId, setselectedChatId, resetChatId }}>
      {children}
    </ChatContext.Provider>
  );
};
