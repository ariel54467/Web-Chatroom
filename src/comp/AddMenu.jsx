import { useEffect, useRef, useState } from "react";
import { auth, db } from "../firebase";
import { ref, onValue, push, set, serverTimestamp } from "firebase/database";
import "../css/AddMenu.css";

export const AddMenu = ({ onClose }) => {
  const [groupName, setGroupName] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const groupNameRef = useRef(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    groupNameRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    if (!currentUser) {
      setError("You need to sign in before creating a group.");
      setIsLoading(false);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }

    const usersRef = ref(db, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const userList = Object.entries(data)
        .filter(([uid]) => uid !== currentUser.uid)
        .map(([uid, info]) => ({ uid, ...info }))
        .sort((a, b) => (a.userName || a.email || "").localeCompare(b.userName || b.email || ""));
      setAllUsers(userList);
      setIsLoading(false);
    }, () => {
      setError("Could not load the member list.");
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentUser, onClose]);

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    const selectedMemberIds = Object.keys(selectedMembers);

    if (!groupName.trim() || selectedMemberIds.length === 0) {
      setError("Enter a group name and choose at least one member.");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const groupRef = push(ref(db, "chats"));
      const members = {
        [currentUser.uid]: true,
        ...Object.fromEntries(selectedMemberIds.map((uid) => [uid, true])),
      };

      await set(groupRef, {
        name: groupName.trim(),
        members,
        type: "group",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onClose();
    } catch {
      setError("The group could not be created. Please try again.");
      setIsCreating(false);
    }
  };

  const toggleMember = (uid) => {
    setSelectedMembers((previous) => {
      const next = { ...previous };
      if (next[uid]) {
        delete next[uid];
      } else {
        next[uid] = true;
      }
      return next;
    });
    setError("");
  };

  return (
    <div className="addmenu-overlay" onClick={onClose}>
      <div
        className="addmenu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="addmenu-header">
          <div>
            <h2 id="create-group-title">Create a group</h2>
            <p>Choose who you want to chat with.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" title="Close">
            <span aria-hidden="true">{"\u00d7"}</span>
          </button>
        </div>

        <form className="addmenu-body" onSubmit={handleCreateGroup}>
          <label htmlFor="group-name">Group name</label>
          <input
            ref={groupNameRef}
            id="group-name"
            type="text"
            placeholder="e.g. Project team"
            value={groupName}
            onChange={(event) => {
              setGroupName(event.target.value);
              setError("");
            }}
            maxLength={60}
            required
          />
          <div className="member-heading">
            <span>Members</span>
            <span>{Object.keys(selectedMembers).length} selected</span>
          </div>
          <div className="friend-checkboxes">
            {isLoading && <p className="member-status">Loading people...</p>}
            {!isLoading && allUsers.length === 0 && (
              <p className="member-status">No other users are available yet.</p>
            )}
            {allUsers.map((user) => (
              <label key={user.uid}>
                <span className="member-avatar" aria-hidden="true">
                  {(user.userName || user.email || "?").charAt(0).toUpperCase()}
                </span>
                <span className="member-copy">
                  <strong>{user.userName || user.email}</strong>
                  {user.userName && <small>{user.email}</small>}
                </span>
                <input
                  type="checkbox"
                  checked={!!selectedMembers[user.uid]}
                  onChange={() => toggleMember(user.uid)}
                />
              </label>
            ))}
          </div>
          {error && <p className="addmenu-error" role="alert">{error}</p>}
          <div className="addmenu-actions">
            <button type="button" className="cancel" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="create"
              disabled={isCreating || isLoading || allUsers.length === 0}
            >
              {isCreating ? "Creating..." : "Create group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
