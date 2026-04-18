"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeEntities(str) {
  if (!str || typeof document === "undefined") return str || "";
  const el = document.createElement("textarea");
  el.innerHTML = str;
  return el.value;
}

function parseFrom(from) {
  if (!from) return { name: "", email: "" };
  const match = from.match(/^"?([^"<]*)"?\s*<?([^>]*)>?$/);
  if (match) {
    return { name: (match[1] || "").trim(), email: (match[2] || match[1] || "").trim() };
  }
  return { name: "", email: from.trim() };
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    if (diff < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return dateStr; }
}

function threadAgeGroup(dateStr) {
  if (!dateStr) return "older";
  const ageDays = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (ageDays <= 1) return "today";
  if (ageDays <= 7) return "week";
  return "older";
}

function InitialsAvatar({ name, email, size = 36 }) {
  const str = name || email || "?";
  const initials = str.includes(" ")
    ? str.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : str.slice(0, 2).toUpperCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ["#e74c3c", "#3498db", "#27ae60", "#8e44ad", "#e67e22", "#c4a237", "#1abc9c", "#e84393"];
  const color = colors[Math.abs(hash) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.33, fontWeight: 700, color: "#fff", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread row (list view)
// ---------------------------------------------------------------------------

function ThreadRow({ thread, onOpen, onArchive }) {
  const { name, email } = parseFrom(thread.from);
  const displayName = name || email || "Unknown";

  return (
    <div
      onClick={() => onOpen(thread.threadId)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid var(--card-border)",
        cursor: "pointer",
        opacity: thread.isUnread ? 1 : 0.75,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--card-border)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <InitialsAvatar name={name} email={email} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{
            fontSize: 13, fontWeight: thread.isUnread ? 700 : 400,
            color: "var(--text-bright)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {displayName}
            {thread.messageCount > 1 && (
              <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 6, fontWeight: 400 }}>
                ({thread.messageCount})
              </span>
            )}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-dim)", flexShrink: 0 }}>
            {formatDate(thread.date)}
          </span>
        </div>
        <div style={{
          fontSize: 13, fontWeight: thread.isUnread ? 600 : 400,
          color: thread.isUnread ? "var(--text-bright)" : "var(--text-dim)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {thread.subject || "(no subject)"}
        </div>
        <div style={{
          fontSize: 12, color: "var(--text-dim)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1,
        }}>
          {decodeEntities(thread.snippet)}
        </div>
      </div>

      {thread.isUnread && (
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-blue)", flexShrink: 0 }} />
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onArchive(thread.threadId); }}
        title="Archive"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-dim)", fontSize: 16, padding: "4px 8px",
          borderRadius: 4, flexShrink: 0, minWidth: 44, minHeight: 44,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = "var(--status-green)"}
        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
      >
        ✓
      </button>
    </div>
  );
}

