"use client";
import { useState } from "react";
import DataCard from "@/components/DataCard";

const STATUS_COLORS = {
  planning: "var(--text-dim)",
  active: "var(--status-blue)",
  complete: "var(--status-green)",
  cancelled: "var(--status-red)",
};

const STATUS_BG = {
  planning: "rgba(112,120,128,0.12)",
  active: "var(--status-blue-bg)",
  complete: "var(--status-green-bg)",
  cancelled: "var(--status-red-bg)",
};

const TIER_COLORS = {
  platinum: "#e5e4e2",
  gold: "var(--gold)",
  silver: "#c0c0c0",
  bronze: "#cd7f32",
  "in-kind": "var(--text-dim)",
};

const SPONSOR_STATUS_COLORS = {
  prospect: "var(--text-dim)",
  confirmed: "var(--status-blue)",
  paid: "var(--status-green)",
  declined: "var(--status-red)",
};

const SPONSOR_STATUS_BG = {
  prospect: "rgba(112,120,128,0.12)",
  confirmed: "var(--status-blue-bg)",
  paid: "var(--status-green-bg)",
  declined: "var(--status-red-bg)",
};

const TASK_CATEGORIES = ["permits", "signage", "supplies", "logistics", "marketing", "volunteers", "general"];
const SPONSOR_TIERS = ["platinum", "gold", "silver", "bronze", "in-kind"];
const SPONSOR_STATUSES = ["prospect", "confirmed", "paid", "declined"];
const EVENT_STATUSES = ["planning", "active", "complete", "cancelled"];

function StatusPill({ status, colors, bgs, label }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 10px",
      borderRadius: "var(--radius-pill)",
      fontSize: 11,
      fontWeight: 600,
      textTransform: "capitalize",
      background: bgs[status] || "rgba(112,120,128,0.12)",
      color: colors[status] || "var(--text-dim)",
    }}>
      {label || status}
    </span>
  );
}

