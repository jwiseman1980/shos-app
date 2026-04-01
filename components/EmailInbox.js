"use client";

import { useState, useCallback } from "react";

// Parse "Name <email>" or just "email"
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
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) {
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    if (isYesterday) return "Yesterday";
    // Within last 7 days
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    if (diff < 7) {
      return d.toLocaleDateString("en-US", { weekday: "short" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function InitialsAvatar({ name, email }) {
  const str = name || email || "?";
  const initials = str.includes(" ")
    ? str.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : str.slice(0, 2).toUpperCase();

  // Deterministic color from string
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ["#e74c3c", "#3498db", "#27ae60", "#8e44ad", "#e67e22", "#c4a237", "#1abc9c", "#e84393"];
  const color = colors[Math.abs(hash) % colors.length];

  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function EmailRow({ msg, isSelected, onSelect, onOpen, onArchive }) {
  const { name, email } = parseFrom(msg.from);
  const displayName = name || email;

  return (
    <div
      onClick={() => onOpen(msg.id)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 16px",
        background: isSelected ? "var(--card-border)" : "transparent",
        borderBottom: "1px solid var(--card-border)",
        cursor: "pointer",
        opacity: msg.isUnread ? 1 : 0.7,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--card-border)"}
      onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? "var(--card-border)" : "transparent"}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onSelect(msg.id, e.target.checked)}
        style={{ cursor: "pointer", flexShrink: 0 }}
      />

      {/* Avatar */}
      <InitialsAvatar name={name} email={email} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{
            fontSize: 13,
            fontWeight: msg.isUnread ? 700 : 400,
            color: "var(--text-bright)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {displayName}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-dim)", flexShrink: 0 }}>
            {formatDate(msg.date)}
          </span>
        </div>
        <div style={{
          fontSize: 13,
          fontWeight: msg.isUnread ? 600 : 400,
          color: msg.isUnread ? "var(--text-bright)" : "var(--text-dim)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {msg.subject || "(no subject)"}
        </div>
        <div style={{
          fontSize: 12, color: "var(--text-dim)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginTop: 1,
        }}>
          {msg.snippet}
        </div>
      </div>

      {/* Quick actions */}
      <button
        onClick={(e) => { e.stopPropagation(); onArchive(msg.id); }}
        title="Dismiss (archive)"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-dim)", fontSize: 16, padding: "4px 8px",
          borderRadius: 4, flexShrink: 0,
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = "var(--status-green)"}
        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
      >
        {"\u2713"}
      </button>
    </div>
  );
}

function EmailDetail({ message, onBack, onArchive, onReply, onTask, draftLoading }) {
  const { name, email } = parseFrom(message.from);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--card-border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "1px solid var(--card-border)",
            color: "var(--text-bright)", cursor: "pointer",
            padding: "4px 12px", borderRadius: 6, fontSize: 12,
          }}
        >
          {"\u2190"} Back
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => onTask?.(message)}
          style={{
            background: "none", border: "1px solid var(--card-border)",
            color: "var(--text-dim)", cursor: "pointer",
            padding: "4px 12px", borderRadius: 6, fontSize: 12,
          }}
        >
          + Task
        </button>
        <button
          onClick={() => onArchive(message.id)}
          style={{
            background: "var(--status-green)22", border: "1px solid var(--status-green)",
            color: "var(--status-green)", cursor: "pointer",
            padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
          }}
        >
          ✓ Dismiss
        </button>
        <button
          onClick={() => onReply(message)}
          disabled={draftLoading}
          style={{
            background: "var(--card-border)", border: "1px solid var(--card-border)",
            color: "var(--text-bright)", cursor: draftLoading ? "default" : "pointer",
            padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            opacity: draftLoading ? 0.6 : 1,
          }}
        >
          {draftLoading ? "Drafting…" : "↩ Draft Reply"}
        </button>
      </div>

      {/* Subject */}
      <div style={{ padding: "16px 16px 8px" }}>
        <h2 style={{
          fontSize: 18, fontWeight: 600, color: "var(--text-bright)",
          margin: 0, lineHeight: 1.3,
        }}>
          {message.subject || "(no subject)"}
        </h2>
      </div>

      {/* Sender info */}
      <div style={{
        padding: "8px 16px 16px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: "1px solid var(--card-border)",
      }}>
        <InitialsAvatar name={name} email={email} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)" }}>
            {name || email}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {email}{name ? "" : ""} {"\u00b7"} {formatDate(message.date)}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, overflow: "auto", padding: 16,
      }}>
        {message.bodyIsHtml ? (
          <div
            dangerouslySetInnerHTML={{ __html: message.body }}
            style={{
              fontSize: 13, lineHeight: 1.6, color: "var(--text-bright)",
              maxWidth: 700,
            }}
          />
        ) : (
          <pre style={{
            fontSize: 13, lineHeight: 1.6, color: "var(--text-bright)",
            whiteSpace: "pre-wrap", wordWrap: "break-word",
            fontFamily: "inherit", margin: 0, maxWidth: 700,
          }}>
            {message.body}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function EmailInbox({ initialMessages = [], initialNextPage = null, onEmailToTask }) {
  const [messages, setMessages] = useState(initialMessages);
  const [nextPage, setNextPage] = useState(initialNextPage);
  const [selected, setSelected] = useState(new Set());
  const [openMessage, setOpenMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const fetchInbox = useCallback(async (query, pageToken) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(`/api/email?${params}`);
      const data = await res.json();
      if (pageToken) {
        setMessages((prev) => [...prev, ...(data.messages || [])]);
      } else {
        setMessages(data.messages || []);
      }
      setNextPage(data.nextPageToken || null);
    } catch (err) {
      console.error("Inbox fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleArchive = useCallback(async (messageId) => {
    setArchiving((prev) => new Set(prev).add(messageId));
    try {
      await fetch("/api/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", messageId }),
      });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setSelected((prev) => { const n = new Set(prev); n.delete(messageId); return n; });
      if (openMessage?.id === messageId) setOpenMessage(null);
    } catch (err) {
      console.error("Archive error:", err);
    } finally {
      setArchiving((prev) => { const n = new Set(prev); n.delete(messageId); return n; });
    }
  }, [openMessage]);

  const handleArchiveSelected = useCallback(async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setArchiving(new Set(ids));
    try {
      await fetch("/api/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archiveMany", messageIds: ids }),
      });
      setMessages((prev) => prev.filter((m) => !selected.has(m.id)));
      setSelected(new Set());
      if (openMessage && selected.has(openMessage.id)) setOpenMessage(null);
    } catch (err) {
      console.error("Bulk archive error:", err);
    } finally {
      setArchiving(new Set());
    }
  }, [selected, openMessage]);

  const handleOpen = useCallback(async (messageId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/${messageId}`);
      const data = await res.json();
      setOpenMessage(data);
      // Mark as read in local state
      setMessages((prev) =>
        prev.map((m) => m.id === messageId ? { ...m, isUnread: false } : m)
      );
    } catch (err) {
      console.error("Message fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelect = useCallback((id, checked) => {
    setSelected((prev) => {
      const n = new Set(prev);
      checked ? n.add(id) : n.delete(id);
      return n;
    });
  }, []);

  const handleSelectAll = useCallback((checked) => {
    setSelected(checked ? new Set(messages.map((m) => m.id)) : new Set());
  }, [messages]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    fetchInbox(searchQuery);
  }, [fetchInbox, searchQuery]);

  const handleReply = useCallback(async (message) => {
    setDraft("");
    setDraftLoading(true);
    setDraftSaved(false);
    try {
      const res = await fetch("/api/email/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          subject: message.subject,
          from: message.from,
          body: message.body,
          snippet: message.snippet,
        }),
      });
      const data = await res.json();
      setDraft(data.draft || "");
    } catch {
      setDraft("Failed to generate draft. Try again.");
    } finally {
      setDraftLoading(false);
    }
  }, []);

  const handleSaveDraft = useCallback(async () => {
    if (!openMessage) return;
    try {
      await fetch("/api/email/draft-reply", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: openMessage.from,
          subject: openMessage.subject,
          body: draft,
          threadId: openMessage.threadId,
          messageId: openMessage.id,
        }),
      });
      setDraftSaved(true);
    } catch {
      alert("Failed to save draft");
    }
  }, [openMessage, draft]);

  const handleConvertToTask = useCallback(async (message) => {
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert_to_task",
          messageId: message.id,
          subject: message.subject,
          from: message.from,
          snippet: message.snippet,
        }),
      });
      if (res.ok) {
        const { task } = await res.json();
        onEmailToTask?.(task);
        handleArchive(message.id);
      }
    } catch (err) {
      console.error("Convert to task failed:", err);
    }
  }, [handleArchive, onEmailToTask]);

  const unreadCount = messages.filter((m) => m.isUnread).length;

  // Detail view
  if (openMessage) {
    return (
      <div style={{
        background: "var(--card-bg)", border: "1px solid var(--card-border)",
        borderRadius: 8, overflow: "hidden", minHeight: 500, display: "flex", flexDirection: "column",
      }}>
        <EmailDetail
          message={openMessage}
          onBack={() => { setOpenMessage(null); setDraft(""); setDraftSaved(false); }}
          onArchive={handleArchive}
          onReply={handleReply}
          onTask={handleConvertToTask}
          draftLoading={draftLoading}
        />
        {(draft || draftLoading) && (
          <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-dim)", padding: "12px 0 8px" }}>
              Draft Reply
            </div>
            {draftLoading ? (
              <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "8px 0" }}>Generating…</div>
            ) : (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setDraftSaved(false); }}
                  rows={10}
                  style={{
                    width: "100%", background: "var(--bg)", border: "1px solid var(--card-border)",
                    borderRadius: 6, color: "var(--text-bright)", fontSize: 13, lineHeight: 1.6,
                    padding: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
                    {draftSaved ? "✓ Saved to Gmail Drafts" : "Save to Gmail Drafts"}
                  </button>
                  <button
                    onClick={() => { setDraft(""); setDraftSaved(false); }}
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

  // List view
  return (
    <div style={{
      background: "var(--card-bg)", border: "1px solid var(--card-border)",
      borderRadius: 8, overflow: "hidden",
    }}>
      {/* Toolbar */}
      <div style={{
        padding: "8px 16px",
        borderBottom: "1px solid var(--card-border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <input
          type="checkbox"
          checked={selected.size === messages.length && messages.length > 0}
          onChange={(e) => handleSelectAll(e.target.checked)}
          style={{ cursor: "pointer" }}
          title="Select all"
        />

        {selected.size > 0 && (
          <button
            onClick={handleArchiveSelected}
            style={{
              background: "var(--status-green)22", border: "1px solid var(--status-green)",
              color: "var(--status-green)", cursor: "pointer",
              padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            }}
          >
            {"\u2713"} Dismiss {selected.size}
          </button>
        )}

        <form onSubmit={handleSearch} style={{ flex: 1, display: "flex", gap: 8 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emails..."
            style={{
              flex: 1, background: "var(--bg)", color: "var(--text-bright)",
              border: "1px solid var(--card-border)", borderRadius: 6,
              padding: "4px 12px", fontSize: 12,
            }}
          />
          <button type="submit" style={{
            background: "var(--card-border)", border: "none",
            color: "var(--text-bright)", cursor: "pointer",
            padding: "4px 12px", borderRadius: 6, fontSize: 12,
          }}>
            Search
          </button>
        </form>

        <button
          onClick={() => fetchInbox(searchQuery)}
          disabled={loading}
          style={{
            background: "none", border: "1px solid var(--card-border)",
            color: "var(--text-dim)", cursor: "pointer",
            padding: "4px 12px", borderRadius: 6, fontSize: 11,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "..." : "\u21BB"} Refresh
        </button>

        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {messages.length} email{messages.length !== 1 ? "s" : ""}
          {unreadCount > 0 && <span style={{ color: "var(--status-blue)" }}> ({unreadCount} unread)</span>}
        </span>
      </div>

      {/* Message list */}
      <div style={{ maxHeight: "calc(100vh - 280px)", overflow: "auto" }}>
        {messages.map((msg) => (
          <EmailRow
            key={msg.id}
            msg={msg}
            isSelected={selected.has(msg.id)}
            onSelect={handleSelect}
            onOpen={handleOpen}
            onArchive={handleArchive}
          />
        ))}

        {messages.length === 0 && !loading && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--status-green)", fontSize: 14 }}>
            {"\u2713"} Inbox zero. All caught up.
          </div>
        )}

        {loading && messages.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
            Loading inbox...
          </div>
        )}
      </div>

      {/* Load more */}
      {nextPage && (
        <div style={{
          padding: "12px 16px", borderTop: "1px solid var(--card-border)",
          textAlign: "center",
        }}>
          <button
            onClick={() => fetchInbox(searchQuery, nextPage)}
            disabled={loading}
            style={{
              background: "var(--card-border)", border: "none",
              color: "var(--text-bright)", cursor: "pointer",
              padding: "6px 20px", borderRadius: 6, fontSize: 12,
            }}
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
