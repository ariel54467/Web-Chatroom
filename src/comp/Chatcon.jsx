import React from "react";
import { Messages } from "./Messages";    
import { Input } from "./Input";        
import "../css/Chat.css";

export const Chatcon = () => {
  return (
    <div className="chatcon">

      <div className="chatcon-header">
        <h3>General</h3>
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
