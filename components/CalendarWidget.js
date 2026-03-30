"use client";

import { useState, useEffect } from "react";

const ROLE_COLORS = {
  primary:  "#3498db",
  ops:      "#e74c3c",
  cto:      "#8e44ad",
  ed:       "#c4a237",
  cos:      "#27ae60",
  cfo:      "#2ecc71",
  coo:      "#e67e22",
  comms:    "#1abc9c",
  dev:      "#9b59b6",
  family:   "#e91e63",
};

const ROLE_LABELS = {
  primary:  "Personal",
  ops:      "Ops",
  cto:      "CTO",
  ed:       "ED",
  cos:      "COS",
  cfo:      "CFO",
  coo:      "COO",
  comms:    "Comms",
  dev:      "Dev",
  family:   "Family",
};

function formatTime(isoStr) {
  if (!isoStr || isoStr.length === 10) return "All day";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
}

function isNow(start, end) {
  const now = new Date();
  return new Date(start) <= now && now <= new Date(end);
}

function isPast(end) {
  return new Date(end) < new Date();
}

export default function CalendarWidget({ initialEvents }) {
  const [events, setEvents] = useState(initialEvents || []);
  const [loading, setLoading] = useState(!initialEvents);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (initialEvents) return;
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setEvents(data.events);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initialEvents]);

  if (loading) {
    return (
      <div style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: 13 }}>
        Loading calendar...
      </div>
    );
  }

  // Separate all-day events from timed events
  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay);

  // Show first 6 timed events unless expanded
  const visibleTimed = expanded ? timed : timed.slice(0, 6);
  const hasMore = timed.length > 6;

  return (
    <div>
      {/* All-day events as pills */}
      {allDay.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 16px" }}>
          {allDay.map((event) => (
            <span
              key={event.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 11,
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: ROLE_COLORS[event.role] || "#666",
                flexShrink: 0,
              }} />
              {event.summary}
            </span>
          ))}
        </div>
      )}

      {/* Timed events as timeline */}
      <div style={{ padding: "4px 0" }}>
        {visibleTimed.length === 0 && allDay.length === 0 && (
          <div style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: 13 }}>
            No events today
          </div>
        )}

        {visibleTimed.map((event) => {
          const current = isNow(event.start, event.end);
          const past = isPast(event.end);

          return (
            <div
              key={event.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "6px 16px",
                opacity: past ? 0.5 : 1,
                background: current ? "rgba(52, 152, 219, 0.08)" : "transparent",
                borderLeft: current ? "3px solid #3498db" : "3px solid transparent",
                transition: "background 0.2s",
              }}
            >
              {/* Time column */}
              <div style={{
                width: 65,
                flexShrink: 0,
                fontSize: 12,
                color: current ? "#3498db" : "var(--text-dim)",
                fontWeight: current ? 600 : 400,
                paddingTop: 1,
              }}>
                {formatTime(event.start)}
              </div>

              {/* Event details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  color: current ? "var(--text-bright)" : past ? "var(--text-dim)" : "var(--text-secondary)",
                  fontWeight: current ? 600 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {event.summary}
                </div>
              </div>

              {/* Role badge */}
              <span style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 3,
                background: `${ROLE_COLORS[event.role] || "#666"}22`,
                color: ROLE_COLORS[event.role] || "#666",
                fontWeight: 600,
                flexShrink: 0,
              }}>
                {ROLE_LABELS[event.role] || event.role}
              </span>
            </div>
          );
        })}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "block",
            width: "100%",
            padding: "6px 16px",
            border: "none",
            background: "none",
            color: "#3498db",
            fontSize: 12,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {expanded ? "Show less" : `Show ${timed.length - 6} more events`}
        </button>
      )}
    </div>
  );
}
