"use client";

import { useState } from "react";

export default function SyncOrdersButton() {
  const [state, setState] = useState("idle"); // idle | syncing | done | error
  const [result, setResult] = useState(null);

  async function handleSync() {
    setState("syncing");
    setResult(null);
    try {
      const res = await fetch("/api/orders/sync-now", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setState("error");
        setResult(data.error || data.message || "Sync failed");
        return;
      }
      setState("done");
      setResult(
        data.synced > 0
          ? `${data.synced} new order${data.synced > 1 ? "s" : ""} synced`
          : "All orders up to date"
      );
      // Refresh page after short delay so new orders appear
      if (data.synced > 0) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      setState("error");
      setResult("Network error");
    }
  }

  const colors = {
    idle: { bg: "var(--card-bg)", border: "var(--status-blue)", text: "var(--status-blue)" },
    syncing: { bg: "var(--card-bg)", border: "var(--text-dim)", text: "var(--text-dim)" },
    done: { bg: "var(--card-bg)", border: "var(--status-green)", text: "var(--status-green)" },
    error: { bg: "var(--card-bg)", border: "var(--status-red, #e74c3c)", text: "var(--status-red, #e74c3c)" },
  };

  const c = colors[state];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button
        onClick={handleSync}
        disabled={state === "syncing"}
        style={{
          background: c.bg,
          border: `1px solid ${c.border}`,
          color: c.text,
          padding: "6px 14px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: state === "syncing" ? "wait" : "pointer",
          opacity: state === "syncing" ? 0.6 : 1,
          transition: "all 0.2s",
        }}
      >
        {state === "syncing" ? "Syncing…" : "Sync Orders"}
      </button>
      {result && (
        <span style={{ fontSize: 11, color: c.text }}>{result}</span>
      )}
    </div>
  );
}
