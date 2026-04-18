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
          borderRadius: 4, flexShrink: 0,
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
      {/* Message header — always visible */}
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

      {/* Message body */}
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
// Thread detail view
// ---------------------------------------------------------------------------

const WORKFLOWS = [
  { id: "donated-order",   label: "Donated Order",   domain: "orders" },
  { id: "hero-intake",     label: "New Hero Intake",  domain: "intake" },
  { id: "design-request",  label: "Design Request",   domain: "design" },
  { id: "donor-followup",  label: "Donor Follow-up",  domain: "donor" },
  { id: "general",         label: "General Response", domain: "general" },
];

const SNOOZE_OPTIONS = [
  { label: "Tomorrow",  hours: 24 },
  { label: "This Weekend", hours: 48 },
  { label: "Next Week", hours: 168 },
];

function ThreadDetail({ threadId, mailbox, onBack, onArchived, onTaskCreated }) {
  const [thread, setThread] = useState(null);
  const [loadingThread, setLoadingThread] = useState(true);
  const [threadError, setThreadError] = useState(null);

  const [draft, setDraft] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [showWorkflow, setShowWorkflow] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const workflowRef = useRef(null);
  const snoozeRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e) {
      if (workflowRef.current && !workflowRef.current.contains(e.target)) setShowWorkflow(false);
      if (snoozeRef.current && !snoozeRef.current.contains(e.target)) setShowSnooze(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setLoadingThread(true);
    setThreadError(null);
    fetch(`/api/email/thread/${threadId}?mailbox=${mailbox}`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((data) => setThread(data))
      .catch((err) => setThreadError(err.message))
      .finally(() => setLoadingThread(false));
  }, [threadId, mailbox]);

  const lastMessage = thread?.messages?.filter((m) => !m.isDraft).at(-1);
  const subject = thread?.messages?.[0] ? (parseHeaders(thread.messages[0])?.subject || thread.messages[0].subject) : "";

  function parseHeaders(msg) {
    return { subject: msg?.subject };
  }

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
        onArchived(threadId); // after sending, remove from inbox
      } else {
        alert("Send failed: " + (data.error || "Unknown error"));
      }
    } catch { alert("Failed to send email"); }
    finally { setSending(false); }
  }, [lastMessage, draft, threadId, mailbox, onArchived]);

  const handleCreateTask = useCallback(async (workflow) => {
    if (!lastMessage) return;
    setShowWorkflow(false);
    try {
      const prefix = workflow ? `[${WORKFLOWS.find((w) => w.id === workflow)?.label}] ` : "";
      await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert_to_task",
          messageId: lastMessage.id,
          subject: prefix + (lastMessage.subject || "Email task"),
          from: lastMessage.from,
          snippet: lastMessage.snippet,
          mailbox,
        }),
      });
      onTaskCreated?.();
      // Don't archive — keep in inbox unless user explicitly archives
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
    onArchived(threadId); // remove from view
  }, [threadId, onArchived]);

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
        <button onClick={onBack} style={{ background: "var(--card-border)", border: "none", color: "var(--text-bright)", padding: "6px 16px", borderRadius: 6, cursor: "pointer" }}>
          ← Back
        </button>
      </div>
    );
  }

  const threadSubject = thread?.messages?.[0]?.subject || "(no subject)";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Action bar */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--card-border)",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        <button onClick={onBack} style={btnStyle}>← Back</button>
        <div style={{ flex: 1 }} />

        {/* Reply */}
        <button onClick={handleGenerateDraft} disabled={draftLoading} style={btnStyle}>
          {draftLoading ? "Drafting…" : "↩ Reply"}
        </button>

        {/* Archive */}
        <button onClick={handleArchive} disabled={archiving} style={{ ...btnStyle, borderColor: "var(--status-green)", color: "var(--status-green)" }}>
          {archiving ? "…" : "✓ Archive"}
        </button>

        {/* + Task */}
        <button onClick={() => handleCreateTask(null)} style={btnStyle}>+ Task</button>

        {/* + Order */}
        <a
          href={`/orders/new?from=email&threadId=${threadId}&subject=${encodeURIComponent(threadSubject)}&sender=${encodeURIComponent(lastMessage?.from || "")}`}
          style={{ ...btnStyle, textDecoration: "none", display: "inline-block" }}
        >
          + Order
        </a>

        {/* Assign Workflow */}
        <div ref={workflowRef} style={{ position: "relative" }}>
          <button onClick={() => { setShowWorkflow((v) => !v); setShowSnooze(false); }} style={btnStyle}>
            Assign ▾
          </button>
          {showWorkflow && (
            <div style={{
              position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 100,
              background: "var(--card-bg)", border: "1px solid var(--card-border)",
              borderRadius: 8, minWidth: 160, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}>
              {WORKFLOWS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleCreateTask(w.id)}
                  style={{
                    display: "block", width: "100%", padding: "8px 14px", textAlign: "left",
                    background: "none", border: "none", color: "var(--text-bright)",
                    fontSize: 12, cursor: "pointer", borderBottom: "1px solid var(--card-border)",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--card-border)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Snooze */}
        <div ref={snoozeRef} style={{ position: "relative" }}>
          <button onClick={() => { setShowSnooze((v) => !v); setShowWorkflow(false); }} style={btnStyle}>
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

      {/* Subject */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--card-border)" }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-bright)", margin: 0 }}>
          {threadSubject}
        </h2>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {(thread?.messages || []).map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            defaultExpanded={i === thread.messages.length - 1}
          />
        ))}
      </div>

      {/* Reply compose */}
      {showReply && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--card-border)" }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase", color: "var(--text-dim)", padding: "12px 0 8px",
          }}>
            Draft Reply — to {parseFrom(lastMessage?.from).name || lastMessage?.from}
          </div>
          {draftLoading ? (
            <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "8px 0" }}>Generating…</div>
          ) : (
            <>
              <textarea
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setDraftSaved(false); }}
                rows={8}
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
  );
}

