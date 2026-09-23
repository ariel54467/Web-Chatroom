import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Send, X, RotateCcw, Film, Smile } from "lucide-react";
import { Busy, IconButton, Status } from "./ui";
import { describeError, rpc, removeFile, uploadFile, safeFilename, validateFile } from "../services/chatApi";
import { EmojiPanel } from "./EmojiPanel";
import { notifyMembers } from "../services/push";

export function Composer({ roomId, userId, disabled, onSent, onError }) {
  const key = `chatterly:draft:${userId}:${roomId}`;
  const [body, setBody] = useState(() => { try { return localStorage.getItem(key) || ""; } catch { return ""; } });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const uploadInput = useRef(null);
  const textInput = useRef(null);
  const emojiButton = useRef(null);
  const caret = useRef(null);
  const attempt = useRef(null);
  const controller = useRef(null);
  const busy = useRef(false);
  const lastTyping = useRef(0);
  const mounted = useRef(true);
  const locked = Boolean(phase);
  useEffect(() => {
    try { if (body) localStorage.setItem(key, body); else localStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
  }, [key, body]);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      void rpc("set_typing", { p_room: roomId, p_typing: false }).catch(() => {});
      const path = attempt.current?.path;
      if (path) void removeFile("chat-media", path).catch(() => {});
    };
  }, [roomId]);

  function choose(next) {
    if (!next) return;
    try { validateFile(next); setFile(next); setError(""); } catch (e) { setError(e.message); }
  }
  function change(text) {
    setBody(text);
    if (!disabled && Date.now() - lastTyping.current > 2500) {
      lastTyping.current = Date.now();
      void rpc("set_typing", { p_room: roomId, p_typing: Boolean(text.trim()) }).catch(() => {});
    }
  }
  const closeEmoji = useCallback(() => setEmojiOpen(false), []);
  function insertEmoji(emoji) {
    const [start, end] = (caret.current ?? [body.length, body.length]).map(at => Math.min(at, body.length));
    const next = body.slice(0, start) + emoji + body.slice(end);
    if (next.length > 4000) return;
    const position = start + emoji.length;
    caret.current = [position, position];
    change(next);
    // On phones, focusing the message box would open the keyboard over the picker.
    if (!matchMedia("(pointer: coarse)").matches) requestAnimationFrame(() => {
      textInput.current?.focus(); textInput.current?.setSelectionRange(position, position);
    });
  }
  async function discard() {
    controller.current?.abort();
    const pending = attempt.current;
    attempt.current = null;
    if (pending?.path) {
      try { await removeFile("chat-media", pending.path); }
      catch { onError("The attachment could not be cleaned up. It remains private."); }
    }
    if (mounted.current) { setPhase(""); setFile(null); setError(""); }
  }
  async function send(event) {
    event?.preventDefault();
    if (busy.current || disabled || (!body.trim() && !file && !attempt.current)) return;
    busy.current = true; setError("");
    const pending = attempt.current || { id: crypto.randomUUID(), body: body.trim(), file,
      kind: file ? validateFile(file) : "text", uploaded: false };
    attempt.current = pending;
    const abort = new AbortController();
    controller.current = abort;
    try {
      if (pending.file && !pending.uploaded) {
        setPhase("uploading"); setProgress(0);
        pending.path = `${roomId}/${userId}/${pending.id}/${safeFilename(pending.file.name)}`;
        await uploadFile("chat-media", pending.path, pending.file, { signal: abort.signal, onProgress: setProgress });
        pending.uploaded = true;
      }
      if (abort.signal.aborted) return;
      setPhase("sending");
      const message = await rpc("send_message", {
        p_id: pending.id, p_room: roomId, p_body: pending.body, p_kind: pending.kind,
        p_storage_path: pending.path || null, p_file_name: pending.file?.name || null,
      });
      attempt.current = null;
      void notifyMembers(message.id).catch(() => {});
      try { localStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
      if (mounted.current) {
        setBody(""); setFile(null); setPhase(""); onSent(message);
        requestAnimationFrame(() => textInput.current?.focus());
      }
      void rpc("set_typing", { p_room: roomId, p_typing: false }).catch(() => {});
    } catch (e) {
      if (mounted.current && e.name !== "AbortError") { setError(describeError(e)); setPhase("failed"); }
    } finally { busy.current = false; }
  }
  return <div className="composer-area">
    {file && <div className="file-preview">
      {file.type === "video/mp4" ? <Film size={30} /> : <img src={preview} alt="Attachment preview" />}
      <span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span>
      {phase !== "sending" && <IconButton label="Remove attachment" onClick={discard}><X size={18} /></IconButton>}
    </div>}
    {phase === "uploading" && <div className="upload-progress"><progress value={progress} max="100" aria-label="Upload progress" /><span>{progress}%</span></div>}
    {error && <div className="send-failure"><Status error>{error}</Status><button className="button quiet" onClick={send} disabled={disabled}><RotateCcw size={15} />Retry</button><IconButton label="Discard failed message" onClick={discard}><X size={16} /></IconButton></div>}
    <form className="composer" onSubmit={send}>
      <input ref={uploadInput} className="hidden-input" type="file" aria-label="Attach a file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
        onChange={e => { choose(e.target.files?.[0]); e.target.value = ""; }} />
      <IconButton label="Attach picture, GIF, or video" disabled={disabled || locked} onClick={() => uploadInput.current?.click()}><Paperclip size={20} /></IconButton>
      <IconButton ref={emojiButton} label="Add emoji" aria-expanded={emojiOpen} disabled={disabled || locked} onClick={() => setEmojiOpen(open => !open)}><Smile size={20} /></IconButton>
      <textarea ref={textInput} aria-label="Message" placeholder="Write a message..." value={body} maxLength={4000} rows={1}
        onChange={e => change(e.target.value)} disabled={disabled || locked}
        onSelect={e => { caret.current = [e.currentTarget.selectionStart, e.currentTarget.selectionEnd]; }}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); send(); } }} />
      <button type="submit" className="send-button" aria-label="Send message" title="Send message" disabled={disabled || locked || (!body.trim() && !file)}>
        {locked && phase !== "failed" ? <Busy /> : <Send size={19} />}
      </button>
    </form>
    {emojiOpen && !disabled && !locked && <EmojiPanel toggle={emojiButton} onChoose={insertEmoji} onClose={closeEmoji} />}
  </div>;
}