function GroupHeader({ label, count }) {
  return (
    <div style={{
      padding: "6px 16px 4px",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
      textTransform: "uppercase", color: "var(--text-dim)",
      borderBottom: "1px solid var(--card-border)",
      background: "var(--bg)",
    }}>
      {label} <span style={{ opacity: 0.6 }}>({count})</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble (thread detail)
// ---------------------------------------------------------------------------

function MessageBubble({ message, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { name, email } = parseFrom(message.from);

  return (
    <div style={{
      borderBottom: "1px solid var(--card-border)",
      background: message.isDraft ? "rgba(255,200,0,0.04)" : "transparent",
    }}>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px", cursor: "pointer",
        }}
      >
        <InitialsAvatar name={name} email={email} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>
            {name || email}
          </span>
          {message.isDraft && (
            <span style={{ fontSize: 10, color: "#f59e0b", marginLeft: 6, fontWeight: 600 }}>DRAFT</span>
          )}
          {!expanded && (
            <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: 8 }}>
              {decodeEntities(message.snippet?.slice(0, 60))}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-dim)", flexShrink: 0 }}>
          {formatDate(message.date)}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-dim)", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 16px" }}>
          {message.bodyIsHtml ? (
            <div
              dangerouslySetInnerHTML={{ __html: message.body }}
              style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-bright)", maxWidth: 680 }}
            />
          ) : (
            <pre style={{
              fontSize: 13, lineHeight: 1.6, color: "var(--text-bright)",
              whiteSpace: "pre-wrap", wordWrap: "break-word",
              fontFamily: "inherit", margin: 0, maxWidth: 680,
            }}>
              {message.body || "(empty)"}
            </pre>
          )}
          {message.attachments?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {message.attachments.map((att, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 6,
                  background: "var(--card-bg)", border: "1px solid var(--card-border)",
                  fontSize: 12, color: "var(--text-bright)",
                }}>
                  <span>{att.mimeType?.startsWith("image/") ? "🖼️" : att.mimeType === "application/pdf" ? "📄" : "📎"}</span>
                  <span>{att.filename}</span>
                  {att.size > 0 && <span style={{ color: "var(--text-dim)", fontSize: 11 }}>({Math.round(att.size / 1024)} KB)</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context panel — contact card, hero card, new-record prompts
// ---------------------------------------------------------------------------

function ContactCard({ contact, orderCount, donationTotal }) {
  return (
    <div style={{
      flex: 1, minWidth: 200,
      background: "var(--bg)", border: "1px solid var(--card-border)",
      borderRadius: 8, padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--status-blue)", marginBottom: 6 }}>
        Known Contact
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)" }}>{contact.name}</div>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{contact.email}</div>
      {(contact.city || contact.state) && (
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {[contact.city, contact.state].filter(Boolean).join(", ")}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11 }}>
        {orderCount > 0 && (
          <a href="/orders" style={{ color: "var(--gold)", textDecoration: "none" }}>
            {orderCount} order{orderCount !== 1 ? "s" : ""}
          </a>
        )}
        {donationTotal > 0 && (
          <span style={{ color: "var(--status-green)" }}>${donationTotal.toLocaleString()} donated</span>
        )}
      </div>
    </div>
  );
}

function HeroContextCard({ hero }) {
  const statusColor = {
    not_started: "var(--text-dim)",
    research: "var(--status-orange)",
    in_progress: "var(--status-blue)",
    review: "#c4a237",
    approved: "var(--status-green)",
    complete: "var(--status-green)",
    Complete: "var(--status-green)",
  }[hero.design_status] || "var(--text-dim)";

  return (
    <div style={{
      flex: 1, minWidth: 200,
      background: "var(--bg)", border: "1px solid var(--gold)44",
      borderRadius: 8, padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gold)", marginBottom: 6 }}>
        Hero Match
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)" }}>{hero.name}</div>
      <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)", marginTop: 1 }}>{hero.sku}</div>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{hero.branch}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 10, alignItems: "center" }}>
        <span style={{ color: statusColor, fontWeight: 600 }}>
          {hero.hasDesign ? "✓ Design ready" : `Design: ${(hero.design_status || "not started").replace(/_/g, " ")}`}
        </span>
        <a href="/production" style={{ color: "var(--text-dim)", textDecoration: "none", marginLeft: "auto" }}>→ Production</a>
      </div>
    </div>
  );
}

function NoMatchPanel({ emailAddr, subject }) {
  const heroIntakeUrl = `/families?new=1&name=${encodeURIComponent(subject || "")}`;
  return (
    <div style={{
      flex: 1, minWidth: 200,
      background: "var(--bg)", border: "1px dashed var(--card-border)",
      borderRadius: 8, padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 6 }}>
        New Contact
      </div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>
        {emailAddr || "Unknown sender"} not in system
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <a
          href={heroIntakeUrl}
          style={{
            fontSize: 11, padding: "4px 8px", borderRadius: 4,
            background: "var(--gold)15", border: "1px solid var(--gold)44",
            color: "var(--gold)", textDecoration: "none",
          }}
        >
          + New Hero
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline order form
// ---------------------------------------------------------------------------

function InlineOrderForm({ context, thread, threadId, mailbox, onSuccess }) {
  const lastMsg = thread?.messages?.filter((m) => !m.isDraft).at(-1);
  const { name: senderName, email: senderEmail } = parseFrom(lastMsg?.from || "");

  // Pre-fill from context
  const defaultHeroName = context?.heroes?.[0]?.name || "";
  const defaultHeroSku = context?.heroes?.[0]?.sku || "";
  const defaultRecipient = context?.contact?.name || senderName || "";
  const defaultEmail = context?.contact?.email || senderEmail || "";

  const [heroQuery, setHeroQuery] = useState(defaultHeroName);
  const [heroSku, setHeroSku] = useState(defaultHeroSku);
  const [heroSearchResults, setHeroSearchResults] = useState(context?.heroes || []);
  const [heroSearching, setHeroSearching] = useState(false);
  const [recipientName, setRecipientName] = useState(defaultRecipient);
  const [recipientEmail, setRecipientEmail] = useState(defaultEmail);
  const [qty7, setQty7] = useState(1);
  const [qty6, setQty6] = useState(0);
  const [shippingName, setShippingName] = useState(defaultRecipient);
  const [shippingAddr, setShippingAddr] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingPostal, setShippingPostal] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const searchTimeout = useRef(null);

  const handleHeroSearch = useCallback((q) => {
    setHeroQuery(q);
    setHeroSku("");
    clearTimeout(searchTimeout.current);
    if (q.length < 2) { setHeroSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setHeroSearching(true);
      try {
        const res = await fetch(`/api/heroes/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setHeroSearchResults(data.heroes || []);
      } catch {}
      setHeroSearching(false);
    }, 300);
  }, []);

  const selectHero = (hero) => {
    setHeroQuery(hero.name);
    setHeroSku(hero.sku);
    setHeroSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!heroQuery.trim() || !recipientName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/orders/from-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          mailbox,
          heroName: heroQuery.trim(),
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim(),
          sku: heroSku,
          quantity7: qty7,
          quantity6: qty6,
          notes: notes.trim(),
          shippingName: shippingName.trim(),
          shippingAddress1: shippingAddr.trim(),
          shippingCity: shippingCity.trim(),
          shippingState: shippingState.trim(),
          shippingPostal: shippingPostal.trim(),
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) onSuccess?.(data);
    } catch (err) {
      setResult({ error: err.message });
    }
    setCreating(false);
  };

  if (result?.success) {
    return (
      <div style={{ padding: "12px 16px", background: "rgba(39,174,96,0.08)", borderRadius: 8, border: "1px solid var(--status-green)44" }}>
        <div style={{ fontSize: 13, color: "var(--status-green)", fontWeight: 600, marginBottom: 4 }}>
          ✓ Order created — {result.orderName}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          Status: {result.initialStatus?.replace(/_/g, " ")}
          {result.autoAdvanced && " → auto-advanced (design found)"}
        </div>
        <a href="/production" style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none", display: "inline-block", marginTop: 6 }}>
          → View in Production
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: "0 16px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--gold)", padding: "10px 0 8px" }}>
        Create Donated Order
      </div>

      {result?.error && (
        <div style={{ fontSize: 12, color: "var(--status-red)", marginBottom: 8 }}>⚠ {result.error}</div>
      )}

      {/* Hero search */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <label style={labelStyle}>Hero</label>
        <input
          value={heroQuery}
          onChange={(e) => handleHeroSearch(e.target.value)}
          placeholder="Search hero name or SKU…"
          required
          style={inputStyle}
          autoComplete="off"
        />
        {heroSku && (
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-dim)", marginTop: 2 }}>SKU: {heroSku}</div>
        )}
        {heroSearchResults.length > 0 && !heroSku && (
          <div style={{
            position: "absolute", left: 0, right: 0, top: "100%", zIndex: 50,
            background: "var(--card-bg)", border: "1px solid var(--card-border)",
            borderRadius: "0 0 6px 6px", maxHeight: 180, overflowY: "auto",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}>
            {heroSearching && (
              <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-dim)" }}>Searching…</div>
            )}
            {heroSearchResults.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => selectHero(h)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "8px 12px", background: "none", border: "none",
                  borderBottom: "1px solid var(--card-border)", cursor: "pointer",
                  color: "var(--text-bright)", fontSize: 12,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--card-border)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <span style={{ fontWeight: 600 }}>{h.name}</span>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-dim)", marginLeft: 8 }}>{h.sku}</span>
                {h.hasDesign && <span style={{ fontSize: 10, color: "var(--status-green)", marginLeft: 6 }}>✓ design</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Two column: recipient + quantities */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Recipient Name</label>
          <input value={recipientName} onChange={(e) => { setRecipientName(e.target.value); setShippingName(e.target.value); }} required style={inputStyle} placeholder="Full name" />
        </div>
        <div>
          <label style={labelStyle}>Recipient Email</label>
          <input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} style={inputStyle} placeholder="email@example.com" type="email" />
        </div>
      </div>

      {/* Quantities */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Qty 7" (Regular)</label>
          <input value={qty7} onChange={(e) => setQty7(Math.max(0, parseInt(e.target.value) || 0))} type="number" min="0" max="20" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Qty 6" (Small)</label>
          <input value={qty6} onChange={(e) => setQty6(Math.max(0, parseInt(e.target.value) || 0))} type="number" min="0" max="20" style={inputStyle} />
        </div>
      </div>

      {/* Shipping (collapsible) */}
      <details style={{ marginBottom: 10 }}>
        <summary style={{ fontSize: 11, color: "var(--text-dim)", cursor: "pointer", padding: "4px 0" }}>
          Shipping address (optional)
        </summary>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Ship to Name</label>
            <input value={shippingName} onChange={(e) => setShippingName(e.target.value)} style={inputStyle} placeholder="Recipient name" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Address</label>
            <input value={shippingAddr} onChange={(e) => setShippingAddr(e.target.value)} style={inputStyle} placeholder="Street address" />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 6 }}>
            <div>
              <label style={labelStyle}>State</label>
              <input value={shippingState} onChange={(e) => setShippingState(e.target.value)} style={inputStyle} maxLength={2} placeholder="VA" />
            </div>
            <div>
              <label style={labelStyle}>ZIP</label>
              <input value={shippingPostal} onChange={(e) => setShippingPostal(e.target.value)} style={inputStyle} placeholder="22304" />
            </div>
          </div>
        </div>
      </details>

      {/* Notes */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Any context…" />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={creating || (!qty7 && !qty6)}
          style={{
            background: creating ? "var(--card-border)" : "var(--gold)",
            border: "none", color: creating ? "var(--text-dim)" : "#000",
            padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700,
            cursor: creating ? "wait" : "pointer", flex: 1,
            opacity: (!qty7 && !qty6) ? 0.5 : 1,
          }}
        >
          {creating ? "Creating…" : "Create Order + Archive Email"}
        </button>
      </div>
    </form>
  );
}

const labelStyle = { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", display: "block", marginBottom: 3 };
const inputStyle = { width: "100%", background: "var(--bg)", border: "1px solid var(--card-border)", borderRadius: 6, color: "var(--text-bright)", fontSize: 12, padding: "5px 9px", boxSizing: "border-box", fontFamily: "inherit" };

// ---------------------------------------------------------------------------
// Thread detail view
// ---------------------------------------------------------------------------

const SNOOZE_OPTIONS = [
  { label: "Tomorrow", hours: 24 },
  { label: "This Weekend", hours: 48 },
  { label: "Next Week", hours: 168 },
];

function ThreadDetail({ threadId, mailbox, onBack, onArchived, onTaskCreated, thread: preloadedThread }) {
  const [thread, setThread] = useState(preloadedThread || null);
  const [loadingThread, setLoadingThread] = useState(!preloadedThread);
  const [threadError, setThreadError] = useState(null);

  // Context panel
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);

  const [draft, setDraft] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [activeAction, setActiveAction] = useState(null); // "order" | "task" | null
  const [showSnooze, setShowSnooze] = useState(false);
  const snoozeRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target)) setShowSnooze(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setLoadingThread(true);
    setThreadError(null);
    setContext(null);
    setActiveAction(null);
    setDraft("");
    setShowReply(false);
    fetch(`/api/email/thread/${threadId}?mailbox=${mailbox}`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((data) => {
        setThread(data);
        // Fetch context once thread data is available
        const lastMsg = data.messages?.filter((m) => !m.isDraft).at(-1);
        if (lastMsg) {
          setContextLoading(true);
          const params = new URLSearchParams({
            email: lastMsg.from || "",
            subject: lastMsg.subject || data.messages?.[0]?.subject || "",
            snippet: lastMsg.snippet || "",
          });
          fetch(`/api/email/context?${params}`)
            .then((r) => r.json())
            .then((d) => setContext(d))
            .catch(() => {})
            .finally(() => setContextLoading(false));
        }
      })
      .catch((err) => setThreadError(err.message))
      .finally(() => setLoadingThread(false));
  }, [threadId, mailbox]);

  const lastMessage = thread?.messages?.filter((m) => !m.isDraft).at(-1);
  const threadSubject = thread?.messages?.[0]?.subject || "(no subject)";

  const handleArchive = useCallback(async () => {
    setArchiving(true);
    try {
      await fetch(`/api/email/thread/${threadId}?mailbox=${mailbox}`, { method: "DELETE" });
      onArchived(threadId);
    } catch (err) {
      console.error("Archive error:", err);
      setArchiving(false);
    }
  }, [threadId, mailbox, onArchived]);

  const handleGenerateDraft = useCallback(async () => {
    if (!lastMessage) return;
    setDraft("");
    setDraftLoading(true);
    setDraftSaved(false);
    setShowReply(true);
    setActiveAction(null);
    try {
      const res = await fetch("/api/email/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: lastMessage.id,
          subject: lastMessage.subject,
          from: lastMessage.from,
          body: lastMessage.body,
          snippet: lastMessage.snippet,
          mailbox,
        }),
      });
      const data = await res.json();
      setDraft(data.draft || "");
    } catch {
      setDraft("Failed to generate draft.");
    } finally {
      setDraftLoading(false);
    }
  }, [lastMessage, mailbox]);

  const handleSaveDraft = useCallback(async () => {
    if (!lastMessage || !draft) return;
    try {
      await fetch("/api/email/draft-reply", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lastMessage.from,
          subject: lastMessage.subject,
          body: draft,
          threadId,
          messageId: lastMessage.id,
          mailbox,
        }),
      });
      setDraftSaved(true);
    } catch { alert("Failed to save draft"); }
  }, [lastMessage, draft, threadId, mailbox]);

  const handleSend = useCallback(async () => {
    if (!lastMessage || !draft) return;
    setSending(true);
    try {
      const subject = lastMessage.subject?.startsWith("Re:")
        ? lastMessage.subject
        : `Re: ${lastMessage.subject}`;
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          to: lastMessage.from,
          subject,
          body: draft,
          threadId,
          inReplyTo: lastMessage.id,
          mailbox,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDraft(""); setShowReply(false); setSendConfirm(false);
        onArchived(threadId);
      } else {
        alert("Send failed: " + (data.error || "Unknown error"));
      }
    } catch { alert("Failed to send email"); }
    finally { setSending(false); }
  }, [lastMessage, draft, threadId, mailbox, onArchived]);

  const handleCreateTask = useCallback(async () => {
    if (!lastMessage) return;
    setActiveAction(null);
    try {
      await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert_to_task",
          messageId: lastMessage.id,
          subject: lastMessage.subject || "Email task",
          from: lastMessage.from,
          snippet: lastMessage.snippet,
          mailbox,
        }),
      });
      onTaskCreated?.();
    } catch (err) {
      console.error("Task creation failed:", err);
    }
  }, [lastMessage, mailbox, onTaskCreated]);

  const handleSnooze = useCallback((hours) => {
    setShowSnooze(false);
    const until = Date.now() + hours * 3600000;
    try {
      const map = JSON.parse(sessionStorage.getItem("email_snoozed") || "{}");
      map[threadId] = until;
      sessionStorage.setItem("email_snoozed", JSON.stringify(map));
    } catch {}
    onArchived(threadId);
  }, [threadId, onArchived]);

  const handleOrderSuccess = useCallback((orderData) => {
    // Archive after successful order creation
    setTimeout(() => {
      fetch(`/api/email/thread/${threadId}?mailbox=${mailbox}`, { method: "DELETE" })
        .catch(() => {});
      setTimeout(() => onArchived(threadId), 1500);
    }, 800);
  }, [threadId, mailbox, onArchived]);

  if (loadingThread) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>
        Loading thread…
      </div>
    );
  }

  if (threadError) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <div style={{ color: "#ef4444", marginBottom: 12 }}>Failed to load thread: {threadError}</div>
        <button onClick={onBack} style={btnStyle}>← Back</button>
      </div>
    );
  }

  const hasContact = context?.contact;
  const hasHeroes = context?.heroes?.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* ── Action bar ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: "10px 12px",
        borderBottom: "1px solid var(--card-border)",
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
      }}>
        <button onClick={onBack} style={btnStyle}>← Back</button>
        <div style={{ flex: 1 }} />

        <button
          onClick={handleGenerateDraft}
          disabled={draftLoading}
          style={{ ...btnStyle, ...(showReply ? { borderColor: "var(--status-blue)", color: "var(--status-blue)" } : {}) }}
        >
          {draftLoading ? "Drafting…" : "↩ Reply"}
        </button>

        <button
          onClick={() => { setActiveAction(activeAction === "order" ? null : "order"); setShowReply(false); }}
          style={{
            ...btnStyle,
            ...(activeAction === "order" ? { borderColor: "var(--gold)", color: "var(--gold)", background: "var(--gold)15" } : {}),
          }}
        >
          📦 Order
        </button>

        <button onClick={handleCreateTask} style={btnStyle}>+ Task</button>

        {/* New Hero shortcut */}
        <a
          href={`/families?new=1&name=${encodeURIComponent(threadSubject)}`}
          style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
        >
          + Hero
        </a>

        <button
          onClick={handleArchive}
          disabled={archiving}
          style={{ ...btnStyle, borderColor: "var(--status-green)", color: "var(--status-green)" }}
        >
          {archiving ? "…" : "✓ Done"}
        </button>

        {/* Snooze */}
        <div ref={snoozeRef} style={{ position: "relative" }}>
          <button onClick={() => setShowSnooze((v) => !v)} style={btnStyle}>
            Snooze ▾
          </button>
          {showSnooze && (
            <div style={{
              position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 100,
              background: "var(--card-bg)", border: "1px solid var(--card-border)",
              borderRadius: 8, minWidth: 140, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}>
              {SNOOZE_OPTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSnooze(s.hours)}
                  style={{
                    display: "block", width: "100%", padding: "8px 14px", textAlign: "left",
                    background: "none", border: "none", color: "var(--text-bright)",
                    fontSize: 12, cursor: "pointer", borderBottom: "1px solid var(--card-border)",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--card-border)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Subject ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--card-border)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-bright)", margin: 0 }}>
          {threadSubject}
        </h2>
      </div>

      {/* ── Scrollable content area ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {/* Messages */}
        {(thread?.messages || []).map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            defaultExpanded={i === thread.messages.length - 1}
          />
        ))}

        {/* ── Context panel ─────────────────────────────────────────────────── */}
        <div style={{
          padding: "12px 16px",
          borderTop: "2px solid var(--card-border)",
          background: "rgba(255,255,255,0.015)",
        }}>
          {contextLoading && (
            <div style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>
              Identifying contact…
            </div>
          )}
          {context && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {hasContact ? (
                <ContactCard
                  contact={context.contact}
                  orderCount={context.orderCount}
                  donationTotal={context.donationTotal}
                />
              ) : (
                <NoMatchPanel emailAddr={context.emailAddr} subject={threadSubject} />
              )}
              {hasHeroes && context.heroes.map((h) => (
                <HeroContextCard key={h.id} hero={h} />
              ))}
            </div>
          )}
        </div>

        {/* ── Inline order form ─────────────────────────────────────────────── */}
        {activeAction === "order" && (
          <div style={{ borderTop: "1px solid var(--gold)44", background: "rgba(196,162,55,0.04)" }}>
            <InlineOrderForm
              context={context}
              thread={thread}
              threadId={threadId}
              mailbox={mailbox}
              onSuccess={handleOrderSuccess}
            />
          </div>
        )}

        {/* ── Reply compose ─────────────────────────────────────────────────── */}
        {showReply && (
          <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--card-border)" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", color: "var(--text-dim)", padding: "12px 0 8px",
            }}>
              Reply — to {parseFrom(lastMessage?.from).name || lastMessage?.from}
            </div>
            {draftLoading ? (
              <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "8px 0" }}>Generating draft…</div>
            ) : (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setDraftSaved(false); }}
                  rows={7}
                  style={{
                    width: "100%", background: "var(--bg)", border: "1px solid var(--card-border)",
                    borderRadius: 6, color: "var(--text-bright)", fontSize: 13, lineHeight: 1.6,
                    padding: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={handleSaveDraft}
                    disabled={draftSaved}
                    style={{
                      background: draftSaved ? "var(--status-green)22" : "var(--card-border)",
                      border: `1px solid ${draftSaved ? "var(--status-green)" : "var(--card-border)"}`,
                      color: draftSaved ? "var(--status-green)" : "var(--text-bright)",
                      cursor: draftSaved ? "default" : "pointer",
                      padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {draftSaved ? "✓ Saved to Drafts" : "Save Draft"}
                  </button>
                  {!sendConfirm ? (
                    <button
                      onClick={() => setSendConfirm(true)}
                      disabled={!draft.trim()}
                      style={{
                        background: "var(--status-blue)", border: "1px solid var(--status-blue)",
                        color: "#fff", cursor: draft.trim() ? "pointer" : "not-allowed",
                        padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        opacity: draft.trim() ? 1 : 0.5,
                      }}
                    >
                      Send
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={sending}
                      style={{
                        background: sending ? "var(--card-border)" : "#e74c3c",
                        border: "1px solid #e74c3c", color: "#fff",
                        cursor: sending ? "wait" : "pointer",
                        padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      }}
                    >
                      {sending ? "Sending…" : "Confirm Send"}
                    </button>
                  )}
                  <button
                    onClick={() => { setShowReply(false); setDraft(""); setSendConfirm(false); }}
                    style={{
                      background: "none", border: "1px solid var(--card-border)",
                      color: "var(--text-dim)", cursor: "pointer",
                      padding: "6px 14px", borderRadius: 6, fontSize: 12,
                    }}
                  >
                    Discard
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  background: "none", border: "1px solid var(--card-border)",
  color: "var(--text-bright)", cursor: "pointer",
  padding: "6px 12px", borderRadius: 6, fontSize: 12,
  minHeight: 36, display: "inline-flex", alignItems: "center",
};

// ---------------------------------------------------------------------------
// Main EmailInbox component
// ---------------------------------------------------------------------------

export default function EmailInbox({ mailbox = "joseph" }) {
  const [threads, setThreads] = useState([]);
  const [nextPage, setNextPage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openThreadId, setOpenThreadId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [snoozed, setSnoozed] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const map = JSON.parse(sessionStorage.getItem("email_snoozed") || "{}");
      const now = Date.now();
      return new Set(Object.entries(map).filter(([, until]) => until > now).map(([id]) => id));
    } catch { return new Set(); }
  });

  const fetchThreads = useCallback(async (query, pageToken) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mode: "threads" });
      if (query) params.set("q", query);
      if (pageToken) params.set("pageToken", pageToken);
      params.set("mailbox", mailbox);
      const res = await fetch(`/api/email?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (pageToken) {
        setThreads((prev) => [...prev, ...(data.threads || [])]);
      } else {
        setThreads(data.threads || []);
      }
      setNextPage(data.nextPageToken || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mailbox]);

  useEffect(() => { fetchThreads(); }, []);

  useEffect(() => {
    function handler() { fetchThreads(); }
    window.addEventListener("operator:done", handler);
    return () => window.removeEventListener("operator:done", handler);
  }, [fetchThreads]);

  useEffect(() => {
    const state = {
      mailbox, view: openThreadId ? "thread" : "list",
      threadCount: threads.length, openThreadId,
    };
    window.__shosPageState = state;
    window.dispatchEvent(new CustomEvent("shos:pagestate", { detail: state }));
  }, [threads, openThreadId, mailbox]);

  const visibleThreads = threads.filter((t) => !snoozed.has(t.threadId));

  const handleArchived = useCallback((threadId) => {
    const currentIdx = visibleThreads.findIndex((t) => t.threadId === threadId);
    const nextThread = visibleThreads[currentIdx + 1] || null;

    setThreads((prev) => prev.filter((t) => t.threadId !== threadId));

    if (openThreadId === threadId) {
      // Auto-advance to next unread thread, or back to list if none
      setOpenThreadId(nextThread?.threadId || null);
    }
  }, [openThreadId, visibleThreads]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    fetchThreads(searchQuery);
  }, [fetchThreads, searchQuery]);

  const todayGroup  = visibleThreads.filter((t) => threadAgeGroup(t.date) === "today");
  const weekGroup   = visibleThreads.filter((t) => threadAgeGroup(t.date) === "week");
  const olderGroup  = visibleThreads.filter((t) => threadAgeGroup(t.date) === "older");
  const unreadCount = visibleThreads.filter((t) => t.isUnread).length;

  // Thread detail view
  if (openThreadId) {
    const openIndex = visibleThreads.findIndex((t) => t.threadId === openThreadId);
    const totalRemaining = visibleThreads.length;

    return (
      <div style={{
        background: "var(--card-bg)", border: "1px solid var(--card-border)",
        borderRadius: 8, overflow: "hidden",
        minHeight: "calc(100vh - 260px)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Queue position indicator */}
        {totalRemaining > 1 && (
          <div style={{
            padding: "4px 16px",
            background: "rgba(255,255,255,0.02)",
            borderBottom: "1px solid var(--card-border)",
            fontSize: 11, color: "var(--text-dim)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>Thread {openIndex + 1} of {totalRemaining}</span>
            {openIndex < totalRemaining - 1 && (
              <button
                onClick={() => setOpenThreadId(visibleThreads[openIndex + 1].threadId)}
                style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: 11, padding: "0 4px" }}
              >
                Skip →
              </button>
            )}
          </div>
        )}

        <ThreadDetail
          threadId={openThreadId}
          mailbox={mailbox}
          onBack={() => setOpenThreadId(null)}
          onArchived={handleArchived}
          onTaskCreated={() => {}}
        />
      </div>
    );
  }

  // Thread list view
  return (
    <div style={{
      background: "var(--card-bg)", border: "1px solid var(--card-border)",
      borderRadius: 8, overflow: "hidden",
    }}>
      {/* Toolbar */}
      <div style={{
        padding: "8px 16px", borderBottom: "1px solid var(--card-border)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <form onSubmit={handleSearch} style={{ flex: 1, display: "flex", gap: 8 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inbox…"
            style={{
              flex: 1, background: "var(--bg)", color: "var(--text-bright)",
              border: "1px solid var(--card-border)", borderRadius: 6,
              padding: "6px 12px", fontSize: 12,
            }}
          />
          <button type="submit" style={btnStyle}>Search</button>
        </form>
        <button
          onClick={() => fetchThreads(searchQuery)}
          disabled={loading}
          style={{ ...btnStyle, opacity: loading ? 0.5 : 1 }}
        >
          {loading ? "…" : "↻"}
        </button>
        <span style={{ fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
          {visibleThreads.length} thread{visibleThreads.length !== 1 ? "s" : ""}
          {unreadCount > 0 && <span style={{ color: "var(--status-blue)" }}> · {unreadCount} unread</span>}
        </span>
      </div>

      <div style={{ maxHeight: "calc(100vh - 260px)", overflow: "auto" }}>
        {error && (
          <div style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 8 }}>
              Failed to load inbox: {error}
            </div>
            <button onClick={() => fetchThreads()} style={btnStyle}>Retry</button>
          </div>
        )}

        {loading && visibleThreads.length === 0 && !error && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
            Loading inbox…
          </div>
        )}

        {!loading && !error && visibleThreads.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--status-green)", fontSize: 14 }}>
            ✓ Inbox zero. All caught up.
          </div>
        )}

        {todayGroup.length > 0 && (
          <>
            <GroupHeader label="Today" count={todayGroup.length} />
            {todayGroup.map((t) => (
              <ThreadRow key={t.threadId} thread={t} onOpen={setOpenThreadId} onArchive={handleArchived} />
            ))}
          </>
        )}

        {weekGroup.length > 0 && (
          <>
            <GroupHeader label="This Week" count={weekGroup.length} />
            {weekGroup.map((t) => (
              <ThreadRow key={t.threadId} thread={t} onOpen={setOpenThreadId} onArchive={handleArchived} />
            ))}
          </>
        )}

        {olderGroup.length > 0 && (
          <>
            <GroupHeader label="Older" count={olderGroup.length} />
            {olderGroup.map((t) => (
              <ThreadRow key={t.threadId} thread={t} onOpen={setOpenThreadId} onArchive={handleArchived} />
            ))}
          </>
        )}
      </div>

      {nextPage && (
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--card-border)", textAlign: "center" }}>
          <button
            onClick={() => fetchThreads(searchQuery, nextPage)}
            disabled={loading}
            style={{ ...btnStyle, padding: "6px 20px" }}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
