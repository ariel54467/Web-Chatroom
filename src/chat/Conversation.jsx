import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowDown, Check, CheckCheck, Info, MessageCircle, Users } from "lucide-react";
import { rpc, describeError } from "../services/chatApi";
import { Attachment, Avatar, Busy, IconButton, Modal, Status } from "./ui";
import { clockTime, dayLabel } from "./format";
import { Composer } from "./Composer";
import { GroupDetails } from "./Groups";

function mergeMessages(previous, incoming) {
  const rows = new Map(previous.map(message => [message.id, message]));
  incoming.forEach(message => rows.set(message.id, message));
  return [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export function Conversation({ roomId, profile, rooms, contacts, revision, online, onChanged, onBack }) {
  const [details, setDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [info, setInfo] = useState(false);
  const [viewer, setViewer] = useState("");
  const [nearBottom, setNearBottom] = useState(true);
  const [newMessages, setNewMessages] = useState(false);
  const [now, setNow] = useState(Date.now());
  const scroll = useRef(null);
  const initial = useRef(true);
  const olderHeight = useRef(0);
  const ownSend = useRef(false);
  const started = useRef(false);
  const room = rooms.find(r => r.id === roomId);
  const refresh = useCallback(async () => {
    const [nextDetails, latest] = await Promise.all([rpc("room_details", { p_room: roomId }), rpc("get_messages", { p_room: roomId })]);
    setDetails(nextDetails);
    if (!started.current) { setMore(latest.length === 40); started.current = true; }
    setMessages(previous => mergeMessages(previous, latest));
    setError(""); setLoading(false);
  }, [roomId]);
  useEffect(() => { refresh().catch(e => { setError(describeError(e)); setLoading(false); }); }, [refresh, revision]);
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 2000); return () => clearInterval(interval); }, []);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    if (olderHeight.current) {
      element.scrollTop += element.scrollHeight - olderHeight.current; olderHeight.current = 0;
    } else if (initial.current || nearBottom || ownSend.current) {
      element.scrollTop = element.scrollHeight; initial.current = false; ownSend.current = false; setNewMessages(false);
    } else setNewMessages(true);
    // Scroll only on message changes, not while the reader scrolls up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);
  const latestId = messages.at(-1)?.id;
  useEffect(() => {
    const mark = () => { if (latestId && nearBottom && !document.hidden && details) void rpc("mark_read", { p_room: roomId }).catch(() => {}); };
    mark(); document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [roomId, latestId, nearBottom, details]);
  async function older() {
    if (loadingMore || !messages.length) return;
    setLoadingMore(true);
    try {
      const first = messages[0];
      const next = await rpc("get_messages", { p_room: roomId, p_before: first.created_at, p_before_id: first.id });
      olderHeight.current = scroll.current.scrollHeight;
      setMessages(previous => mergeMessages(previous, next)); setMore(next.length === 40);
    } catch (e) { setError(describeError(e)); } finally { setLoadingMore(false); }
  }
  function sent(message) {
    ownSend.current = true; setMessages(previous => mergeMessages(previous, [message]));
    void onChanged().catch(e => setError(describeError(e)));
  }
  const activeTyping = details?.typing.filter(t => new Date(t.expires_at).getTime() > now)
    .map(t => details.members.find(m => m.user_id === t.user_id)?.profile.display_name).filter(Boolean) || [];
  return <section className="conversation">
    <header className="conversation-header">
      <IconButton label="Back to chats" onClick={onBack}><ArrowLeft size={20} /></IconButton>
      <Avatar name={room?.name || details?.room.name} path={room?.avatar_path} bucket={room?.kind === "group" ? "chat-media" : "avatars"} />
      <div className="conversation-title"><h1>{room?.name || details?.room.name || "Conversation"}</h1><span>{activeTyping.length ? `${activeTyping.join(", ")} typing...` : details ? `${details.members.length} members` : "Loading..."}</span></div>
      {details && <IconButton label={details.room.kind === "group" ? "Group details" : "Conversation details"} onClick={() => setInfo(true)}><Info size={20} /></IconButton>}
    </header>
    {error && <div className="error-banner" role="alert"><span>{error}</span><button className="button quiet" onClick={() => refresh().catch(e => setError(describeError(e)))}>Retry</button></div>}
    {loading ? <div className="page-status"><Busy /></div> : !details ? <div className="page-status"><p>This conversation is no longer available.</p><button className="button secondary" onClick={onBack}>Back to chats</button></div> : <>
      <div ref={scroll} className="timeline" aria-label="Messages" onScroll={e => {
        const el = e.currentTarget; const near = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
        setNearBottom(near); if (near) setNewMessages(false);
      }}>
        {more && <button className="load-older button quiet" disabled={loadingMore} onClick={older}>{loadingMore ? <Busy /> : null}Earlier messages</button>}
        {!messages.length && <div className="empty-messages"><MessageCircle size={28} /><h2>No messages yet</h2></div>}
        <div className="timeline-content">
          {messages.map((message, index) => {
            const mine = message.sender_id === profile.id;
            const member = details.members.find(m => m.user_id === message.sender_id);
            const readers = details.members.filter(m => m.user_id !== profile.id && new Date(m.last_read_at) >= new Date(message.created_at));
            const read = mine && readers.length > 0;
            const date = dayLabel(message.created_at);
            return <Fragment key={message.id}>
              {(index === 0 || dayLabel(messages[index-1].created_at) !== date) && <div className="day-divider"><span>{date}</span></div>}
              <article className={`message ${mine ? "outgoing" : "incoming"}`}>
                {!mine && <Avatar person={member?.profile} name="Former member" small />}
                <div className="message-bubble">
                  {!mine && <strong className="message-sender">{member?.profile.display_name || "Former member"}</strong>}
                  {message.kind !== "text" && <Attachment message={message} onView={setViewer} />}
                  {message.body && <p>{message.body}</p>}
                  <footer><time dateTime={message.created_at}>{clockTime(message.created_at)}</time>
                    {mine && <span className={read ? "receipt read" : "receipt"} title={read ? `Read by ${readers.length}` : "Sent"} aria-label={read ? "Read" : "Sent"}>{read ? <CheckCheck size={15} /> : <Check size={15} />}</span>}
                  </footer>
                </div>
              </article>
            </Fragment>;
          })}
        </div>
      </div>
      {newMessages && <button className="jump-latest button secondary" onClick={() => { scroll.current.scrollTop = scroll.current.scrollHeight; setNewMessages(false); }}><ArrowDown size={16} />New messages</button>}
      {!details.can_send && <Status>Private messaging is available between accepted, unblocked contacts.</Status>}
      <Composer roomId={roomId} userId={profile.id} disabled={!online || !details.can_send} onSent={sent} onError={setError} />
    </>}
    {info && details && (details.room.kind === "group" ?
      <GroupDetails details={details} userId={profile.id} contacts={contacts} onClose={() => setInfo(false)}
        onChanged={async () => { await refresh(); await onChanged(); }} onLeave={onBack} /> :
      <Modal title="Conversation details" onClose={() => setInfo(false)}><Users size={23} />{details.members.map(m => <div className="person-row" key={m.user_id}><Avatar person={m.profile} /><div className="person-copy"><strong>{m.profile.display_name}</strong><span>@{m.profile.username}</span></div></div>)}</Modal>)}
    {viewer && <Modal title="Shared image" wide onClose={() => setViewer("")}><img className="lightbox-image" src={viewer} alt="Shared image" /></Modal>}
  </section>;
}
