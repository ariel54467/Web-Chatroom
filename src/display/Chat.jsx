import { SideBar } from "../comp/SideBar"
import { Chatcon } from "../comp/Chatcon"
import "../css/Chat.css"
import logo from "../assets/logonobg_1.png"

export const Chat = () => {
  return (
    <div className="chat-app">
        <img className="logo" src={logo} />
        <div className="container">
            <SideBar />
            <Chatcon /> 
        </div>
    </div>
  );
};