function TierPill({ tier }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 10px",
      borderRadius: "var(--radius-pill)",
      fontSize: 11,
      fontWeight: 600,
      textTransform: "capitalize",
      background: "rgba(255,255,255,0.06)",
      color: TIER_COLORS[tier] || "var(--text-dim)",
      border: `1px solid ${TIER_COLORS[tier] || "var(--border)"}`,
    }}>
      {tier}
    </span>
  );
}

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: "var(--text-dim)" }}>
        <span>{value} of {max} complete</span>
        <span>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${pct}%`, background: color || "var(--gold)" }}
        />
      </div>
    </div>
  );
}

function fmt(n) {
  if (n == null || n === "") return "--";
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d) {
  if (!d) return "--";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  background: "var(--bg)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-dim)",
  marginBottom: 4,
};

export default function EventManager({ initialEvents }) {
  const [events, setEvents] = useState(initialEvents || []);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeTab, setActiveTab] = useState("checklist");
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [eventDetail, setEventDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [newEvent, setNewEvent] = useState({
    name: "", event_date: "", location: "", description: "",
    status: "planning", revenue_expected: "",
  });

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", category: "general", due_date: "" });

  const [showAddSponsor, setShowAddSponsor] = useState(false);
  const [newSponsor, setNewSponsor] = useState({
    sponsor_name: "", contact_name: "", contact_email: "",
    amount_pledged: "", tier: "bronze", status: "prospect",
  });

  const [showAddBudget, setShowAddBudget] = useState(false);
  const [newBudget, setNewBudget] = useState({
    description: "", category: "expense", amount_budgeted: "", amount_actual: "", vendor: "",
  });

  const [editingInfo, setEditingInfo] = useState(false);
  const [infoEdits, setInfoEdits] = useState({});

  async function selectEvent(event) {
    if (selectedEvent?.id === event.id) {
      setSelectedEvent(null);
      setEventDetail(null);
      setEditingInfo(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedEvent(data.event);
      setEventDetail({ tasks: data.tasks, sponsors: data.sponsors, budgetItems: data.budgetItems });
      setActiveTab("checklist");
      setEditingInfo(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createEvent() {
    if (!newEvent.name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEvent.name.trim(),
          event_date: newEvent.event_date || null,
          location: newEvent.location || null,
          description: newEvent.description || null,
          status: newEvent.status,
          revenue_expected: parseFloat(newEvent.revenue_expected) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEvents([data.event, ...events]);
      setShowNewEvent(false);
      setNewEvent({ name: "", event_date: "", location: "", description: "", status: "planning", revenue_expected: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveInfoEdits() {
    if (!selectedEvent) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: infoEdits.name ?? selectedEvent.name,
          event_date: infoEdits.event_date ?? selectedEvent.event_date,
          location: infoEdits.location ?? selectedEvent.location,
          description: infoEdits.description ?? selectedEvent.description,
          status: infoEdits.status ?? selectedEvent.status,
          registration_count: infoEdits.registration_count !== undefined
            ? parseInt(infoEdits.registration_count) || 0
            : selectedEvent.registration_count,
          revenue_expected: infoEdits.revenue_expected !== undefined
            ? parseFloat(infoEdits.revenue_expected) || 0
            : selectedEvent.revenue_expected,
          revenue_actual: infoEdits.revenue_actual !== undefined
            ? parseFloat(infoEdits.revenue_actual) || 0
            : selectedEvent.revenue_actual,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedEvent(data.event);
      setEvents(prev => prev.map(e => e.id === data.event.id ? { ...e, ...data.event } : e));
      setEditingInfo(false);
      setInfoEdits({});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleTask(taskId, completed) {
    setError(null);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "toggle", taskId, completed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEventDetail(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? data.task : t),
      }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function addTask() {
    if (!newTask.title.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title.trim(),
          category: newTask.category,
          due_date: newTask.due_date || null,
          sort_order: eventDetail.tasks.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEventDetail(prev => ({ ...prev, tasks: [...prev.tasks, data.task] }));
      setNewTask({ title: "", category: "general", due_date: "" });
      setShowAddTask(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addSponsor() {
    if (!newSponsor.sponsor_name.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/sponsors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsor_name: newSponsor.sponsor_name.trim(),
          contact_name: newSponsor.contact_name || null,
          contact_email: newSponsor.contact_email || null,
          amount_pledged: parseFloat(newSponsor.amount_pledged) || 0,
          tier: newSponsor.tier,
          status: newSponsor.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEventDetail(prev => ({ ...prev, sponsors: [data.sponsor, ...prev.sponsors] }));
      setNewSponsor({ sponsor_name: "", contact_name: "", contact_email: "", amount_pledged: "", tier: "bronze", status: "prospect" });
      setShowAddSponsor(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateSponsorStatus(sponsorId, newStatus) {
    setError(null);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/sponsors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "update", sponsorId, updates: { status: newStatus } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEventDetail(prev => ({
        ...prev,
        sponsors: prev.sponsors.map(s => s.id === sponsorId ? data.sponsor : s),
      }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function addBudgetItem() {
    if (!newBudget.description.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newBudget.description.trim(),
          category: newBudget.category,
          amount_budgeted: parseFloat(newBudget.amount_budgeted) || 0,
          amount_actual: parseFloat(newBudget.amount_actual) || 0,
          vendor: newBudget.vendor || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEventDetail(prev => ({ ...prev, budgetItems: [...prev.budgetItems, data.item] }));
      setNewBudget({ description: "", category: "expense", amount_budgeted: "", amount_actual: "", vendor: "" });
      setShowAddBudget(false);
    } catch (err) {
      setError(err.message);
    }
  }

  const completedTasks = eventDetail ? eventDetail.tasks.filter(t => t.completed).length : 0;
  const totalTasks = eventDetail ? eventDetail.tasks.length : 0;

  const totalPledged = eventDetail
    ? eventDetail.sponsors.reduce((s, sp) => s + (sp.amount_pledged || 0), 0)
    : 0;
  const totalReceived = eventDetail
    ? eventDetail.sponsors.reduce((s, sp) => s + (sp.amount_received || 0), 0)
    : 0;

  const budgetExpenses = eventDetail
    ? eventDetail.budgetItems.filter(b => b.category === "expense")
    : [];
  const budgetRevenue = eventDetail
    ? eventDetail.budgetItems.filter(b => b.category === "revenue")
    : [];
  const totalBudgeted = budgetExpenses.reduce((s, b) => s + (b.amount_budgeted || 0), 0);
  const totalActual = budgetExpenses.reduce((s, b) => s + (b.amount_actual || 0), 0);
  const totalRevenueBudgeted = budgetRevenue.reduce((s, b) => s + (b.amount_budgeted || 0), 0);
  const totalRevenueActual = budgetRevenue.reduce((s, b) => s + (b.amount_actual || 0), 0);
  const netBudget = totalRevenueBudgeted - totalBudgeted;
  const netActual = totalRevenueActual - totalActual;

  const TABS = [
    { key: "checklist", label: "Checklist" },
    { key: "sponsors", label: "Sponsors" },
    { key: "budget", label: "Budget" },
    { key: "info", label: "Info" },
  ];

  return (
    <div>
      {error && (
        <div style={{
          background: "var(--status-red-bg)",
          border: "1px solid var(--status-red)",
          borderRadius: "var(--radius-sm)",
          padding: "10px 14px",
          marginBottom: 16,
          color: "var(--status-red)",
          fontSize: 13,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "var(--status-red)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>
            &times;
          </button>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
        <button
          className="btn btn-primary"
          onClick={() => { setShowNewEvent(!showNewEvent); setError(null); }}
        >
          {showNewEvent ? "Cancel" : "+ New Event"}
        </button>
      </div>

      {/* New event form */}
      {showNewEvent && (
        <div style={{
          background: "var(--card-bg)",
          border: "1px solid var(--gold-border)",
          borderRadius: "var(--radius-md)",
          padding: 20,
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-bright)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            New Event
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Event Name *</label>
              <input
                style={inputStyle}
                placeholder="e.g. Ruck & Roll 2025"
                value={newEvent.name}
                onChange={e => setNewEvent(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && createEvent()}
              />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                style={inputStyle}
                value={newEvent.event_date}
                onChange={e => setNewEvent(p => ({ ...p, event_date: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                style={inputStyle}
                value={newEvent.status}
                onChange={e => setNewEvent(p => ({ ...p, status: e.target.value }))}
              >
                {EVENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input
                style={inputStyle}
                placeholder="City, Venue"
                value={newEvent.location}
                onChange={e => setNewEvent(p => ({ ...p, location: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Revenue Goal ($)</label>
              <input
                type="number"
                style={inputStyle}
                placeholder="0"
                value={newEvent.revenue_expected}
                onChange={e => setNewEvent(p => ({ ...p, revenue_expected: e.target.value }))}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                placeholder="Event notes, goals, context..."
                value={newEvent.description}
                onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={createEvent} disabled={loading || !newEvent.name.trim()}>
              {loading ? "Creating..." : "Create Event"}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowNewEvent(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Event list */}
      {events.length === 0 ? (
        <div style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: "var(--radius-md)",
          padding: 40,
          textAlign: "center",
          color: "var(--text-dim)",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, color: "var(--text)" }}>No events yet.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Create your first event to get started.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {events.map(event => {
            const isSelected = selectedEvent?.id === event.id;
            return (
              <div key={event.id}>
                {/* Event card */}
                <div
                  onClick={() => selectEvent(event)}
                  style={{
                    background: isSelected ? "var(--card-hover)" : "var(--card-bg)",
                    border: `1px solid ${isSelected ? "var(--gold-border)" : "var(--card-border)"}`,
                    borderRadius: isSelected ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
                    padding: "16px 20px",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = "var(--card-border)"; }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-bright)" }}>{event.name}</span>
                        <StatusPill status={event.status} colors={STATUS_COLORS} bgs={STATUS_BG} />
                      </div>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--text-dim)" }}>
                        {event.event_date && <span>📅 {fmtDate(event.event_date)}</span>}
                        {event.location && <span>📍 {event.location}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 20, flexShrink: 0, fontSize: 12 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "var(--status-green)", fontWeight: 700, fontSize: 14 }}>
                          {fmt(event.revenue_actual)}
                        </div>
                        <div style={{ color: "var(--text-dim)" }}>of {fmt(event.revenue_expected)}</div>
                      </div>
                      {event.registration_count > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-bright)" }}>
                            {event.registration_count}
                          </div>
                          <div style={{ color: "var(--text-dim)" }}>registered</div>
                        </div>
                      )}
                      <div style={{ color: isSelected ? "var(--gold)" : "var(--text-dim)", fontSize: 16, alignSelf: "center" }}>
                        {isSelected ? "▲" : "▼"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isSelected && (
                  <div style={{
                    background: "var(--bg-2)",
                    border: "1px solid var(--gold-border)",
                    borderTop: "none",
                    borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                    overflow: "hidden",
                  }}>
                    {loading && !eventDetail ? (
                      <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>Loading...</div>
                    ) : eventDetail ? (
                      <>
                        {/* Tab bar */}
                        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-3)" }}>
                          {TABS.map(tab => (
                            <button
                              key={tab.key}
                              onClick={() => setActiveTab(tab.key)}
                              style={{
                                padding: "10px 18px",
                                fontSize: 12,
                                fontWeight: 500,
                                background: "none",
                                border: "none",
                                borderBottom: activeTab === tab.key ? "2px solid var(--gold)" : "2px solid transparent",
                                color: activeTab === tab.key ? "var(--gold)" : "var(--text-dim)",
                                cursor: "pointer",
                                transition: "color 0.15s",
                              }}
                            >
                              {tab.label}
                              {tab.key === "checklist" && totalTasks > 0 && (
                                <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-dim)" }}>
                                  {completedTasks}/{totalTasks}
                                </span>
                              )}
                              {tab.key === "sponsors" && eventDetail.sponsors.length > 0 && (
                                <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-dim)" }}>
                                  {eventDetail.sponsors.length}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>

                        {/* Tab content */}
                        <div style={{ padding: 20 }}>

                          {/* ── CHECKLIST TAB ── */}
                          {activeTab === "checklist" && (
                            <div>
                              {totalTasks > 0 && (
                                <ProgressBar value={completedTasks} max={totalTasks} />
                              )}

                              {/* Group tasks by category */}
                              {TASK_CATEGORIES.filter(cat =>
                                eventDetail.tasks.some(t => t.category === cat || (!t.category && cat === "general"))
                              ).map(cat => {
                                const catTasks = eventDetail.tasks.filter(t =>
                                  t.category === cat || (!t.category && cat === "general")
                                );
                                return (
                                  <div key={cat} style={{ marginTop: 16 }}>
                                    <div style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.08em",
                                      color: "var(--text-dim)",
                                      marginBottom: 6,
                                    }}>
                                      {cat}
                                    </div>
                                    {catTasks.map(task => (
                                      <div key={task.id} className="list-item" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                          <input
                                            type="checkbox"
                                            checked={task.completed}
                                            onChange={e => toggleTask(task.id, e.target.checked)}
                                            style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--gold)" }}
                                          />
                                          <div>
                                            <div className="list-item-title" style={{
                                              textDecoration: task.completed ? "line-through" : "none",
                                              color: task.completed ? "var(--text-dim)" : "var(--text-bright)",
                                            }}>
                                              {task.title}
                                            </div>
                                            {task.due_date && (
                                              <div className="list-item-sub">Due {fmtDate(task.due_date)}</div>
                                            )}
                                          </div>
                                        </div>
                                        {task.completed && task.completed_at && (
                                          <span style={{ fontSize: 11, color: "var(--status-green)" }}>
                                            Done {fmtDate(task.completed_at.slice(0, 10))}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}

                              {eventDetail.tasks.length === 0 && !showAddTask && (
                                <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "12px 0" }}>
                                  No tasks yet. Add your first checklist item below.
                                </div>
                              )}

                              {/* Add task form */}
                              {showAddTask ? (
                                <div style={{
                                  marginTop: 16,
                                  padding: 16,
                                  background: "var(--card-bg)",
                                  borderRadius: "var(--radius-sm)",
                                  border: "1px solid var(--border-strong)",
                                }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px", gap: 8, marginBottom: 8 }}>
                                    <div>
                                      <label style={labelStyle}>Task</label>
                                      <input
                                        style={inputStyle}
                                        placeholder="e.g. Submit permit application"
                                        value={newTask.title}
                                        onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                                        onKeyDown={e => e.key === "Enter" && addTask()}
                                        autoFocus
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Category</label>
                                      <select
                                        style={inputStyle}
                                        value={newTask.category}
                                        onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                                      >
                                        {TASK_CATEGORIES.map(c => (
                                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Due Date</label>
                                      <input
                                        type="date"
                                        style={inputStyle}
                                        value={newTask.due_date}
                                        onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                                      />
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button className="btn btn-primary" onClick={addTask} disabled={!newTask.title.trim()}>
                                      Add Task
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => { setShowAddTask(false); setNewTask({ title: "", category: "general", due_date: "" }); }}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  className="btn btn-ghost"
                                  style={{ marginTop: 14 }}
                                  onClick={() => setShowAddTask(true)}
                                >
                                  + Add Task
                                </button>
                              )}
                            </div>
                          )}

                          {/* ── SPONSORS TAB ── */}
                          {activeTab === "sponsors" && (
                            <div>
                              {/* Summary row */}
                              {eventDetail.sponsors.length > 0 && (
                                <div style={{ display: "flex", gap: 24, marginBottom: 16, padding: "12px 16px", background: "var(--bg-3)", borderRadius: "var(--radius-sm)" }}>
                                  <div>
                                    <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pledged</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{fmt(totalPledged)}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Received</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--status-green)" }}>{fmt(totalReceived)}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Outstanding</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-bright)" }}>{fmt(totalPledged - totalReceived)}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sponsors</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-bright)" }}>{eventDetail.sponsors.length}</div>
                                  </div>
                                </div>
                              )}

                              {eventDetail.sponsors.length === 0 ? (
                                <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "12px 0" }}>
                                  No sponsors yet. Add your first sponsor below.
                                </div>
                              ) : (
                                <div style={{ overflowX: "auto" }}>
                                  <table className="data-table">
                                    <thead>
                                      <tr>
                                        <th>Sponsor</th>
                                        <th>Tier</th>
                                        <th>Contact</th>
                                        <th>Pledged</th>
                                        <th>Received</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {eventDetail.sponsors.map(sp => (
                                        <tr key={sp.id}>
                                          <td>
                                            <div style={{ fontWeight: 600, color: "var(--text-bright)" }}>{sp.sponsor_name}</div>
                                            {sp.notes && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{sp.notes}</div>}
                                          </td>
                                          <td><TierPill tier={sp.tier} /></td>
                                          <td>
                                            {sp.contact_name && <div style={{ color: "var(--text-bright)" }}>{sp.contact_name}</div>}
                                            {sp.contact_email && (
                                              <a href={`mailto:${sp.contact_email}`} style={{ fontSize: 12, color: "var(--gold)" }}>
                                                {sp.contact_email}
                                              </a>
                                            )}
                                          </td>
                                          <td style={{ fontWeight: 600 }}>{fmt(sp.amount_pledged)}</td>
                                          <td style={{ color: "var(--status-green)", fontWeight: 600 }}>{fmt(sp.amount_received)}</td>
                                          <td>
                                            <select
                                              value={sp.status}
                                              onChange={e => updateSponsorStatus(sp.id, e.target.value)}
                                              style={{
                                                background: "none",
                                                border: "none",
                                                cursor: "pointer",
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: SPONSOR_STATUS_COLORS[sp.status],
                                                padding: "2px 4px",
                                              }}
                                            >
                                              {SPONSOR_STATUSES.map(s => (
                                                <option key={s} value={s} style={{ background: "var(--bg-3)", color: "var(--text)" }}>
                                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Add sponsor form */}
                              {showAddSponsor ? (
                                <div style={{
                                  marginTop: 16,
                                  padding: 16,
                                  background: "var(--card-bg)",
                                  borderRadius: "var(--radius-sm)",
                                  border: "1px solid var(--border-strong)",
                                }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-bright)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                                    Add Sponsor
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                    <div style={{ gridColumn: "1 / -1" }}>
                                      <label style={labelStyle}>Organization *</label>
                                      <input
                                        style={inputStyle}
                                        placeholder="Company or organization name"
                                        value={newSponsor.sponsor_name}
                                        onChange={e => setNewSponsor(p => ({ ...p, sponsor_name: e.target.value }))}
                                        autoFocus
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Contact Name</label>
                                      <input
                                        style={inputStyle}
                                        placeholder="First Last"
                                        value={newSponsor.contact_name}
                                        onChange={e => setNewSponsor(p => ({ ...p, contact_name: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Contact Email</label>
                                      <input
                                        type="email"
                                        style={inputStyle}
                                        placeholder="email@example.com"
                                        value={newSponsor.contact_email}
                                        onChange={e => setNewSponsor(p => ({ ...p, contact_email: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Tier</label>
                                      <select
                                        style={inputStyle}
                                        value={newSponsor.tier}
                                        onChange={e => setNewSponsor(p => ({ ...p, tier: e.target.value }))}
                                      >
                                        {SPONSOR_TIERS.map(t => (
                                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Status</label>
                                      <select
                                        style={inputStyle}
                                        value={newSponsor.status}
                                        onChange={e => setNewSponsor(p => ({ ...p, status: e.target.value }))}
                                      >
                                        {SPONSOR_STATUSES.map(s => (
                                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Amount Pledged ($)</label>
                                      <input
                                        type="number"
                                        style={inputStyle}
                                        placeholder="0"
                                        value={newSponsor.amount_pledged}
                                        onChange={e => setNewSponsor(p => ({ ...p, amount_pledged: e.target.value }))}
                                      />
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button className="btn btn-primary" onClick={addSponsor} disabled={!newSponsor.sponsor_name.trim()}>
                                      Add Sponsor
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => { setShowAddSponsor(false); setNewSponsor({ sponsor_name: "", contact_name: "", contact_email: "", amount_pledged: "", tier: "bronze", status: "prospect" }); }}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  className="btn btn-ghost"
                                  style={{ marginTop: 14 }}
                                  onClick={() => setShowAddSponsor(true)}
                                >
                                  + Add Sponsor
                                </button>
                              )}
                            </div>
                          )}

                          {/* ── BUDGET TAB ── */}
                          {activeTab === "budget" && (
                            <div>
                              {/* P&L summary */}
                              {eventDetail.budgetItems.length > 0 && (
                                <div style={{ marginBottom: 20 }}>
                                  <div style={{ display: "flex", gap: 20, marginBottom: 12, padding: "12px 16px", background: "var(--bg-3)", borderRadius: "var(--radius-sm)" }}>
                                    <div>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Revenue (Budgeted)</div>
                                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--status-green)" }}>{fmt(totalRevenueBudgeted)}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Expenses (Budgeted)</div>
                                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--status-red)" }}>{fmt(totalBudgeted)}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Net (Budgeted)</div>
                                      <div style={{ fontSize: 16, fontWeight: 700, color: netBudget >= 0 ? "var(--status-green)" : "var(--status-red)" }}>
                                        {fmt(netBudget)}
                                      </div>
                                    </div>
                                    <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 20, marginLeft: 4 }}>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Net (Actual)</div>
                                      <div style={{ fontSize: 16, fontWeight: 700, color: netActual >= 0 ? "var(--status-green)" : "var(--status-red)" }}>
                                        {fmt(netActual)}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Expenses vs revenue bar */}
                                  {(totalBudgeted > 0 || totalRevenueBudgeted > 0) && (
                                    <div style={{ marginBottom: 16 }}>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Budget allocation</div>
                                      <div style={{ height: 8, background: "var(--bg-4)", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                                        <div style={{
                                          width: totalRevenueBudgeted > 0
                                            ? `${Math.min(100, (totalBudgeted / totalRevenueBudgeted) * 100)}%`
                                            : "100%",
                                          background: "var(--status-red)",
                                          opacity: 0.7,
                                          transition: "width 0.3s",
                                        }} />
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>
                                        <span>Expenses: {fmt(totalBudgeted)}</span>
                                        <span>Revenue goal: {fmt(totalRevenueBudgeted)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Expenses */}
                              {budgetExpenses.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 8 }}>
                                    Expenses
                                  </div>
                                  <div style={{ overflowX: "auto" }}>
                                    <table className="data-table">
                                      <thead>
                                        <tr>
                                          <th>Description</th>
                                          <th>Vendor</th>
                                          <th>Budgeted</th>
                                          <th>Actual</th>
                                          <th>Variance</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {budgetExpenses.map(item => {
                                          const variance = (item.amount_budgeted || 0) - (item.amount_actual || 0);
                                          return (
                                            <tr key={item.id}>
                                              <td style={{ color: "var(--text-bright)" }}>{item.description}</td>
                                              <td style={{ color: "var(--text-dim)" }}>{item.vendor || "--"}</td>
                                              <td>{fmt(item.amount_budgeted)}</td>
                                              <td>{fmt(item.amount_actual)}</td>
                                              <td style={{ color: variance >= 0 ? "var(--status-green)" : "var(--status-red)", fontWeight: 600 }}>
                                                {variance >= 0 ? "+" : ""}{fmt(variance)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                        <tr style={{ background: "var(--bg-4)" }}>
                                          <td colSpan={2} style={{ fontWeight: 700, color: "var(--text-bright)" }}>Total Expenses</td>
                                          <td style={{ fontWeight: 700 }}>{fmt(totalBudgeted)}</td>
                                          <td style={{ fontWeight: 700 }}>{fmt(totalActual)}</td>
                                          <td style={{ fontWeight: 700, color: (totalBudgeted - totalActual) >= 0 ? "var(--status-green)" : "var(--status-red)" }}>
                                            {(totalBudgeted - totalActual) >= 0 ? "+" : ""}{fmt(totalBudgeted - totalActual)}
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Revenue items */}
                              {budgetRevenue.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 8 }}>
                                    Revenue
                                  </div>
                                  <div style={{ overflowX: "auto" }}>
                                    <table className="data-table">
                                      <thead>
                                        <tr>
                                          <th>Description</th>
                                          <th>Vendor / Source</th>
                                          <th>Budgeted</th>
                                          <th>Actual</th>
                                          <th>Variance</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {budgetRevenue.map(item => {
                                          const variance = (item.amount_actual || 0) - (item.amount_budgeted || 0);
                                          return (
                                            <tr key={item.id}>
                                              <td style={{ color: "var(--text-bright)" }}>{item.description}</td>
                                              <td style={{ color: "var(--text-dim)" }}>{item.vendor || "--"}</td>
                                              <td>{fmt(item.amount_budgeted)}</td>
                                              <td>{fmt(item.amount_actual)}</td>
                                              <td style={{ color: variance >= 0 ? "var(--status-green)" : "var(--status-red)", fontWeight: 600 }}>
                                                {variance >= 0 ? "+" : ""}{fmt(variance)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {eventDetail.budgetItems.length === 0 && !showAddBudget && (
                                <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "12px 0" }}>
                                  No budget items yet. Add your first line item below.
                                </div>
                              )}

                              {/* Add budget item form */}
                              {showAddBudget ? (
                                <div style={{
                                  marginTop: 16,
                                  padding: 16,
                                  background: "var(--card-bg)",
                                  borderRadius: "var(--radius-sm)",
                                  border: "1px solid var(--border-strong)",
                                }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-bright)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                                    Add Budget Item
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                                    <div style={{ gridColumn: "1 / -1" }}>
                                      <label style={labelStyle}>Description *</label>
                                      <input
                                        style={inputStyle}
                                        placeholder="e.g. Venue rental, T-shirt printing..."
                                        value={newBudget.description}
                                        onChange={e => setNewBudget(p => ({ ...p, description: e.target.value }))}
                                        autoFocus
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Type</label>
                                      <select
                                        style={inputStyle}
                                        value={newBudget.category}
                                        onChange={e => setNewBudget(p => ({ ...p, category: e.target.value }))}
                                      >
                                        <option value="expense">Expense</option>
                                        <option value="revenue">Revenue</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Budgeted ($)</label>
                                      <input
                                        type="number"
                                        style={inputStyle}
                                        placeholder="0"
                                        value={newBudget.amount_budgeted}
                                        onChange={e => setNewBudget(p => ({ ...p, amount_budgeted: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Actual ($)</label>
                                      <input
                                        type="number"
                                        style={inputStyle}
                                        placeholder="0"
                                        value={newBudget.amount_actual}
                                        onChange={e => setNewBudget(p => ({ ...p, amount_actual: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Vendor / Source</label>
                                      <input
                                        style={inputStyle}
                                        placeholder="Optional"
                                        value={newBudget.vendor}
                                        onChange={e => setNewBudget(p => ({ ...p, vendor: e.target.value }))}
                                      />
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button className="btn btn-primary" onClick={addBudgetItem} disabled={!newBudget.description.trim()}>
                                      Add Item
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => { setShowAddBudget(false); setNewBudget({ description: "", category: "expense", amount_budgeted: "", amount_actual: "", vendor: "" }); }}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  className="btn btn-ghost"
                                  style={{ marginTop: 14 }}
                                  onClick={() => setShowAddBudget(true)}
                                >
                                  + Add Budget Item
                                </button>
                              )}
                            </div>
                          )}

                          {/* ── INFO TAB ── */}
                          {activeTab === "info" && (
                            <div>
                              {editingInfo ? (
                                <div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                                    <div style={{ gridColumn: "1 / -1" }}>
                                      <label style={labelStyle}>Event Name</label>
                                      <input
                                        style={inputStyle}
                                        value={infoEdits.name ?? selectedEvent.name}
                                        onChange={e => setInfoEdits(p => ({ ...p, name: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Date</label>
                                      <input
                                        type="date"
                                        style={inputStyle}
                                        value={infoEdits.event_date ?? (selectedEvent.event_date || "")}
                                        onChange={e => setInfoEdits(p => ({ ...p, event_date: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Status</label>
                                      <select
                                        style={inputStyle}
                                        value={infoEdits.status ?? selectedEvent.status}
                                        onChange={e => setInfoEdits(p => ({ ...p, status: e.target.value }))}
                                      >
                                        {EVENT_STATUSES.map(s => (
                                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Location</label>
                                      <input
                                        style={inputStyle}
                                        value={infoEdits.location ?? (selectedEvent.location || "")}
                                        onChange={e => setInfoEdits(p => ({ ...p, location: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Registration Count</label>
                                      <input
                                        type="number"
                                        style={inputStyle}
                                        value={infoEdits.registration_count ?? (selectedEvent.registration_count || 0)}
                                        onChange={e => setInfoEdits(p => ({ ...p, registration_count: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Revenue Expected ($)</label>
                                      <input
                                        type="number"
                                        style={inputStyle}
                                        value={infoEdits.revenue_expected ?? (selectedEvent.revenue_expected || "")}
                                        onChange={e => setInfoEdits(p => ({ ...p, revenue_expected: e.target.value }))}
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Revenue Actual ($)</label>
                                      <input
                                        type="number"
                                        style={inputStyle}
                                        value={infoEdits.revenue_actual ?? (selectedEvent.revenue_actual || "")}
                                        onChange={e => setInfoEdits(p => ({ ...p, revenue_actual: e.target.value }))}
                                      />
                                    </div>
                                    <div style={{ gridColumn: "1 / -1" }}>
                                      <label style={labelStyle}>Description</label>
                                      <textarea
                                        style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                                        value={infoEdits.description ?? (selectedEvent.description || "")}
                                        onChange={e => setInfoEdits(p => ({ ...p, description: e.target.value }))}
                                      />
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button className="btn btn-primary" onClick={saveInfoEdits} disabled={loading}>
                                      {loading ? "Saving..." : "Save Changes"}
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => { setEditingInfo(false); setInfoEdits({}); }}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                                    <div>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Event Name</div>
                                      <div style={{ color: "var(--text-bright)", fontWeight: 600 }}>{selectedEvent.name}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Status</div>
                                      <StatusPill status={selectedEvent.status} colors={STATUS_COLORS} bgs={STATUS_BG} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Date</div>
                                      <div style={{ color: "var(--text-bright)" }}>{fmtDate(selectedEvent.event_date)}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Location</div>
                                      <div style={{ color: "var(--text-bright)" }}>{selectedEvent.location || "--"}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Registrations</div>
                                      <div style={{ color: "var(--text-bright)", fontWeight: 600 }}>{selectedEvent.registration_count || 0}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Revenue Expected</div>
                                      <div style={{ color: "var(--text-bright)", fontWeight: 600 }}>{fmt(selectedEvent.revenue_expected)}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Revenue Actual</div>
                                      <div style={{ color: "var(--status-green)", fontWeight: 600 }}>{fmt(selectedEvent.revenue_actual)}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Created</div>
                                      <div style={{ color: "var(--text-dim)" }}>{fmtDate(selectedEvent.created_at?.slice(0, 10))}</div>
                                    </div>
                                    {selectedEvent.description && (
                                      <div style={{ gridColumn: "1 / -1" }}>
                                        <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Description</div>
                                        <div style={{ color: "var(--text)", lineHeight: 1.6 }}>{selectedEvent.description}</div>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    className="btn btn-ghost"
                                    onClick={() => {
                                      setInfoEdits({});
                                      setEditingInfo(true);
                                    }}
                                  >
                                    Edit Info
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
