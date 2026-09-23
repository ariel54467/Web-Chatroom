import { useState } from "react";
import { Camera, LogOut, Save, ShieldOff } from "lucide-react";
import { Avatar, Busy, Status } from "./ui";
import { describeError, rpc, removeFile, uploadFile, validateFile, safeFilename } from "../services/chatApi";

export function Profile({ user, profile, blocked = [], onSaved, onRefresh, onSignOut }) {
  const [name, setName] = useState(profile?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState(null);
  async function save(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    let path = profile?.avatar_path || null;
    let uploaded;
    try {
      if (file) {
        path = `${user.id}/${crypto.randomUUID()}/${safeFilename(file.name)}`;
        await uploadFile("avatars", path, file);
        uploaded = path;
      }
      const next = await rpc("save_profile", { p_username: username, p_display_name: name, p_avatar_path: path });
      onSaved(next); setFile(null); setNotice("Profile saved.");
      if (uploaded && profile?.avatar_path) void removeFile("avatars", profile.avatar_path).catch(() => {});
    } catch (e) {
      setError(describeError(e));
      if (uploaded) void removeFile("avatars", uploaded).catch(() => {});
    } finally { setBusy(false); }
  }
  async function unblock(id) {
    setBusy(true); setError("");
    try { await rpc("set_block", { p_user: id, p_block: false }); await onRefresh(); }
    catch (e) { setError(describeError(e)); } finally { setBusy(false); }
  }
  return <section className="profile-panel">
    <div className="profile-heading"><Avatar person={profile} name={name} /><div><h2>{profile?.username ? "Your profile" : "Make it yours"}</h2><p>{user.email}</p></div></div>
    <form className="stack-form" onSubmit={save}>
      <label>Display name<input required maxLength={60} value={name} onChange={e => setName(e.target.value)} disabled={busy} autoComplete="nickname" /></label>
      <label>Username<span className="username-input"><span>@</span><input required pattern="[a-z0-9_]{3,24}" minLength={3} maxLength={24}
        title="3-24 lowercase letters, numbers, or underscores" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} disabled={busy} /></span></label>
      <label className="file-control"><Camera size={18} />{file?.name || "Choose profile photo"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
        onChange={e => { try { const next = e.target.files?.[0]; if (next) { validateFile(next, true); setFile(next); setError(""); } } catch (err) { setError(err.message); } e.target.value = ""; }} /></label>
      {error && <Status error>{error}</Status>}{notice && <Status>{notice}</Status>}
      <button className="button primary" disabled={busy}>{busy ? <Busy /> : <Save size={18} />}Save profile</button>
    </form>
    {blocked.length > 0 && <section className="blocked-list"><h3>Blocked people</h3>{blocked.map(person => <div className="person-row" key={person.id}>
      <Avatar person={person} /><div className="person-copy"><strong>{person.display_name}</strong><span>@{person.username}</span></div>
      <button className="button quiet" disabled={busy} onClick={() => unblock(person.id)}><ShieldOff size={16} />Unblock</button>
    </div>)}</section>}
    <button className="button quiet signout" onClick={onSignOut} disabled={busy}><LogOut size={18} />Sign out</button>
  </section>;
}
