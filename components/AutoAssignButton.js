"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AutoAssignButton({ days = 30, label = "Auto-assign unassigned" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function handleClick() {
    if (!confirm(`Distribute all unassigned anniversaries in the next ${days} days evenly across volunteers? Each gets a Slack DM.`)) {
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/anniversaries/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.assigned === 0) {
          setResult(data.message || "Nothing to assign.");
        } else {
          setResult(`Assigned ${data.assigned} of ${data.total} across ${data.volunteers} volunteer${data.volunteers === 1 ? "" : "s"}.`);
          router.refresh();
        }
      } else {
        setResult(`Error: ${data.error || "auto-assign failed"}`);
      }
    } catch (err) {
      setResult(`Error: ${err.message}`);
    } finally {
      setBusy(false);
      setTimeout(() => setResult(null), 8000);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={handleClick}
        disabled={busy}
        className="btn btn-ghost"
        style={{ padding: "6px 12px", fontSize: 12 }}
        title="Round-robin distribute unassigned anniversaries to all eligible volunteers"
      >
        {busy ? "Assigning..." : label}
      </button>
      {result && (
        <span style={{ fontSize: 11, color: result.startsWith("Error") ? "var(--status-red)" : "var(--text-dim)" }}>
          {result}
        </span>
      )}
    </span>
  );
}
