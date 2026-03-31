"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { CATEGORY_STYLES } from "@/lib/email-classifier";

const ROLE_COLORS = {
  primary: "#3498db", ops: "#e74c3c", cto: "#8e44ad", ed: "#c4a237",
  cos: "#27ae60", cfo: "#2ecc71", coo: "#e67e22", comms: "#1abc9c",
  dev: "#9b59b6", family: "#e91e63",
};

const MAX_ITEMS = 8;

export default function CommandCenter({ events = [], queue = [], emails = [] }) {
  return (
    <div className="data-card" style={{ marginBottom: 24 }}>
      <div className="data-card-header">
        <h2 className="data-card-title">Command Center</h2>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 1,
        background: "var(--card-border)",
        borderRadius: "0 0 8px 8px",
        overflow: "hidden",
      }}>
        <ScheduleColumn events={events} />
        <QueueColumn items={queue} />
        <InboxColumn emails={emails} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule Column
// ---------------------------------------------------------------------------

function ScheduleColumn({ events }) {
  const timedEvents = events
    .filter(e => !e.allDay)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const allDayEvents = events.filter(e => e.allDay);
  const shown = timedEvents.slice(0, MAX_ITEMS);

  return (
    <Column title="Schedule" count={timedEvents.length} href="/" accent="var(--status-blue)">
      {allDayEvents.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "0 12px 8px", borderBottom: "1px solid var(--card-border)" }}>
          {allDayEvents.slice(0, 3).map((e, i) => (
            <span key={i} style={{
              fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 600,
              background: `${ROLE_COLORS[e.role] || "#666"}22`,
              color: ROLE_COLORS[e.role] || "#666",
            }}>
              {e.summary?.length > 30 ? e.summary.slice(0, 30) + "..." : e.summary}
            </span>
          ))}
        </div>
      )}
      {shown.length === 0 && <EmptyState text="No events today" />}
      {shown.map((e, i) => (
        <Row key={e.id || i}>
          <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "monospace", minWidth: 52 }}>
            {formatTime(e.start)}
          </span>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
            background: ROLE_COLORS[e.role] || "#666",
          }} />
          <span style={{ fontSize: 12, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.summary}
          </span>
        </Row>
      ))}
      {timedEvents.length > MAX_ITEMS && (
        <ViewAll href="/" count={timedEvents.length - MAX_ITEMS} />
      )}
    </Column>
  );
}

// ---------------------------------------------------------------------------
// Queue Column
// ---------------------------------------------------------------------------

function QueueColumn({ items }) {
  const shown = items.slice(0, MAX_ITEMS);

  return (
    <Column title="Queue" count={items.length} href="/tasks" accent="#f59e0b">
      {shown.length === 0 && <EmptyState text="Queue clear" />}
      {shown.map((item, i) => (
        <Row key={item.id || i}>
          <span style={{
            fontSize: 10, fontWeight: 700, minWidth: 20, textAlign: "center",
            color: i === 0 ? "var(--gold)" : "var(--text-dim)",
          }}>
            {i + 1}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {item.title}
          </span>
          {item.typeLabel && (
            <span style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600, flexShrink: 0,
              background: "var(--status-blue)22", color: "var(--status-blue)",
            }}>
              {item.typeLabel}
            </span>
          )}
        </Row>
      ))}
      {items.length > MAX_ITEMS && (
        <ViewAll href="/tasks" count={items.length - MAX_ITEMS} />
      )}
    </Column>
  );
}

// ---------------------------------------------------------------------------
// Inbox Column
// ---------------------------------------------------------------------------

function InboxColumn({ emails: initialEmails }) {
  const [emails, setEmails] = useState(initialEmails);
  const [archiving, setArchiving] = useState({});
  const shown = emails.slice(0, MAX_ITEMS);

  const handleArchive = useCallback(async (id) => {
    setArchiving(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch("/api/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", messageId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setEmails(prev => prev.filter(e => e.id !== id));
      }
    } catch (err) {
      console.error("Archive failed:", err);
    } finally {
      setArchiving(prev => ({ ...prev, [id]: false }));
    }
  }, []);

  return (
    <Column title="Inbox" count={emails.length} href="/email" accent="#22c55e">
      {shown.length === 0 && <EmptyState text="Inbox zero" />}
      {shown.map((email) => {
        const cat = CATEGORY_STYLES[email.category];
        return (
          <Row key={email.id} style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {extractSenderName(email.from)}
                </span>
                {cat?.label && (
                  <span style={{
                    fontSize: 8, padding: "1px 4px", borderRadius: 3, fontWeight: 700, flexShrink: 0,
                    background: `${cat.color}22`, color: cat.color,
                  }}>
                    {cat.label}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                {email.subject}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleArchive(email.id); }}
              disabled={archiving[email.id]}
              title="Archive"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-dim)", fontSize: 14, padding: "0 4px", flexShrink: 0,
                opacity: archiving[email.id] ? 0.3 : 0.5,
              }}
              onMouseEnter={(e) => e.target.style.opacity = 1}
              onMouseLeave={(e) => e.target.style.opacity = 0.5}
            >
              {archiving[email.id] ? "\u23f3" : "\u2713"}
            </button>
          </Row>
        );
      })}
      {emails.length > MAX_ITEMS && (
        <ViewAll href="/email" count={emails.length - MAX_ITEMS} />
      )}
    </Column>
  );
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

function Column({ title, count, href, accent, children }) {
  return (
    <div style={{ background: "var(--card-bg)", minHeight: 200 }}>
      <div style={{
        padding: "10px 12px", borderBottom: "1px solid var(--card-border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: accent }}>
          {title}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
          {count}
        </span>
      </div>
      <div style={{ padding: "4px 0" }}>
        {children}
      </div>
    </div>
  );
}

function Row({ children, style }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
      borderBottom: "1px solid var(--card-border)11",
      ...style,
    }}>
      {children}
    </div>
  );
}

function ViewAll({ href, count }) {
  return (
    <div style={{ padding: "8px 12px", textAlign: "center" }}>
      <Link href={href} style={{ fontSize: 11, color: "var(--text-dim)", textDecoration: "none" }}>
        +{count} more &rarr;
      </Link>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ padding: "24px 12px", textAlign: "center", fontSize: 12, color: "var(--text-dim)" }}>
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatTime(dateStr) {
  try {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
    });
  } catch {
    return "";
  }
}

function extractSenderName(from = "") {
  // "Joseph Wiseman <joseph@example.com>" → "Joseph Wiseman"
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  // "joseph@example.com" → "joseph"
  return from.replace(/<[^>]+>/, "").trim().split("@")[0];
}
