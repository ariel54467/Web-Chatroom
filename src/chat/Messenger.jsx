import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Users, UserRound, Inbox, Plus, Search, LogOut, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useSession } from "../auth/SessionContext";
import { supabase } from "../services/supabase";
import { describeError, getProfile, rpc } from "../services/chatApi";
import { Avatar, Busy, IconButton, Status } from "./ui";
import { clockTime } from "./format";
import { Profile } from "./Profile";
import { Contacts, Requests } from "./Contacts";
import { GroupForm } from "./Groups";
import { NotificationToggle } from "./Notifications";
import { disablePush } from "../services/push";
import { Conversation } from "./Conversation";
import logo from "../assets/logonobg_1.png";

const emptySocial = { contacts: [], requests: [], invites: [], blocked: [] };
export default function Messenger() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const selected = params.get("chat");
  const [view, setView] = useState("chats");
  const [profile, setProfile] = useState(null);
  const [social, setSocial] = useState(emptySocial);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [createGroup, setCreateGroup] = useState(false);
  const [revision, setRevision] = useState(0);
  const [connection, setConnection] = useState("connecting");
  const [online, setOnline] = useState(navigator.onLine);

  const refresh = useCallback(async () => {
    const [nextProfile, nextSocial, nextRooms] = await Promise.all([
      getProfile(user.id), rpc("social_state"), rpc("list_rooms"),
    ]);
    setProfile(nextProfile); setSocial(nextSocial); setRooms(nextRooms); setError("");
    setRevision(value => value + 1); setLoading(false);
  }, [user.id]);

  useEffect(() => {
    let active = true;
    let timer;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (active) refresh().catch(e => { setError(describeError(e)); setLoading(false); }); }, 150);
    };
    refresh().catch(e => { setError(describeError(e)); setLoading(false); });
    const channel = supabase.channel(`inbox-${user.id}`);
    for (const table of ["profiles", "friend_requests", "blocks", "rooms", "room_members", "group_invites", "messages", "typing"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, reload);
    }
    channel.subscribe(status => {
      if (!active) return;
      setConnection(status === "SUBSCRIBED" ? "live" : "connecting");
      if (status === "SUBSCRIBED") reload();
    });
    const reconnect = () => { setOnline(true); reload(); };
    const disconnect = () => setOnline(false);
    const focus = () => { if (!document.hidden) reload(); };
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", disconnect);
    document.addEventListener("visibilitychange", focus);
    const interval = setInterval(() => { if (!document.hidden && navigator.onLine) reload(); }, 30000);
    return () => {
      active = false; clearTimeout(timer); clearInterval(interval);
      void supabase.removeChannel(channel);
      window.removeEventListener("online", reconnect); window.removeEventListener("offline", disconnect);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [user.id, refresh]);

  // Clicking a notification while the app is open switches to that chat.
  useEffect(() => {
    const worker = navigator.serviceWorker;
    const openChat = event => { if (event.data?.type === "open-chat" && event.data.room) { setView("chats"); setParams({ chat: event.data.room }); } };
    worker?.addEventListener("message", openChat);
    return () => worker?.removeEventListener("message", openChat);
  }, [setParams]);
  const unread = rooms.reduce((sum, r) => sum + Number(r.unread), 0);
  useEffect(() => {
    document.title = unread ? `(${unread > 99 ? "99+" : unread}) Chatterly` : "Chatterly";
    // Installed apps also show the count on their icon.
    void (unread ? navigator.setAppBadge?.(unread) : navigator.clearAppBadge?.())?.catch(() => {});
  }, [unread]);
  useEffect(() => () => { document.title = "Chatterly"; }, []);

  function open(id) { setView("chats"); setParams({ chat: id }); }
  async function signOut() {
    // Stop this device getting the account's notifications once signed out.
    await disablePush().catch(() => {});
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }
  const requestCount = social.requests.filter(r => r.recipient_id === user.id).length + social.invites.length;
  const filtered = rooms.filter(room => room.name.toLowerCase().includes(search.toLowerCase()) && (!unreadOnly || room.unread > 0));
  const tabs = [
    { id: "chats", name: "Chats", icon: MessageCircle, count: unread },
    { id: "contacts", name: "Contacts", icon: Users },
    { id: "requests", name: "Requests", icon: Inbox, count: requestCount },
    { id: "profile", name: "Profile", icon: UserRound },
  ];

  return <div className="messenger">
    <header className="app-header">
      <div className="brand"><img src={logo} alt="" /><span>Chatterly</span></div>
      <span className={`connection ${online && connection === "live" ? "live" : ""}`} role="status">{!online ? "Offline" : connection === "live" ? "Connected" : "Connecting..."}</span>
      <div className="header-actions"><NotificationToggle onError={setError} /><button className="button primary" onClick={() => setCreateGroup(true)} disabled={!profile?.username}><Plus size={18} /><span>New group</span></button><IconButton label="Sign out" onClick={signOut}><LogOut size={18} /></IconButton></div>
    </header>
    <div className="app-body">
      <nav className="navigation-rail" aria-label="Main navigation">
        {tabs.map(({ id, name, icon, count }) => { const Icon = icon; return <button key={id} className={view === id ? "nav-item active" : "nav-item"} aria-current={view === id ? "page" : undefined}
          disabled={!profile?.username && id !== "profile"} onClick={() => setView(id)}>
          <span className="nav-icon"><Icon size={21} />{count > 0 && <span className="badge">{count > 99 ? "99+" : count}</span>}</span><span>{name}</span>
        </button>; })}
        <span className="rail-avatar"><Avatar person={profile} /></span>
      </nav>
      <main className={`workspace ${view === "chats" && selected ? "has-conversation" : ""}`}>
        {error && <div className="error-banner" role="alert"><span>{error}</span><IconButton label="Retry connection" onClick={() => refresh().catch(e => setError(describeError(e)))}><RefreshCw size={17} /></IconButton></div>}
        {loading ? <div className="page-status"><Busy /></div> : !profile ? <div className="page-status">Your profile could not be loaded.</div> : !profile.username || view === "profile" ?
          <Profile key={user.id} user={user} profile={profile} blocked={social.blocked} onSaved={next => { setProfile(next); setView("chats"); }} onRefresh={refresh} onSignOut={signOut} /> :
          view === "contacts" ? <Contacts social={social} onChanged={refresh} onOpen={open} /> :
          view === "requests" ? <Requests social={social} userId={user.id} onChanged={refresh} onOpen={open} /> : <>
            <aside className="chat-sidebar">
              <div className="sidebar-heading"><h1>Chats</h1><span className="count">{rooms.length}</span></div>
              <label className="search-field"><Search size={18} /><input aria-label="Search chats" placeholder="Search conversations" value={search} onChange={e => setSearch(e.target.value)} /></label>
              <div className="segments" aria-label="Chat filter"><button aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All</button><button aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Unread</button></div>
              <div className="room-list">
                {filtered.map(room => <button key={room.id} className={`room-row ${selected === room.id ? "selected" : ""}`} onClick={() => open(room.id)} aria-current={selected === room.id ? "true" : undefined}>
                  <Avatar name={room.name} path={room.avatar_path} bucket={room.kind === "group" ? "chat-media" : "avatars"} />
                  <span className="room-copy"><strong>{room.name}</strong><span>{room.last_message}</span></span>
                  <span className="room-meta"><time>{clockTime(room.updated_at)}</time>{room.unread > 0 && <span className="unread">{room.unread}</span>}{room.kind === "group" && !room.unread && <Users size={13} />}</span>
                </button>)}
                {!filtered.length && <Status>{search ? "No matching conversations." : unreadOnly ? "All caught up." : "No conversations yet."}</Status>}
              </div>
              <div className="sidebar-footer"><Avatar person={profile} small /><span>@{profile.username}</span></div>
            </aside>
            {selected ? <Conversation key={selected} roomId={selected} profile={profile} rooms={rooms} contacts={social.contacts}
              revision={revision} online={online} onChanged={refresh} onBack={() => setParams({})} /> :
              <section className="welcome-empty"><img src={logo} alt="" /><h2>A little closer, wherever you are.</h2><button className="button secondary" onClick={() => setView("contacts")}><Users size={18} />Open contacts</button></section>}
          </>}
      </main>
    </div>
    {createGroup && <GroupForm contacts={social.contacts} onClose={() => setCreateGroup(false)} onCreated={async id => { await refresh(); open(id); }} />}
  </div>;
}