const btnStyle = {
  background: "none", border: "1px solid var(--card-border)",
  color: "var(--text-bright)", cursor: "pointer",
  padding: "5px 12px", borderRadius: 6, fontSize: 12,
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

  // Load snoozed from sessionStorage on mount
  const [snoozed, setSnoozed] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const map = JSON.parse(sessionStorage.getItem("email_snoozed") || "{}");
      const now = Date.now();
      const active = Object.entries(map)
        .filter(([, until]) => until > now)
        .map(([id]) => id);
      return new Set(active);
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

  // Re-fetch when operator finishes
  useEffect(() => {
    function handler() { fetchThreads(); }
    window.addEventListener("operator:done", handler);
    return () => window.removeEventListener("operator:done", handler);
  }, [fetchThreads]);

  // Broadcast page state for operator
  useEffect(() => {
    const state = {
      mailbox, view: openThreadId ? "thread" : "list",
      threadCount: threads.length,
      openThreadId,
    };
    window.__shosPageState = state;
    window.dispatchEvent(new CustomEvent("shos:pagestate", { detail: state }));
  }, [threads, openThreadId, mailbox]);

  const handleArchived = useCallback((threadId) => {
    setThreads((prev) => prev.filter((t) => t.threadId !== threadId));
    if (openThreadId === threadId) setOpenThreadId(null);
  }, [openThreadId]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    fetchThreads(searchQuery);
  }, [fetchThreads, searchQuery]);

  // Filter snoozed threads
  const visibleThreads = threads.filter((t) => !snoozed.has(t.threadId));

  // Group by age
  const todayGroup  = visibleThreads.filter((t) => threadAgeGroup(t.date) === "today");
  const weekGroup   = visibleThreads.filter((t) => threadAgeGroup(t.date) === "week");
  const olderGroup  = visibleThreads.filter((t) => threadAgeGroup(t.date) === "older");

  const unreadCount = visibleThreads.filter((t) => t.isUnread).length;

  // Thread detail view
  if (openThreadId) {
    return (
      <div style={{
        background: "var(--card-bg)", border: "1px solid var(--card-border)",
        borderRadius: 8, overflow: "hidden", minHeight: 500, display: "flex", flexDirection: "column",
      }}>
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
              padding: "4px 12px", fontSize: 12,
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

      {/* Thread list */}
      <div style={{ maxHeight: "calc(100vh - 260px)", overflow: "auto" }}>

        {/* Error state */}
        {error && (
          <div style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 8 }}>
              Failed to load inbox: {error}
            </div>
            <button onClick={() => fetchThreads()} style={btnStyle}>Retry</button>
          </div>
        )}

        {/* Loading state */}
        {loading && visibleThreads.length === 0 && !error && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
            Loading inbox…
          </div>
        )}

        {/* Empty state — only when loaded successfully with no results */}
        {!loading && !error && visibleThreads.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--status-green)", fontSize: 14 }}>
            ✓ Inbox zero. All caught up.
          </div>
        )}

        {/* Today group */}
        {todayGroup.length > 0 && (
          <>
            <GroupHeader label="Today" count={todayGroup.length} />
            {todayGroup.map((t) => (
              <ThreadRow key={t.threadId} thread={t} onOpen={setOpenThreadId} onArchive={handleArchived} />
            ))}
          </>
        )}

        {/* This Week group */}
        {weekGroup.length > 0 && (
          <>
            <GroupHeader label="This Week" count={weekGroup.length} />
            {weekGroup.map((t) => (
              <ThreadRow key={t.threadId} thread={t} onOpen={setOpenThreadId} onArchive={handleArchived} />
            ))}
          </>
        )}

        {/* Older group */}
        {olderGroup.length > 0 && (
          <>
            <GroupHeader label="Older" count={olderGroup.length} />
            {olderGroup.map((t) => (
              <ThreadRow key={t.threadId} thread={t} onOpen={setOpenThreadId} onArchive={handleArchived} />
            ))}
          </>
        )}
      </div>

      {/* Load more */}
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
