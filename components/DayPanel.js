"use client";

import { useState, useEffect, useMemo } from "react";

import { getEventColor, getEventLabel } from "@/lib/calendar-colors";

// Legacy compat — components now use getEventColor/getEventLabel
const ROLE_COLORS = { primary: "#3498db", ops: "#e74c3c" };
const ROLE_LABELS = { primary: "Tasks", ops: "Ops" };

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

function toETDateString(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function DayPanel({ events = [], tasks = [], collapsed, onToggle }) {
  const [now, setNow] = useState(new Date());
  const [expandedId, setExpandedId] = useState(null);
  const [dateOffset, setDateOffset] = useState(0); // 0 = today, -1 = yesterday, +1 = tomorrow
  const [fetchedEvents, setFetchedEvents] = useState(null);
  const [loading, setLoading] = useState(false);

  // Update current time every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch events when navigating away from today
  useEffect(() => {
    if (dateOffset === 0) {
      setFetchedEvents(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const target = new Date(now);
    target.setDate(target.getDate() + dateOffset);
    const dateStr = toETDateString(target);
    fetch(`/api/calendar?date=${dateStr}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setFetchedEvents(data.events || []);
      })
      .catch(() => {
        if (!cancelled) setFetchedEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [dateOffset, now]);

  // Use fetched events when viewing another day, props events for today
  const displayEvents = dateOffset === 0 ? events : (fetchedEvents || []);

  const selectedDate = new Date(now);
  selectedDate.setDate(selectedDate.getDate() + dateOffset);

  const isToday = dateOffset === 0;

  const dateLabel = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  // Separate all-day vs timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay = [];
    const timed = [];
    for (const ev of displayEvents) {
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

  // Deconfliction: detect overlapping events and assign columns
  const eventLayout = useMemo(() => {
    if (!timedEvents.length) return [];

    // Sort by start time, then by duration (longer first)
    const sorted = [...timedEvents].sort((a, b) => {
      const diff = new Date(a.start) - new Date(b.start);
      if (diff !== 0) return diff;
      return getDurationMinutes(b.start, b.end) - getDurationMinutes(a.start, a.end);
    });

    // Assign columns using a greedy algorithm
    const columns = []; // Array of arrays, each sub-array is a column
    const layout = new Map(); // eventId → { col, totalCols }

    for (const ev of sorted) {
      const evStart = new Date(ev.start).getTime();
      const evEnd = new Date(ev.end).getTime();

      // Find the first column where this event doesn't overlap
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c][columns[c].length - 1];
        const lastEnd = new Date(lastInCol.end).getTime();
        if (evStart >= lastEnd) {
          columns[c].push(ev);
          layout.set(ev.id || ev.summary, { col: c });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([ev]);
        layout.set(ev.id || ev.summary, { col: columns.length - 1 });
      }
    }

    // Now set totalCols for each event based on its overlap group
    const totalCols = columns.length;
    for (const [key, val] of layout) {
      val.totalCols = totalCols;
    }

    return { layout, totalCols };
  }, [timedEvents]);

  // Current time position
  const nowHour = parseInt(
    now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" })
  );
  const nowMinute = now.getMinutes();
  const nowOffset = (nowHour - START_HOUR) * HOUR_HEIGHT + (nowMinute / 60) * HOUR_HEIGHT;
  const showNowLine = isToday && nowHour >= START_HOUR && nowHour < END_HOUR;

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
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => setDateOffset((d) => d - 1)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-dim)",
                cursor: "pointer",
                fontSize: 14,
                padding: "2px 4px",
                lineHeight: 1,
              }}
              title="Previous day"
            >
              &#9664;
            </button>
            <div style={{ color: "var(--text-bright)", fontWeight: 600, fontSize: 14 }}>
              {dateLabel}
            </div>
            <button
              onClick={() => setDateOffset((d) => d + 1)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-dim)",
                cursor: "pointer",
                fontSize: 14,
                padding: "2px 4px",
                lineHeight: 1,
              }}
              title="Next day"
            >
              &#9654;
            </button>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          <div style={{ color: "var(--text-dim)", fontSize: 11 }}>
            {loading ? "Loading..." : `${timedEvents.length} events \u00b7 ${taskOnly.length} tasks`}
          </div>
          {!isToday && (
            <button
              onClick={() => setDateOffset(0)}
              style={{
                background: "rgba(196, 162, 55, 0.15)",
                border: "none",
                color: "var(--gold)",
                cursor: "pointer",
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 3,
              }}
            >
              Today
            </button>
          )}
        </div>
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

        {/* Timed events overlay — with deconfliction columns */}
        {timedEvents.map((ev, i) => {
          const topOffset = getMinuteOffset(ev.start);
          const duration = getDurationMinutes(ev.start, ev.end);
          const top = (topOffset / 60) * HOUR_HEIGHT;
          const height = Math.max((duration / 60) * HOUR_HEIGHT, 20);
          const roleColor = getEventColor(ev);
          const past = isToday && isPast(ev.end);
          const current = isToday && isNow(ev.start, ev.end);
          const expanded = expandedId === ev.id;

          // Deconfliction: position side-by-side when overlapping
          const evLayout = eventLayout?.layout?.get(ev.id || ev.summary);
          const col = evLayout?.col || 0;
          const totalCols = eventLayout?.totalCols || 1;
          const availWidth = 100; // percentage of container
          const colWidth = availWidth / totalCols;
          const leftPct = col * colWidth;

          return (
            <div
              key={ev.id || i}
              onClick={() => setExpandedId(expanded ? null : ev.id)}
              style={{
                position: "absolute",
                top,
                left: `calc(48px + (100% - 56px) * ${col / totalCols})`,
                width: `calc((100% - 56px) * ${1 / totalCols} - 4px)`,
                height: expanded ? "auto" : height,
                minHeight: 20,
                background: current
                  ? "rgba(52, 152, 219, 0.15)"
                  : "rgba(255,255,255,0.06)",
                borderLeft: `3px solid ${roleColor}`,
                borderRadius: "0 4px 4px 0",
                padding: "3px 6px",
                cursor: "pointer",
                opacity: past && !current ? 0.5 : 1,
                zIndex: current ? 2 : 1,
                overflow: "hidden",
                transition: "opacity 0.2s",
              }}
            >
              <div
                style={{
                  fontSize: totalCols > 2 ? 9 : 11,
                  color: "var(--text-bright)",
                  fontWeight: current ? 600 : 400,
                  whiteSpace: expanded ? "normal" : "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {ev.summary}
              </div>
              {totalCols <= 2 && (
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  {formatTime(ev.start)} – {formatTime(ev.end)}
                </div>
              )}
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
