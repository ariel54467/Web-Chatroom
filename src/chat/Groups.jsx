import { useRef, useState } from "react";
import { Camera, Check, Crown, LogOut, Shield, Trash2, UserMinus, UserPlus, Save, Users } from "lucide-react";
import { Avatar, Busy, IconButton, Modal, Status } from "./ui";
import { describeError, removeFile, rpc, safeFilename, uploadFile, validateFile } from "../services/chatApi";

export function GroupForm({ contacts, roomId, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (roomId) await rpc("invite_members", { p_room: roomId, p_users: selected });
      const id = roomId || await rpc("create_group", { p_name: name, p_users: selected });
      await onCreated(id);
      onClose();
    } catch (e) { setError(describeError(e)); } finally { setBusy(false); }
  }
  return <Modal title={roomId ? "Invite contacts" : "New group"} onClose={() => !busy && onClose()}>
    <form className="stack-form" onSubmit={submit}>
      {!roomId && <label>Group name<input autoFocus required maxLength={60} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label>}
      <div className="section-heading compact"><h3>Contacts</h3><span>{selected.length} selected</span></div>
      <div className="member-picker">{contacts.map(person => <label className="person-row" key={person.id}>
        <Avatar person={person} /><span className="person-copy"><strong>{person.display_name}</strong><span>@{person.username}</span></span>
        <input type="checkbox" aria-label={person.display_name} checked={selected.includes(person.id)} disabled={busy}
          onChange={e => setSelected(prev => e.target.checked ? [...prev, person.id] : prev.filter(id => id !== person.id))} />
      </label>)}{!contacts.length && <Status>No contacts available to invite.</Status>}</div>
      {error && <Status error>{error}</Status>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="button primary" disabled={busy || selected.length === 0 || (!roomId && !name.trim())}>{busy ? <Busy /> : <UserPlus size={18} />}{roomId ? "Send invitations" : "Create group"}</button></div>
    </form>
  </Modal>;
}

export function GroupDetails({ details, userId, contacts, onClose, onChanged, onLeave }) {
  const [name, setName] = useState(details.room.name);
  const [invite, setInvite] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const avatarInput = useRef(null);
  const mine = details.members.find(m => m.user_id === userId);
  const admin = ["owner", "admin"].includes(mine?.role);
  async function act(action, user) {
    setBusy(true); setError("");
    try {
      await rpc("manage_group", { p_room: details.room.id, p_user: user || null, p_action: action, p_name: name });
      setConfirm(null);
      if (action === "leave") { onClose(); onLeave(); }
      else await onChanged();
    } catch (e) { setError(describeError(e)); } finally { setBusy(false); }
  }
  async function changeAvatar(file) {
    let path = null;
    const oldPath = details.room.avatar_path;
    setBusy(true); setError("");
    try {
      if (file) {
        validateFile(file, true);
        path = `${details.room.id}/${userId}/group-avatar/${crypto.randomUUID()}/${safeFilename(file.name)}`;
        await uploadFile("chat-media", path, file);
      }
      await rpc("manage_group", {
        p_room: details.room.id, p_action: "avatar", p_avatar_path: path,
      });
      await onChanged();
      if (oldPath) void removeFile("chat-media", oldPath).catch(() => {});
    } catch (e) {
      if (path) void removeFile("chat-media", path).catch(() => {});
      setError(describeError(e));
    } finally { setBusy(false); }
  }
  return <Modal title="Group details" onClose={() => !busy && onClose()}>
    <div className="group-profile">
      <Avatar name={details.room.name} path={details.room.avatar_path} bucket="chat-media" />
      {admin && <div>
        <IconButton label="Change group picture" disabled={busy} onClick={() => avatarInput.current?.click()}><Camera size={18} /></IconButton>
        {details.room.avatar_path && <IconButton label="Remove group picture" disabled={busy} onClick={() => changeAvatar(null)}><Trash2 size={17} /></IconButton>}
        <input ref={avatarInput} className="hidden-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ""; if (file) void changeAvatar(file);
        }} />
      </div>}
    </div>
    {admin ? <form className="inline-form" onSubmit={e => { e.preventDefault(); act("rename"); }}><label>Group name<input value={name} maxLength={60} required onChange={e => setName(e.target.value)} disabled={busy} /></label><IconButton label="Save group name" disabled={busy || !name.trim()} onClick={() => act("rename")}><Save size={18} /></IconButton></form> : <h3>{name}</h3>}
    {error && <Status error>{error}</Status>}
    <div className="section-heading compact"><h3>Members ({details.members.length})</h3>{admin && <IconButton label="Invite contacts" onClick={() => setInvite(true)}><UserPlus size={19} /></IconButton>}</div>
    <div className="member-picker">{details.members.map(member => <div className="person-row" key={member.user_id}>
      <Avatar person={member.profile} /><div className="person-copy"><strong>{member.profile.display_name}{member.user_id === userId ? " (you)" : ""}</strong><span>@{member.profile.username}</span></div>
      {member.role === "owner" ? <Crown size={17} aria-label="Owner" /> : member.role === "admin" ? <Shield size={17} aria-label="Admin" /> : null}
      {mine?.role === "owner" && member.user_id !== userId && <IconButton label={member.role === "admin" ? `Remove admin ${member.profile.display_name}` : `Make admin ${member.profile.display_name}`} disabled={busy} onClick={() => act(member.role === "admin" ? "demote" : "promote", member.user_id)}><Shield size={17} /></IconButton>}
      {admin && member.user_id !== userId && member.role !== "owner" && (mine?.role === "owner" || member.role === "member") && <IconButton label={`Remove ${member.profile.display_name}`} disabled={busy} onClick={() => setConfirm({ action: "remove", person: member.profile })}><UserMinus size={18} /></IconButton>}
    </div>)}</div>
    {details.invites.length > 0 && <><h3>Invited</h3>{details.invites.map(i => <div className="person-row" key={i.id}><Users size={18} /><span className="person-copy">{i.profile.display_name}</span><span className="muted">Pending</span></div>)}</>}
    <button className="button danger quiet" onClick={() => setConfirm({ action: "leave" })} disabled={busy}><LogOut size={17} />Leave group</button>
    {invite && <GroupForm roomId={details.room.id} contacts={contacts.filter(p => !details.members.some(m => m.user_id === p.id))} onClose={() => setInvite(false)} onCreated={onChanged} />}
    {confirm && <Modal title={confirm.action === "leave" ? "Leave this group?" : `Remove ${confirm.person.display_name}?`} onClose={() => !busy && setConfirm(null)}>
      <p>{confirm.action === "leave" ? "You will lose access to this group's messages and files. If you are the owner, ownership passes to the earliest remaining member." : "This person will lose access to the group's messages and files."}</p>
      <div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button><button className="button danger" disabled={busy} onClick={() => act(confirm.action, confirm.person?.id)}>{busy ? <Busy /> : <Check size={16} />}Confirm</button></div>
    </Modal>}
  </Modal>;
}
