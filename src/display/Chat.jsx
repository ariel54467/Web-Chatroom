import { SideBar } from "../comp/SideBar";
import { Chatcon } from "../comp/Chatcon";
import "../css/Chat.css";
import logo from "../assets/logonobg_1.png";
import { useState, useEffect } from "react";
import { AddMenu } from "../comp/AddMenu"; 
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export const Chat = () => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/signin");
      } else {
        setIsAuthReady(true);
      }
    });

    return () => unsub();
  }, [navigate]);

  const SignOut = async () => {
    try {
      await signOut(auth);
      navigate("/signin");
    } catch (error) {
      alert(error.message);
    }
  };

  if (!isAuthReady) {
    return <div></div>; 
  }

  return (
    <div className="chat-app">
      <div className="chat-header">
        <img className="logo" src={logo} />
        <div className="ch-but-con">
          <button className="add-button" onClick={() => setShowAddMenu(true)}>
            Add Group Chat
          </button>
          <button className="add-button" onClick={SignOut}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="container">
        <SideBar />
        <Chatcon />
      </div>

      {showAddMenu && <AddMenu onClose={() => setShowAddMenu(false)} />}
    </div>
  );
};
