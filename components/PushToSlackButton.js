"use client";

import { useState } from "react";

export default function PushToSlackButton({ volunteerEmail = null, label = "Push pending to Slack" }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function handleClick() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/anniversaries/push-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(volunteerEmail ? { volunteerEmail } : {}),
      });
      const data = await res.json();
      if (data.success) {
        const total = data.results?.reduce((s, r) => s + (r.tasks || 0), 0) || 0;
        const sentTo = data.results?.filter((r) => r.sent).length || 0;
        setResult(
          total === 0
            ? "Nothing pending to push."
            : `Pushed ${total} task${total === 1 ? "" : "s"} to ${sentTo} volunteer${sentTo === 1 ? "" : "s"}.`
        );
      } else {
        setResult(`Error: ${data.error || "push failed"}`);
      }
    } catch (err) {
      setResult(`Error: ${err.message}`);
    } finally {
      setBusy(false);
      setTimeout(() => setResult(null), 6000);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={handleClick}
        disabled={busy}
        className="btn btn-primary"
        style={{ padding: "6px 12px", fontSize: 12 }}
        title="DM each assigned volunteer their full pending anniversary list with Create Draft buttons"
      >
        {busy ? "Pushing..." : label}
      </button>
      {result && (
        <span style={{ fontSize: 11, color: result.startsWith("Error") ? "var(--status-red)" : "var(--text-dim)" }}>
          {result}
        </span>
      )}
    </span>
  );
}
