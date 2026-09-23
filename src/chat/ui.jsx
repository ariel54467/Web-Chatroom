import { useEffect, useRef, useState } from "react";
import { X, LoaderCircle, ImageOff } from "lucide-react";
import { useMediaUrl } from "./useMediaUrl";

export function IconButton({ label, children, ...props }) {
  return <button type="button" className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}
export function Status({ children, error = false }) {
  return <p className={error ? "error" : "status"} role={error ? "alert" : "status"}>{children}</p>;
}
export function Busy() { return <LoaderCircle className="spin" size={18} aria-label="Loading" />; }

export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? "wide" : ""}`} aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="modal-inner">
      <header className="modal-header"><h2>{title}</h2><IconButton label="Close" onClick={onClose}><X size={20} /></IconButton></header>
      {children}
    </div>
  </dialog>;
}

export function Avatar({ person, name, path, bucket = "avatars", small = false }) {
  const title = person?.display_name || name || "Group";
  const file = person?.avatar_path || path;
  const { url } = useMediaUrl(bucket, file);
  const [failed, setFailed] = useState("");
  const hue = Array.from(title).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 4;
  return <span className={`avatar color-${hue} ${small ? "small" : ""}`} aria-hidden="true">
    {url && failed !== url ? <img src={url} alt="" onError={() => setFailed(url)} /> : title.trim().slice(0, 1).toUpperCase()}
  </span>;
}

export function Attachment({ message, onView }) {
  const { url, error } = useMediaUrl("chat-media", message.storage_path);
  const source = message.external_url || url;
  if (!message.external_url && error) return <div className="attachment-status"><ImageOff size={20} />Attachment unavailable</div>;
  if (!source) return <div className="attachment-status"><Busy /></div>;
  if (message.kind === "video") return <video className="message-media" src={source} controls preload="metadata" playsInline />;
  return <button type="button" className="image-button" onClick={() => onView(source)} aria-label="Open image">
    <img className="message-media" src={source} alt={message.body || message.file_name || "Shared image"} loading="lazy" />
  </button>;
}
