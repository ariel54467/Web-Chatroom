import { SideBar } from "../comp/SideBar"
import { Chatcon } from "../comp/Chatcon"
import "../css/Chat.css"
import logo from "../assets/logonobg_1.png"
import { useState } from "react";
import { AddMenu } from "../comp/AddMenu"; 

export const Chat = () => {
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <div className="chat-app">
      <img className="logo" src={logo} />
      <button className="add-button" onClick={() => setShowAddMenu(true)}>+</button>
      <div className="container">
        <SideBar />
        <Chatcon />
      </div>


      {showAddMenu && <AddMenu onClose={() => setShowAddMenu(false)} />}
    </div>
  );
};

