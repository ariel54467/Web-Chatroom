import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { ref, onValue, push, set } from "firebase/database";
import "../css/AddMenu.css";

export const AddMenu = ({ onClose }) => {
  const [groupName, setGroupName] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState({});
  const currentUser = auth.currentUser;

  useEffect(() => {
    const usersRef = ref(db, "users");
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const userList = Object.entries(data)
        .filter(([uid]) => uid !== currentUser.uid) 
        .map(([uid, info]) => ({ uid, ...info }));
      setAllUsers(userList);
    });
  }, [currentUser]);

  const handleCreateGroup = async () => {
    if (!groupName.trim() || Object.keys(selectedMembers).length === 0) {
      alert("Please enter a group name and select at least one member.");
      return;
    }

    const groupRef = push(ref(db, "chats"));
    const members = {
      [currentUser.uid]: true, 
      ...selectedMembers,
    };

    await set(groupRef, {
      name: groupName,
      members,
      type: "group"
    });

    alert("Group created!");
    setGroupName("");
    setSelectedMembers({});
    onClose();
  };

  const toggleMember = (uid) => {
    setSelectedMembers((prev) =>
      prev[uid] ? { ...prev, [uid]: undefined } : { ...prev, [uid]: true }
    );
  };

  return (
    <div className="addmenu-overlay">
      <div className="addmenu">
        <div className="addmenu-header">
          <h3>Create Group Chat</h3>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="addmenu-body">
          <input
            type="text"
            placeholder="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <div className="friend-checkboxes">
            {allUsers.map((user) => (
             <label key={user.uid}>
             <span>{user.userName || user.email}</span>
             <input
               type="checkbox"
               checked={!!selectedMembers[user.uid]}
               onChange={() => toggleMember(user.uid)}
             />
           </label>           
            ))}
          </div>
          <button onClick={handleCreateGroup}>Create</button>
        </div>
      </div>
    </div>
  );
};
