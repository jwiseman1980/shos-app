"use client";

import { useState, useEffect, useMemo } from "react";

const ROLE_COLORS = {
  primary: "#3498db",
  ops: "#e74c3c",
  cto: "#8e44ad",
  ed: "#c4a237",
  cos: "#27ae60",
  cfo: "#2ecc71",
  coo: "#e67e22",
  comms: "#1abc9c",
  dev: "#9b59b6",
  family: "#e91e63",
};

const ROLE_LABELS = {
  primary: "Personal",
  ops: "Ops",
  cto: "CTO",
  ed: "ED",
  cos: "COS",
  cfo: "CFO",
  coo: "COO",
  comms: "Comms",
  dev: "Dev",
  family: "Family",
};

const HOUR_HEIGHT = 48;
const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

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

function getMinuteOffset(isoStr) {
  const d = new Date(isoStr);
  const hours = parseInt(
    d.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" })
  );
  const minutes = d.getMinutes();
  return (hours - START_HOUR) * 60 + minutes;
}

function getDurationMinutes(start, end) {
  return (new Date(end) - new Date(start)) / 60000;
}

function isPast(end) {
  return new Date(end) < new Date();
}

function isNow(start, end) {
  const now = new Date();
  return new Date(start) <= now && now <= new Date(end);
}

export default function DayPanel({ events = [], tasks = [], collapsed, onToggle }) {
  const [now, setNow] = useState(new Date());
  const [expandedId, setExpandedId] = useState(null);

  // Update current time every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  // Separate all-day vs timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay = [];
    const timed = [];
    for (const ev of events) {
      if (ev.allDay || (ev.start && !ev.start.includes("T"))) {
        allDay.push(ev);
      } else if (ev.start) {
        timed.push(ev);
      }
    }
    return { allDayEvents: allDay, timedEvents: timed };
  }, [events]);

  // Tasks that are NOT calendar-sourced (avoid duplicates)
  const taskOnly = useMemo(() => {
    return tasks.filter((t) => t.source !== "calendar" && t.status !== "done");
  }, [tasks]);

  // Current time position
  const nowHour = parseInt(
    now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" })
  );
  const nowMinute = now.getMinutes();
  const nowOffset = (nowHour - START_HOUR) * HOUR_HEIGHT + (nowMinute / 60) * HOUR_HEIGHT;
  const showNowLine = nowHour >= START_HOUR && nowHour < END_HOUR;

  if (collapsed) {
    return (
      <div className="day-panel day-panel--collapsed">
        <button
          className="day-panel-toggle"
          onClick={onToggle}
          title="Expand day view"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: 16,
            padding: "12px 8px",
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            letterSpacing: 1,
          }}
        >
          Today
        </button>
      </div>
    );
  }

  return (
    <div className="day-panel">
      {/* Header */}
      <div
        style={{
          padding: "12px 14px 8px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ color: "var(--text-bright)", fontWeight: 600, fontSize: 14 }}>
            {todayStr}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 2 }}>
            {timedEvents.length} events &middot; {taskOnly.length} tasks
          </div>
        </div>
        <button
          onClick={onToggle}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: 16,
            padding: 4,
          }}
          title="Collapse day view"
        >
          &raquo;
        </button>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            All Day
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {allDayEvents.map((ev, i) => (
              <div
                key={ev.id || i}
                style={{
                  background: "rgba(196, 162, 55, 0.15)",
                  color: "var(--gold)",
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
                title={ev.summary}
              >
                {ev.summary}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hourly grid */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {/* Hour labels + grid lines */}
        {Array.from({ length: TOTAL_HOURS }, (_, i) => {
          const hour = START_HOUR + i;
          const label =
            hour === 0 ? "12 AM" :
            hour < 12 ? `${hour} AM` :
            hour === 12 ? "12 PM" :
            `${hour - 12} PM`;
          return (
            <div
              key={hour}
              style={{
                height: HOUR_HEIGHT,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                display: "flex",
                alignItems: "flex-start",
                paddingTop: 2,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  width: 44,
                  textAlign: "right",
                  paddingRight: 8,
                  flexShrink: 0,
                  opacity: 0.7,
                }}
              >
                {label}
              </span>
              <div style={{ flex: 1, borderTop: "1px solid rgba(255,255,255,0.04)" }} />
            </div>
          );
        })}

        {/* Timed events overlay */}
        {timedEvents.map((ev, i) => {
          const topOffset = getMinuteOffset(ev.start);
          const duration = getDurationMinutes(ev.start, ev.end);
          const top = (topOffset / 60) * HOUR_HEIGHT;
          const height = Math.max((duration / 60) * HOUR_HEIGHT, 20);
          const roleColor = ROLE_COLORS[ev.role] || "var(--gold)";
          const past = isPast(ev.end);
          const current = isNow(ev.start, ev.end);
          const expanded = expandedId === ev.id;

          return (
            <div
              key={ev.id || i}
              onClick={() => setExpandedId(expanded ? null : ev.id)}
              style={{
                position: "absolute",
                top,
                left: 48,
                right: 8,
                height: expanded ? "auto" : height,
                minHeight: 20,
                background: current
                  ? "rgba(52, 152, 219, 0.15)"
                  : "rgba(255,255,255,0.04)",
                borderLeft: `3px solid ${roleColor}`,
                borderRadius: "0 4px 4px 0",
                padding: "3px 8px",
                cursor: "pointer",
                opacity: past && !current ? 0.5 : 1,
                zIndex: current ? 2 : 1,
                overflow: "hidden",
                transition: "opacity 0.2s",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-bright)",
                  fontWeight: current ? 600 : 400,
                  whiteSpace: expanded ? "normal" : "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {ev.summary}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                {formatTime(ev.start)} – {formatTime(ev.end)}
              </div>
              {expanded && ev.description && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    marginTop: 6,
                    lineHeight: 1.4,
                    whiteSpace: "pre-wrap",
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {ev.description.slice(0, 500)}
                  {ev.description.length > 500 ? "..." : ""}
                </div>
              )}
            </div>
          );
        })}

        {/* Current time indicator */}
        {showNowLine && (
          <div
            style={{
              position: "absolute",
              top: nowOffset,
              left: 0,
              right: 0,
              height: 2,
              background: "var(--gold)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 40,
                top: -4,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--gold)",
              }}
            />
          </div>
        )}
      </div>

    </div>
  );
}
