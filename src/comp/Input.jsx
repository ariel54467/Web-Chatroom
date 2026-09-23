import { useState } from "react";
import { db, auth } from "../firebase";
import { push, ref, serverTimestamp, update } from "firebase/database";
import { useChat } from "./ChatContext";
import "../css/Input.css"

export const Input = () => {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
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

  const sendMessage = async (event) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    const currentUser = auth.currentUser;

    if (!selectedChatId || !trimmedMessage || !currentUser || isSending) return;

    setIsSending(true);
    setError("");

    try {
      const msgRef = ref(db, `chats/${selectedChatId}/messages`);
      const newMessageRef = push(msgRef);
      const timestamp = serverTimestamp();

      await update(ref(db), {
        [`chats/${selectedChatId}/messages/${newMessageRef.key}`]: {
          text: trimmedMessage,
          sender: currentUser.email,
          senderId: currentUser.uid,
          timestamp,
        },
        [`chats/${selectedChatId}/lastMessage`]: trimmedMessage,
        [`chats/${selectedChatId}/updatedAt`]: timestamp,
      });
      setMessage("");
    } catch {
      setError("Message not sent. Check your connection and try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <form className="input-container" onSubmit={sendMessage}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Message this group"
          aria-label="Message"
          maxLength={2000}
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={!message.trim() || isSending}
          aria-label={isSending ? "Sending message" : "Send message"}
          title="Send message"
        >
          <span aria-hidden="true">{"\u27a4"}</span>
        </button>
      </form>
      {error && <p className="send-error" role="alert">{error}</p>}
    </>
  );
};
