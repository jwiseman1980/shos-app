"use client";

import { useState, useMemo, useEffect } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount) {
  if (amount == null || amount === 0) return "None";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function computeIsOverdue(item) {
  return (
    item.due_date &&
    new Date(item.due_date) < new Date() &&
    !["filed", "confirmed", "waived"].includes(item.status)
  );
}

function computeDaysUntilDue(item) {
  if (!item.due_date) return null;
  return Math.ceil((new Date(item.due_date) - new Date()) / (1000 * 60 * 60 * 24));
}

// ── Badge Components ──────────────────────────────────────────────────────────

const STATUS_BADGE = {
  not_started: { label: "Not Started", cls: "badge-gray" },
  in_progress: { label: "In Progress", cls: "badge-blue" },
  filed: { label: "Filed", cls: "badge-green" },
  confirmed: { label: "Confirmed", cls: "badge-gold" },
  waived: { label: "Waived", cls: "badge-gray" },
  overdue: { label: "Overdue", cls: "badge-red" },
};

const CATEGORY_BADGE = {
  federal: { label: "Federal", cls: "badge-blue" },
  state: { label: "State", cls: "badge-purple" },
  registration: { label: "Registration", cls: "badge-orange" },
  internal: { label: "Internal", cls: "badge-gray" },
  other: { label: "Other", cls: "badge-gray" },
};

function StatusBadgeComp({ status, isOverdue }) {
  const effectiveStatus = isOverdue && !["filed", "confirmed", "waived"].includes(status) ? "overdue" : status;
  const cfg = STATUS_BADGE[effectiveStatus] || { label: effectiveStatus, cls: "badge-gray" };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}

function CategoryBadge({ category }) {
  const cfg = CATEGORY_BADGE[category] || { label: category, cls: "badge-gray" };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}

function DueDateChip({ item }) {
  const isOverdue = computeIsOverdue(item);
  const days = computeDaysUntilDue(item);
  const done = ["filed", "confirmed", "waived"].includes(item.status);

  if (!item.due_date) {
    return <span style={{ color: "var(--text-dim)", fontSize: 12 }}>No due date</span>;
  }

  let color = "var(--text-dim)";
  let label = formatDate(item.due_date);

  if (done) {
    color = "var(--status-green)";
  } else if (isOverdue) {
    color = "var(--status-red)";
    label = `${formatDate(item.due_date)} (${Math.abs(days)}d overdue)`;
  } else if (days !== null && days <= 30) {
    color = "var(--status-orange)";
    label = `${formatDate(item.due_date)} (${days}d)`;
  } else if (days !== null) {
    label = `${formatDate(item.due_date)} (${days}d)`;
  }

  return <span style={{ color, fontSize: 12, fontWeight: 500 }}>{label}</span>;
}

// ── Document Type Label ───────────────────────────────────────────────────────

const DOC_TYPE_LABELS = {
  filing: "Filing",
  receipt: "Receipt",
  confirmation: "Confirmation",
  correspondence: "Correspondence",
  other: "Other",
};

// ── Sorting ───────────────────────────────────────────────────────────────────

function sortItems(items) {
  return [...items].sort((a, b) => {
    const aOverdue = computeIsOverdue(a);
    const bOverdue = computeIsOverdue(b);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    const aHasDate = a.due_date != null;
    const bHasDate = b.due_date != null;
    if (aHasDate && !bHasDate) return -1;
    if (!aHasDate && bHasDate) return 1;
    if (aHasDate && bHasDate) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

// ── Add Item Form ─────────────────────────────────────────────────────────────

function AddItemForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "federal",
    due_date: "",
    recurrence: "annual",
    responsible_party: "",
    filing_fee: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(k, v) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        due_date: form.due_date || null,
        recurrence: form.recurrence,
        responsible_party: form.responsible_party.trim() || null,
        filing_fee: form.filing_fee !== "" ? parseFloat(form.filing_fee) : null,
        notes: form.notes.trim() || null,
      };
      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      onSave(json.item);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    background: "var(--bg-3)",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text)",
    fontSize: 13,
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

  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--gold-border)",
        borderRadius: "var(--radius-md)",
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h3 style={{ marginBottom: 16 }}>Add Compliance Item</h3>
      <form onSubmit={handleSave}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. IRS Form 990-EZ" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Brief description of the requirement"
            />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={e => set("category", e.target.value)}>
              <option value="federal">Federal</option>
              <option value="state">State</option>
              <option value="registration">Registration</option>
              <option value="internal">Internal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Recurrence</label>
            <select style={inputStyle} value={form.recurrence} onChange={e => set("recurrence", e.target.value)}>
              <option value="annual">Annual</option>
              <option value="biennial">Biennial</option>
              <option value="quarterly">Quarterly</option>
              <option value="monthly">Monthly</option>
              <option value="one-time">One-Time</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" style={inputStyle} value={form.due_date} onChange={e => set("due_date", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Responsible Party</label>
            <input style={inputStyle} value={form.responsible_party} onChange={e => set("responsible_party", e.target.value)} placeholder="e.g. Joseph Wiseman" />
          </div>
          <div>
            <label style={labelStyle}>Filing Fee ($)</label>
            <input type="number" min="0" step="0.01" style={inputStyle} value={form.filing_fee} onChange={e => set("filing_fee", e.target.value)} placeholder="0" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Additional notes, links, instructions..."
            />
          </div>
        </div>
        {error && (
          <div style={{ color: "var(--status-red)", fontSize: 12, marginBottom: 10 }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Saving..." : "Save Item"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Document Row ──────────────────────────────────────────────────────────────

function DocumentRow({ doc }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 13,
      }}
    >
      <div style={{ flex: 1 }}>
        <span style={{ color: "var(--text-bright)", fontWeight: 500 }}>{doc.title}</span>
        {doc.notes && <span style={{ color: "var(--text-dim)", marginLeft: 8, fontSize: 12 }}>{doc.notes}</span>}
      </div>
      <span className="badge badge-gray" style={{ fontSize: 10 }}>{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</span>
      {doc.filed_date && (
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{formatDate(doc.filed_date)}</span>
      )}
      {doc.file_url && (
        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
          View
        </a>
      )}
    </div>
  );
}

// ── Add Document Form ─────────────────────────────────────────────────────────

function AddDocumentForm({ itemId, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: "",
    document_type: "filing",
    filed_date: "",
    file_url: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(k, v) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        document_type: form.document_type,
        filed_date: form.filed_date || null,
        file_url: form.file_url.trim() || null,
        notes: form.notes.trim() || null,
      };
      const res = await fetch(`/api/compliance/${itemId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      onSave(json.document);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "7px 10px",
    background: "var(--bg-3)",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text)",
    fontSize: 13,
  };

  return (
    <form
      onSubmit={handleSave}
      style={{
        background: "var(--bg-3)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-sm)",
        padding: 14,
        marginTop: 10,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} placeholder="Document title *" />
        </div>
        <div>
          <select style={inputStyle} value={form.document_type} onChange={e => set("document_type", e.target.value)}>
            <option value="filing">Filing</option>
            <option value="receipt">Receipt</option>
            <option value="confirmation">Confirmation</option>
            <option value="correspondence">Correspondence</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <input type="date" style={inputStyle} value={form.filed_date} onChange={e => set("filed_date", e.target.value)} placeholder="Filed date" />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <input style={inputStyle} value={form.file_url} onChange={e => set("file_url", e.target.value)} placeholder="File URL (optional)" />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <input style={inputStyle} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notes (optional)" />
        </div>
      </div>
      {error && <div style={{ color: "var(--status-red)", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? "Saving..." : "Add Document"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Expanded Detail Panel ─────────────────────────────────────────────────────

function ItemDetail({ item, onStatusUpdate }) {
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes || "");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingDocs(true);
    fetch(`/api/compliance/${item.id}/documents`)
      .then(res => res.json())
      .then(json => { if (!cancelled) setDocuments(json.documents || []); })
      .catch(() => { if (!cancelled) setDocuments([]); })
      .finally(() => { if (!cancelled) setLoadingDocs(false); });
    return () => { cancelled = true; };
  }, [item.id]);

  async function handleStatusUpdate(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/compliance/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: notes.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setSaveMsg("Updated.");
      onStatusUpdate(json.item);
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setSaveMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDocAdded(doc) {
    setDocuments(prev => [doc, ...(prev || [])]);
    setShowAddDoc(false);
    // If the doc was a filing, update local status view
    if (doc.document_type === "filing" || doc.document_type === "confirmation") {
      setStatus("filed");
    }
  }

  const rowStyle = { display: "flex", gap: 6, marginBottom: 8, fontSize: 13 };
  const keyStyle = { color: "var(--text-dim)", minWidth: 130, flexShrink: 0 };
  const valStyle = { color: "var(--text-bright)" };

  const inputStyle = {
    padding: "7px 10px",
    background: "var(--bg-3)",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text)",
    fontSize: 13,
  };

  return (
    <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", background: "var(--bg-2)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px", marginBottom: 16 }}>
        <div>
          {item.description && (
            <div style={{ ...rowStyle, marginBottom: 12 }}>
              <span style={{ ...valStyle, color: "var(--text)", lineHeight: 1.5 }}>{item.description}</span>
            </div>
          )}
          <div style={rowStyle}>
            <span style={keyStyle}>Recurrence</span>
            <span style={valStyle}>{item.recurrence}</span>
          </div>
          <div style={rowStyle}>
            <span style={keyStyle}>Responsible</span>
            <span style={valStyle}>{item.responsible_party || "—"}</span>
          </div>
          <div style={rowStyle}>
            <span style={keyStyle}>Filing Fee</span>
            <span style={valStyle}>{formatCurrency(item.filing_fee)}</span>
          </div>
          <div style={rowStyle}>
            <span style={keyStyle}>Last Filed</span>
            <span style={valStyle}>{formatDate(item.last_filed_date)}</span>
          </div>
          {item.external_url && (
            <div style={rowStyle}>
              <span style={keyStyle}>External Link</span>
              <a href={item.external_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
                Open
              </a>
            </div>
          )}
          {item.notes && (
            <div style={{ marginTop: 8, padding: 10, background: "var(--bg-3)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
              {item.notes}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)", marginBottom: 10 }}>
            Update Status
          </div>
          <form onSubmit={handleStatusUpdate} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select style={{ ...inputStyle, width: "100%" }} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="filed">Filed</option>
              <option value="confirmed">Confirmed</option>
              <option value="waived">Waived</option>
            </select>
            <textarea
              style={{ ...inputStyle, width: "100%", minHeight: 64, resize: "vertical" }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? "Saving..." : "Update"}
              </button>
              {saveMsg && (
                <span style={{ fontSize: 12, color: saveMsg === "Updated." ? "var(--status-green)" : "var(--status-red)" }}>
                  {saveMsg}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
            Documents {documents && documents.length > 0 ? `(${documents.length})` : ""}
          </span>
          {!showAddDoc && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddDoc(true)}>
              + Add Document
            </button>
          )}
        </div>
        {showAddDoc && (
          <AddDocumentForm itemId={item.id} onSave={handleDocAdded} onCancel={() => setShowAddDoc(false)} />
        )}
        {loadingDocs && <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Loading...</div>}
        {documents && documents.length === 0 && !loadingDocs && (
          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>No documents attached.</div>
        )}
        {documents && documents.map(doc => <DocumentRow key={doc.id} doc={doc} />)}
      </div>
    </div>
  );
}

// ── Compliance Item Row ───────────────────────────────────────────────────────

function ComplianceRow({ item, expanded, onToggle, onUpdate }) {
  const isOverdue = computeIsOverdue(item);
  const days = computeDaysUntilDue(item);
  const isDueSoon = days !== null && days >= 0 && days <= 30 && !["filed", "confirmed", "waived"].includes(item.status);

  const rowBg = isOverdue
    ? "rgba(231, 76, 60, 0.04)"
    : isDueSoon
    ? "rgba(243, 156, 18, 0.04)"
    : "transparent";

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        background: rowBg,
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto auto",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          cursor: "pointer",
          transition: "background 0.1s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--card-hover)")}
        onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ color: "var(--text-bright)", fontWeight: 500, fontSize: 14 }}>{item.title}</span>
            <CategoryBadge category={item.category} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <DueDateChip item={item} />
            {item.responsible_party && (
              <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{item.responsible_party}</span>
            )}
            {item.docCount > 0 && (
              <span style={{ color: "var(--text-dim)", fontSize: 11 }}>{item.docCount} doc{item.docCount !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
        <StatusBadgeComp status={item.status} isOverdue={isOverdue} />
        <span
          style={{
            fontSize: 16,
            color: "var(--text-dim)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            display: "inline-block",
          }}
        >
          ▾
        </span>
      </div>
      {expanded && (
        <ItemDetail
          item={item}
          onStatusUpdate={updatedItem => onUpdate(updatedItem)}
        />
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "federal", label: "Federal" },
  { key: "state", label: "State" },
  { key: "registration", label: "Registration" },
  { key: "internal", label: "Internal" },
  { key: "overdue", label: "Overdue" },
  { key: "due_soon", label: "Due Soon" },
];

export default function ComplianceTracker({ initialItems }) {
  const [items, setItems] = useState(initialItems || []);
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const overdueCount = useMemo(() => items.filter(i => computeIsOverdue(i)).length, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (activeFilter === "overdue") {
      list = items.filter(i => computeIsOverdue(i));
    } else if (activeFilter === "due_soon") {
      list = items.filter(i => {
        const d = computeDaysUntilDue(i);
        return d !== null && d >= 0 && d <= 30 && !["filed", "confirmed", "waived"].includes(i.status);
      });
    } else if (activeFilter !== "all") {
      list = items.filter(i => i.category === activeFilter);
    }
    return sortItems(list);
  }, [items, activeFilter]);

  function handleToggle(id) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  function handleItemUpdate(updatedItem) {
    setItems(prev => prev.map(i => (i.id === updatedItem.id ? { ...i, ...updatedItem } : i)));
  }

  function handleNewItem(newItem) {
    setItems(prev => sortItems([...prev, newItem]));
    setShowAddForm(false);
  }

  const tabStyle = active => ({
    padding: "6px 14px",
    borderRadius: "var(--radius-pill)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    background: active ? "var(--gold)" : "var(--bg-3)",
    color: active ? "#0a0a0e" : "var(--text-dim)",
    transition: "all 0.15s",
  });

  return (
    <div>
      {overdueCount > 0 && (
        <div
          style={{
            background: "rgba(231, 76, 60, 0.1)",
            border: "1px solid rgba(231, 76, 60, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--status-red)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <span>⚠</span>
          <span>
            {overdueCount} item{overdueCount !== 1 ? "s are" : " is"} past due and require immediate attention.
          </span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              style={tabStyle(activeFilter === tab.key)}
              onClick={() => setActiveFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {!showAddForm && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>
            + Add Item
          </button>
        )}
      </div>

      {showAddForm && (
        <AddItemForm onSave={handleNewItem} onCancel={() => setShowAddForm(false)} />
      )}

      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 14 }}>
            No compliance items match this filter.
          </div>
        ) : (
          filtered.map(item => (
            <ComplianceRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => handleToggle(item.id)}
              onUpdate={handleItemUpdate}
            />
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-dim)", textAlign: "right" }}>
          Showing {filtered.length} of {items.length} item{items.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
