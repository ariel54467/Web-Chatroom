import { useState } from "react";
import { Search, UserPlus, MessageCircle, Ban, Check, X, Undo2 } from "lucide-react";
import { Avatar, Busy, IconButton, Modal, Status } from "./ui";
import { describeError, rpc } from "../services/chatApi";

export function Contacts({ social, onChanged, onOpen }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [block, setBlock] = useState(null);
  async function search(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { setResults(await rpc("find_person", { p_username: query.replace(/^@/, "").trim() })); }
    catch (e) { setError(describeError(e)); } finally { setBusy(false); }
  }
  async function action(name, args) {
    setBusy(true); setError("");
    try {
      const result = await rpc(name, args);
      await onChanged();
      if (name === "open_direct") onOpen(result);
      if (name === "set_block") { setBlock(null); setResults(null); }
    } catch (e) { setError(describeError(e)); } finally { setBusy(false); }
  }
  return <section className="directory">
    <header className="section-heading"><div><span className="eyebrow">YOUR CIRCLE</span><h1>Contacts</h1></div><span className="count">{social.contacts.length}</span></header>
    <form className="person-search" onSubmit={search}><Search size={18} /><input aria-label="Find by username" placeholder="Find by exact username" value={query} onChange={e => setQuery(e.target.value)} required maxLength={25} /><button className="button secondary" disabled={busy}>Find</button></form>
    {error && <Status error>{error}</Status>}
    {results && <section><h3>Search results</h3>{results.length === 0 && <Status>No person found.</Status>}
      {results.map(person => {
        const friend = social.contacts.some(p => p.id === person.id);
        const requested = social.requests.some(r => r.profile.id === person.id);
        return <div className="person-row" key={person.id}><Avatar person={person} /><div className="person-copy"><strong>{person.display_name}</strong><span>@{person.username}</span></div>
          <button className="button secondary" disabled={busy || friend || requested} onClick={() => action("request_friend", { p_user: person.id })}><UserPlus size={16} />{friend ? "Contact" : requested ? "Pending" : "Add friend"}</button></div>;
      })}</section>}
    <h3>All contacts</h3>
    {!social.contacts.length && <Status>No contacts yet.</Status>}
    {social.contacts.map(person => <div className="person-row" key={person.id}>
      <Avatar person={person} /><div className="person-copy"><strong>{person.display_name}</strong><span>@{person.username}</span></div>
      <IconButton label={`Chat with ${person.display_name}`} disabled={busy} onClick={() => action("open_direct", { p_user: person.id })}><MessageCircle size={19} /></IconButton>
      <IconButton label={`Block ${person.display_name}`} disabled={busy} onClick={() => setBlock(person)}><Ban size={18} /></IconButton>
    </div>)}
    {block && <Modal title={`Block ${block.display_name}?`} onClose={() => !busy && setBlock(null)}>
      <p>They will no longer be able to send you friend requests or private messages. Shared group conversations remain visible.</p>
      <div className="modal-actions"><button className="button secondary" onClick={() => setBlock(null)} disabled={busy}>Cancel</button><button className="button danger" disabled={busy} onClick={() => action("set_block", { p_user: block.id, p_block: true })}>{busy ? <Busy /> : <Ban size={16} />}Block person</button></div>
    </Modal>}
  </section>;
}

export function Requests({ social, userId, onChanged, onOpen }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function respond(name, args, open) {
    setBusy(args.p_request || args.p_invite); setError("");
    try { const id = await rpc(name, args); await onChanged(); if (open) onOpen(id); }
    catch (e) { setError(describeError(e)); } finally { setBusy(""); }
  }
  return <section className="directory">
    <header className="section-heading"><div><span className="eyebrow">LET PEOPLE IN</span><h1>Requests</h1></div></header>
    {error && <Status error>{error}</Status>}
    <h3>Friend requests</h3>
    {!social.requests.length && <Status>No pending friend requests.</Status>}
    {social.requests.map(r => <div className="person-row" key={r.id}>
      <Avatar person={r.profile} /><div className="person-copy"><strong>{r.profile.display_name}</strong><span>@{r.profile.username}{r.sender_id === userId ? " / Sent" : ""}</span></div>
      {r.sender_id === userId ? <IconButton label="Cancel friend request" disabled={!!busy} onClick={() => respond("cancel_friend", { p_request: r.id })}><Undo2 size={18} /></IconButton> : <>
        <IconButton label={`Accept ${r.profile.display_name}`} disabled={!!busy} onClick={() => respond("respond_friend", { p_request: r.id, p_accept: true })}><Check size={20} /></IconButton>
        <IconButton label={`Decline ${r.profile.display_name}`} disabled={!!busy} onClick={() => respond("respond_friend", { p_request: r.id, p_accept: false })}><X size={20} /></IconButton>
      </>}
    </div>)}
    <h3>Group invitations</h3>
    {!social.invites.length && <Status>No pending group invitations.</Status>}
    {social.invites.map(r => <div className="person-row" key={r.id}>
      <Avatar name={r.room_name} /><div className="person-copy"><strong>{r.room_name}</strong><span>Invited by {r.profile.display_name}</span></div>
      <button className="button primary" disabled={!!busy} onClick={() => respond("respond_invite", { p_invite: r.id, p_accept: true }, true)}><Check size={16} />Join</button>
      <IconButton label={`Decline ${r.room_name}`} disabled={!!busy} onClick={() => respond("respond_invite", { p_invite: r.id, p_accept: false })}><X size={20} /></IconButton>
    </div>)}
  </section>;
}
