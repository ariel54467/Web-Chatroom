import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { Busy } from "./ui";

// Loaded on first open so the emoji data stays out of the main bundle.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

export function EmojiPanel({ toggle, onChoose, onClose }) {
  const panel = useRef(null);
  // The picker keeps its first click handler, so route clicks to the latest one.
  const choose = useRef(onChoose);
  useLayoutEffect(() => { choose.current = onChoose; });
  useEffect(() => {
    const outside = event => {
      if (!panel.current?.contains(event.target) && !toggle.current?.contains(event.target)) onClose();
    };
    const escape = event => { if (event.key === "Escape") { onClose(); toggle.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [toggle, onClose]);
  // On phones, focusing the search box would open the keyboard over the emoji.
  const touch = matchMedia("(pointer: coarse)").matches;
  return <div ref={panel} className="emoji-panel" role="dialog" aria-label="Emoji">
    <Suspense fallback={<div className="page-status"><Busy /></div>}>
      <EmojiPicker onEmojiClick={data => choose.current(data.emoji)} emojiStyle="native" theme="light" width="100%" height="100%"
        lazyLoadEmojis autoFocusSearch={!touch} searchPlaceholder="Search emoji" previewConfig={{ showPreview: false }} />
    </Suspense>
  </div>;
}
