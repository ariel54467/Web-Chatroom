import React, { useState } from "react";
import { db, auth } from "../firebase";
import { push, ref, serverTimestamp } from "firebase/database";
import { useChat } from "./ChatContext";
import "../css/Input.css";
import send from "../assets/send.png";

export const Input = () => {
  const [message, setMessage] = useState("");
  const [media, setMedia] = useState(null); 
  const [mediaPreview, setMediaPreview] = useState(null); 
  const { selectedChatId } = useChat();

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500 * 1024) {  
        alert('Please select an image smaller than 500KB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setMedia({
          base64: event.target.result,
          type: file.type, 
        });
        setMediaPreview(URL.createObjectURL(file)); 
      };
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = () => {
    if (!selectedChatId || (message.trim() === "" && !media)) return;

    const msgRef = ref(db, `chats/${selectedChatId}/messages`);

    const messageData = {
      text: message,
      sender: auth.currentUser.email,
      timestamp: serverTimestamp(),
    };

    if (media) {
      messageData.mediaBase64 = media.base64;
      messageData.mediaType = media.type;
    }

    push(msgRef, messageData);

    setMessage("");
    setMedia(null);
    setMediaPreview(null); 
  };

  return (
    <div className="input-container">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
      />
      

      <input
        type="file"
        accept="image/*,video/*"
        onChange={handleMediaChange}
        style={{ display: "none" }}
        id="file-input"
      />
      <button onClick={() => document.getElementById("file-input").click()}>
        Attach
      </button>

      <button onClick={sendMessage}>
        <img src={send} alt="send" />
      </button>

      {mediaPreview && (
        <div className="media-preview">
          {media.type.startsWith("image") ? (
            <img src={mediaPreview} alt="Preview" className="media-preview-image" />
          ) : media.type.startsWith("video") ? (
            <video controls className="media-preview-video">
              <source src={mediaPreview} type={media.type} />
            </video>
          ) : null}
          <button 
            className="remove-media-btn"
            onClick={() => {
              setMedia(null);
              setMediaPreview(null);
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
};
