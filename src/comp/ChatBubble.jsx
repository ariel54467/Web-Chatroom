import { auth } from "../firebase";
import "../css/ChatBubble.css"

const formatMessageTime = (timestamp) => {
  if (!timestamp) return "Sending...";

  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  return new Intl.DateTimeFormat([], isToday
    ? { hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
  ).format(date);
};

export const ChatBubble = ({ msg, displayName }) => {
  const isMe = msg.senderId
    ? msg.senderId === auth.currentUser?.uid
    : msg.sender === auth.currentUser?.email;
  const senderName = isMe ? "You" : displayName;
  const initial = senderName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={`message-row ${isMe ? "right" : "left"}`}>
      {!isMe && <span className="message-avatar" aria-hidden="true">{initial}</span>}
      <article className={`chat-bubble ${isMe ? "right" : "left"}`}>
        <div className="sender-name">{senderName}</div>
        <div className="bubble-text">{msg.text}</div>
        <time className="message-time" dateTime={msg.timestamp ? new Date(msg.timestamp).toISOString() : undefined}>
          {formatMessageTime(msg.timestamp)}
        </time>
      </article>
    </div>
  );
};
