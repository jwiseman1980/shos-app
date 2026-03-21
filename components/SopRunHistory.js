"use client";

import { useState, useEffect } from "react";

export default function SopRunHistory() {
  const [history, setHistory] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const data = JSON.parse(
        localStorage.getItem("shos-sop-run-history") || "[]"
      );
      setHistory(data);
    } catch {
      setHistory([]);
    }
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  if (history.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
          No completed runs yet. Start a run from any SOP to track your history.
        </div>
      </div>
    );
  }

  // Group by date
  const byDate = {};
  for (const run of history) {
    const date = new Date(
      run.completedAt || run.timestamp
    ).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(run);
  }

  return (
    <div>
      {Object.entries(byDate).map(([date, runs]) => (
        <div key={date} style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
              paddingBottom: 4,
              borderBottom: "1px solid var(--card-border)",
            }}
          >
            {date}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {runs.map((run, i) => {
              const time = new Date(
                run.completedAt || run.timestamp
              ).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              const wasComplete =
                run.completedSteps === run.totalSteps;

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    background: "var(--bg)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: wasComplete
                          ? "var(--status-green)"
                          : "var(--status-orange)",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text-bright)",
                        }}
                      >
                        {run.sopId}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-dim)",
                        }}
                      >
                        {run.sopTitle}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "var(--text-dim)" }}>{time}</span>
                    {run.durationMinutes > 0 && (
                      <span style={{ color: "var(--text-dim)" }}>
                        {run.durationMinutes} min
                      </span>
                    )}
                    <span
                      style={{
                        color: wasComplete
                          ? "var(--status-green)"
                          : "var(--status-orange)",
                        fontWeight: 600,
                      }}
                    >
                      {run.completedSteps}/{run.totalSteps}
                    </span>
                    {run.slackPosted && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          background: "var(--status-blue)",
                          color: "#fff",
                          borderRadius: "var(--radius-sm)",
                          fontWeight: 600,
                        }}
                      >
                        SLACK
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
