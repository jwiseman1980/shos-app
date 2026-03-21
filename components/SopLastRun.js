"use client";

import { useState, useEffect } from "react";

export default function SopLastRun({ sopId }) {
  const [lastRun, setLastRun] = useState(null);

  useEffect(() => {
    try {
      const history = JSON.parse(
        localStorage.getItem("shos-sop-run-history") || "[]"
      );
      const sopRuns = history.filter((r) => r.sopId === sopId);
      if (sopRuns.length > 0) {
        setLastRun(sopRuns[0]); // Most recent
      }
    } catch {
      // ignore
    }
  }, [sopId]);

  if (!lastRun) return null;

  const date = new Date(lastRun.completedAt || lastRun.timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let timeAgo;
  if (diffHours < 1) timeAgo = "just now";
  else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
  else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
  else
    timeAgo = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  const wasComplete = lastRun.completedSteps === lastRun.totalSteps;

  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 6px",
        borderRadius: "var(--radius-sm)",
        background: wasComplete
          ? "rgba(34, 197, 94, 0.15)"
          : "rgba(245, 158, 11, 0.15)",
        color: wasComplete ? "var(--status-green)" : "var(--status-orange)",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      Last run: {timeAgo}
    </span>
  );
}
