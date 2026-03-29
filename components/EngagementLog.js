"use client";

import { useState } from "react";

const TYPE_COLORS = {
  email: { bg: "#3b82f633", text: "#3b82f6" },
  phone: { bg: "#22c55e33", text: "#22c55e" },
  in_person: { bg: "#f59e0b33", text: "#f59e0b" },
  partnership: { bg: "#8b5cf633", text: "#8b5cf6" },
  social_media: { bg: "#ec489933", text: "#ec4899" },
  event: { bg: "#c4a23733", text: "#c4a237" },
  other: { bg: "#6b728033", text: "#6b7280" },
};

const TYPE_OPTIONS = ["email", "phone", "in_person", "partnership", "social_media", "event", "other"];

function TypeBadge({ type }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.other;
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 8,
      fontSize: 10, fontWeight: 600, background: c.bg, color: c.text,
    }}>
      {type?.replace("_", " ")}
    </span>
  );
}

function EngagementCard({ engagement }) {
  const e = engagement;
  return (
    <div className="task-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{e.subject}</div>
        <TypeBadge type={e.type} />
      </div>
      {e.description && (
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, lineHeight: 1.4 }}>
          {e.description.length > 150 ? e.description.slice(0, 150) + "..." : e.description}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#6b7280" }}>
        <span>{new Date(e.engagement_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {e.outcome && <span style={{ color: "#9ca3af" }}>{e.outcome}</span>}
          {e.follow_up_needed && <span style={{ color: "#f59e0b", fontWeight: 600 }}>Follow-up needed</span>}
        </div>
      </div>
    </div>
  );
}

function AddEngagementForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "email", subject: "", description: "", outcome: "", follow_up_needed: false });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ type: "email", subject: "", description: "", outcome: "", follow_up_needed: false });
        setOpen(false);
        if (onCreated) onCreated();
      }
    } catch (err) {
      console.error("Create failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return <button onClick={() => setOpen(true)} className="create-task-btn">+ Log Engagement</button>;

  return (
    <form onSubmit={handleSubmit} className="create-task-form">
      <div style={{ display: "flex", gap: 8 }}>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
          style={{ padding: "8px 10px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </select>
        <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required autoFocus
          style={{ flex: 1, padding: "8px 10px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 13 }} />
      </div>
      <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
        style={{ width: "100%", padding: "8px 10px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input placeholder="Outcome" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}
          style={{ flex: 1, padding: "8px 10px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12 }} />
        <label style={{ fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={form.follow_up_needed} onChange={(e) => setForm({ ...form, follow_up_needed: e.target.checked })} />
          Follow-up
        </label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving}
          style={{ padding: "6px 16px", background: "#c4a237", color: "#000", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Logging..." : "Log Engagement"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          style={{ padding: "6px 16px", background: "transparent", color: "#9ca3af", border: "1px solid #333", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function EngagementLog({ initialEngagements = [] }) {
  const [engagements, setEngagements] = useState(initialEngagements);
  const [filterType, setFilterType] = useState("");

  const handleCreated = async () => {
    try {
      const res = await fetch("/api/engagements");
      const data = await res.json();
      if (data.engagements) setEngagements(data.engagements);
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  };

  const filtered = filterType ? engagements.filter(e => e.type === filterType) : engagements;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <AddEngagementForm onCreated={handleCreated} />
        <div style={{ flex: 1 }} />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: "5px 8px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}>
          <option value="">All Types</option>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </select>
      </div>

      <div className="task-list">
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 32 }}>
            No engagements logged yet. Click "+ Log Engagement" to start tracking interactions.
          </div>
        )}
        {filtered.map(e => <EngagementCard key={e.id} engagement={e} />)}
      </div>
    </div>
  );
}
