"use client";

import { useState } from "react";

const STATUS_COLORS = {
  prospect: { bg: "#f59e0b33", text: "#f59e0b" },
  onboarding: { bg: "#3b82f633", text: "#3b82f6" },
  active: { bg: "#22c55e33", text: "#22c55e" },
  inactive: { bg: "#6b728033", text: "#6b7280" },
  alumni: { bg: "#8b5cf633", text: "#8b5cf6" },
};

const STATUS_OPTIONS = ["prospect", "onboarding", "active", "inactive", "alumni"];

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.prospect;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 8,
      fontSize: 10, fontWeight: 600, background: c.bg, color: c.text, textTransform: "uppercase",
    }}>
      {status}
    </span>
  );
}

function VolunteerCard({ volunteer, onUpdate }) {
  const [updating, setUpdating] = useState(false);
  const v = volunteer;

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/volunteers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, status: newStatus }),
      });
      if (res.ok && onUpdate) onUpdate(v.id, { status: newStatus });
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setUpdating(false);
    }
  };

  const capabilities = [
    v.can_do_anniversaries && "Anniversaries",
    v.can_do_social_media && "Social Media",
    v.can_do_design && "Design",
    v.can_do_shipping && "Shipping",
  ].filter(Boolean);

  const onboardingChecks = [
    { label: "Slack", done: v.slack_joined },
    { label: "Google Workspace", done: v.google_workspace_setup },
    { label: "Training", done: v.training_complete },
  ];

  return (
    <div className="task-card" style={{ opacity: updating ? 0.5 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{v.first_name} {v.last_name}</div>
          {v.email && <div style={{ fontSize: 11, color: "#9ca3af" }}>{v.email}</div>}
        </div>
        <StatusBadge status={v.status} />
      </div>

      {/* Onboarding checklist */}
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        {onboardingChecks.map(check => (
          <span key={check.label} style={{
            fontSize: 10, color: check.done ? "#22c55e" : "#4b5563",
          }}>
            {check.done ? "\u2713" : "\u25cb"} {check.label}
          </span>
        ))}
      </div>

      {/* Capabilities */}
      {capabilities.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
          {capabilities.map(cap => (
            <span key={cap} style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 4,
              background: "#ffffff11", color: "#9ca3af",
            }}>
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* Status changer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {v.onboarded_date && (
          <span style={{ fontSize: 10, color: "#6b7280" }}>
            Onboarded: {new Date(v.onboarded_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}
        <select
          value={v.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          style={{
            fontSize: 10, padding: "1px 4px", borderRadius: 4,
            background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333",
            cursor: "pointer",
          }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {v.notes && (
        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, fontStyle: "italic" }}>
          {v.notes}
        </div>
      )}
    </div>
  );
}

function AddVolunteerForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/volunteers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status: "prospect" }),
      });
      if (res.ok) {
        setForm({ first_name: "", last_name: "", email: "", phone: "" });
        setOpen(false);
        if (onCreated) onCreated();
      }
    } catch (err) {
      console.error("Create failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="create-task-btn">
        + Add Volunteer
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="create-task-form">
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required
          style={{ flex: 1, padding: "8px 10px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 13 }} />
        <input placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required
          style={{ flex: 1, padding: "8px 10px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 13 }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={{ flex: 1, padding: "8px 10px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 13 }} />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
          style={{ flex: 1, padding: "8px 10px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 13 }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving}
          style={{ padding: "6px 16px", background: "#c4a237", color: "#000", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Adding..." : "Add Volunteer"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          style={{ padding: "6px 16px", background: "transparent", color: "#9ca3af", border: "1px solid #333", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function VolunteerList({ initialVolunteers = [] }) {
  const [volunteers, setVolunteers] = useState(initialVolunteers);
  const [filterStatus, setFilterStatus] = useState("");

  const handleUpdate = (id, updates) => {
    setVolunteers(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const handleCreated = async () => {
    try {
      const res = await fetch("/api/volunteers");
      const data = await res.json();
      if (data.volunteers) setVolunteers(data.volunteers);
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  };

  const filtered = filterStatus ? volunteers.filter(v => v.status === filterStatus) : volunteers;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <AddVolunteerForm onCreated={handleCreated} />
        <div style={{ flex: 1 }} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: "5px 8px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 32, gridColumn: "1 / -1" }}>
            No volunteers {filterStatus ? `with status "${filterStatus}"` : "yet"}. Click "+ Add Volunteer" to get started.
          </div>
        )}
        {filtered.map(v => (
          <VolunteerCard key={v.id} volunteer={v} onUpdate={handleUpdate} />
        ))}
      </div>
    </div>
  );
}
