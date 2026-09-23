import { SideBar } from "../comp/SideBar";
import { Chatcon } from "../comp/Chatcon";
import "../css/Chat.css";
import logo from "../assets/logonobg_1.png";
import { useState, useEffect } from "react";
import { AddMenu } from "../comp/AddMenu";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useChat } from "../comp/ChatContext";

export const Chat = () => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { selectedChatId } = useChat();
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setIsAuthReady(false);
        navigate("/signin", { replace: true });
      } else {
        setIsAuthReady(true);
      }
    });

    return () => unsub();
  }, [navigate]);

  const SignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut(auth);
      navigate("/signin");
    } catch (error) {
      alert(error.message);
      setIsSigningOut(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="chat-loading" role="status">
        <div className="loading-spinner" />
        <span>Opening your chats...</span>
      </div>
    );
  }

  return (
    <div className="chat-app">
      <div className="chat-header">
        <div className="chat-brand">
          <img className="logo" src={logo} alt="Chatroom" />
          <span>Chatroom</span>
        </div>
        <div className="ch-but-con">
          <button
            type="button"
            className="header-button primary"
            onClick={() => setShowAddMenu(true)}
          >
            New group
          </button>
          <button
            type="button"
            className="header-button secondary"
            onClick={SignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>

      <main className={`container ${selectedChatId ? "chat-selected" : ""}`}>
        <SideBar />
        <Chatcon />
      </main>

      {showAddMenu && <AddMenu onClose={() => setShowAddMenu(false)} />}
    </div>
  );
};
