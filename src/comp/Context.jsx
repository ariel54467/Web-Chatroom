import React, { useState } from "react";
import { ChatContext } from "./ChatContext";

export const Context = ({ children }) => {
  const [selectedChatId, setselectedChatId] = useState(null);

  return (
    <ChatContext.Provider value={{ selectedChatId, setselectedChatId }}>
      {children}
    </ChatContext.Provider>
  );
};
