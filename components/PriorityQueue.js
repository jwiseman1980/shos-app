"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

export default function PriorityQueue({ items, userName }) {
  const [activeTimers, setActiveTimers] = useState({}); // itemId → startedAt
  const [completedIds, setCompletedIds] = useState(new Set());
  const [completing, setCompleting] = useState(null);
  const [outcomeInput, setOutcomeInput] = useState("");
  const [showAll, setShowAll] = useState(false);

  const visible = items.filter((item) => !completedIds.has(item.id));
  const displayed = showAll ? visible : visible.slice(0, 15);

  const handleStart = useCallback((item) => {
    setActiveTimers((prev) => ({ ...prev, [item.id]: new Date().toISOString() }));
  }, []);

  const handleDone = useCallback((item) => {
    setCompleting(item);
    setOutcomeInput("");
  }, []);

  const submitCompletion = useCallback(async () => {
    if (!completing) return;
    const item = completing;
    const startedAt = activeTimers[item.id] || null;

    try {
      await fetch("/api/execution-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: item.itemType,
          itemId: item.id,
          title: item.title,
          description: item.description,
          domain: item.domain,
          startedAt,
          estimatedMinutes: item.estimatedMinutes,
          outcome: outcomeInput || "Completed",
          impactMetric: item.itemType === "outreach" ? "1 family reached" :
                        item.itemType === "donor" ? "1 donor thanked" : null,
        }),
      });
    } catch {
      // Best effort
    }

    setCompletedIds((prev) => new Set([...prev, item.id]));
    setActiveTimers((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setCompleting(null);
  }, [completing, outcomeInput, activeTimers]);

  return (
    <div>
      {/* Completion modal */}
      {completing && (
        <div style={{
          marginBottom: 16, padding: "14px 16px",
          background: "rgba(196, 162, 55, 0.08)",
          border: "1px solid rgba(196, 162, 55, 0.3)",
          borderRadius: "var(--radius-md)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)", marginBottom: 8 }}>
            Completing: {completing.title}
          </div>
          <input
            type="text"
            placeholder="What was accomplished? (optional)"
            value={outcomeInput}
            onChange={(e) => setOutcomeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitCompletion()}
            autoFocus
            style={{
              width: "100%", padding: "8px 12px", fontSize: 13,
              background: "var(--bg)", border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-sm)", color: "var(--text)",
              marginBottom: 8,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={submitCompletion}
              style={{
                padding: "6px 16px", fontSize: 12, fontWeight: 600,
                background: "var(--gold)", color: "#000",
                border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer",
              }}
            >
              Log it
            </button>
            <button
              onClick={() => setCompleting(null)}
              style={{
                padding: "6px 16px", fontSize: 12,
                background: "transparent", color: "var(--text-dim)",
                border: "1px solid var(--card-border)", borderRadius: "var(--radius-sm)", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Queue items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {displayed.map((item, i) => {
          const isActive = !!activeTimers[item.id];
          return (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px",
                background: isActive ? "rgba(196, 162, 55, 0.06)" : "var(--card-bg)",
                border: isActive
                  ? "1px solid rgba(196, 162, 55, 0.3)"
                  : "1px solid var(--card-border)",
                borderRadius: "var(--radius-md)",
                transition: "all 0.15s ease",
              }}
            >
              {/* Rank */}
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: i === 0 ? "var(--gold)" : "var(--bg)",
                border: i === 0 ? "none" : "1px solid var(--card-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                color: i === 0 ? "#000" : "var(--text-dim)",
                flexShrink: 0,
              }}>
                {i + 1}
              </div>

              {/* Icon */}
              <div style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)" }}>
                    {item.title}
                  </span>
                  <span style={{
                    fontSize: 9, padding: "1px 6px", borderRadius: 8,
                    background: item.color + "22", color: item.color,
                    fontWeight: 600, whiteSpace: "nowrap",
                  }}>
                    {item.typeLabel}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  {item.rankReason}
                  {item.estimatedMinutes && ` · ~${item.estimatedMinutes}m`}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {!isActive ? (
                  <Link
                    href={item.deepLink}
                    onClick={() => handleStart(item)}
                    style={{
                      padding: "5px 12px", fontSize: 11, fontWeight: 600,
                      background: "rgba(196, 162, 55, 0.12)", color: "var(--gold)",
                      border: "1px solid rgba(196, 162, 55, 0.3)",
                      borderRadius: "var(--radius-sm)", textDecoration: "none",
                      cursor: "pointer",
                    }}
                  >
                    Start
                  </Link>
                ) : (
                  <span style={{ fontSize: 10, color: "var(--gold)", fontWeight: 600, padding: "5px 0" }}>
                    In progress...
                  </span>
                )}
                <button
                  onClick={() => handleDone(item)}
                  style={{
                    padding: "5px 12px", fontSize: 11, fontWeight: 600,
                    background: "rgba(34, 197, 94, 0.12)", color: "var(--status-green)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    borderRadius: "var(--radius-sm)", cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more */}
      {visible.length > 15 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            marginTop: 12, width: "100%", padding: "8px",
            background: "transparent", border: "1px solid var(--card-border)",
            borderRadius: "var(--radius-sm)", color: "var(--text-dim)",
            fontSize: 12, cursor: "pointer",
          }}
        >
          Show all {visible.length} items
        </button>
      )}

      {visible.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
          Queue clear. Nice work.
        </div>
      )}
    </div>
  );
}
