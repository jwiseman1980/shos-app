"use client";

import Link from "next/link";

const DOMAIN_COLORS = {
  family: "#e91e63",
  finance: "#2ecc71",
  operations: "#e67e22",
  comms: "#1abc9c",
  development: "#9b59b6",
  governance: "#27ae60",
  general: "#95a5a6",
};

export default function TaskQueue({ items = [] }) {
  return (
    <div className="data-card" style={{ flexShrink: 0 }}>
      <div className="data-card-header" style={{ padding: "10px 16px" }}>
        <h2 className="data-card-title" style={{ fontSize: 13 }}>Queue</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{items.length} items</span>
          <Link href="/tasks" style={{ fontSize: 11, color: "var(--text-dim)", textDecoration: "none" }}>
            View all &rarr;
          </Link>
        </div>
      </div>
      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {items.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--status-green)" }}>
            Queue clear
          </div>
        )}
        {items.map((item, i) => {
          const domainColor = DOMAIN_COLORS[item.domain] || "#95a5a6";
          return (
            <div key={item.id || i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 16px",
              borderBottom: "1px solid var(--card-border)",
            }}>
              {/* Rank */}
              <span style={{
                fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: "center",
                color: i === 0 ? "var(--gold)" : "var(--text-dim)",
              }}>
                {i + 1}
              </span>

              {/* Icon */}
              <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon || "\u2610"}</span>

              {/* Title + description */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, color: "var(--text-bright)", fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {item.title}
                </div>
                {item.rankReason && (
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>
                    {item.rankReason}
                  </div>
                )}
              </div>

              {/* Due date */}
              {item.dueDate && (
                <span style={{
                  fontSize: 10, color: isOverdue(item.dueDate) ? "var(--status-red)" : "var(--text-dim)",
                  fontFamily: "monospace", flexShrink: 0,
                }}>
                  {formatDueDate(item.dueDate)}
                </span>
              )}

              {/* Time estimate */}
              {item.estimatedMinutes && (
                <span style={{
                  fontSize: 9, padding: "1px 5px", borderRadius: 3,
                  background: "var(--bg-3)", color: "var(--text-dim)",
                  flexShrink: 0,
                }}>
                  {item.estimatedMinutes}m
                </span>
              )}

              {/* Type badge */}
              {item.typeLabel && (
                <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 600, flexShrink: 0,
                  background: `${domainColor}18`, color: domainColor,
                }}>
                  {item.typeLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return dateStr < today;
}

function formatDueDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date();
    const todayStr = today.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    if (dateStr === todayStr) return "today";
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === tomorrow.toLocaleDateString("en-CA", { timeZone: "America/New_York" })) return "tomorrow";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}
