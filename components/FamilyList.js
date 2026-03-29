"use client";

import { useState } from "react";

function ContactCard({ contact }) {
  const c = contact;
  const org = c.organization?.name;
  const hasAddress = c.mailing_city || c.mailing_state;

  return (
    <div className="task-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {c.first_name} {c.last_name}
        </div>
        {org && (
          <span style={{
            fontSize: 10, padding: "1px 6px", borderRadius: 8,
            background: "#3b82f633", color: "#3b82f6",
          }}>
            {org}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {c.email && (
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.email}</div>
        )}
        {c.phone && (
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.phone}</div>
        )}
        {hasAddress && (
          <div style={{ fontSize: 11, color: "#6b7280" }}>
            {[c.mailing_city, c.mailing_state, c.mailing_postal].filter(Boolean).join(", ")}
          </div>
        )}
        {!c.email && (
          <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 500 }}>No email on file</div>
        )}
      </div>
    </div>
  );
}

export default function FamilyList({ initialContacts = [] }) {
  const [contacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [filterEmail, setFilterEmail] = useState("");

  const filtered = contacts.filter(c => {
    const name = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase()) && !(c.email || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEmail === "has" && !c.email) return false;
    if (filterEmail === "missing" && c.email) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 300, padding: "6px 10px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}
        />
        <select value={filterEmail} onChange={(e) => setFilterEmail(e.target.value)}
          style={{ padding: "5px 8px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}>
          <option value="">All Contacts</option>
          <option value="has">Has Email</option>
          <option value="missing">Missing Email</option>
        </select>
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {filtered.length} of {contacts.length}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 32, gridColumn: "1 / -1" }}>
            No contacts match your search.
          </div>
        )}
        {filtered.map(c => (
          <ContactCard key={c.id} contact={c} />
        ))}
      </div>
    </div>
  );
}
