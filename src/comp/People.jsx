import React from "react";

export const People = () => {
  const contacts = [
    { id: 1, name: "Chat 1" },
    { id: 2, name: "Chat 2" },
  ];

  return (
    <div className="people-container">
      <div className="people-header">
        <h2>Contacts</h2>
      </div>

      <div className="people-list">
        {contacts.map((contact) => (
          <div className="chat-info" key={contact.id}>
            <span>{contact.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
