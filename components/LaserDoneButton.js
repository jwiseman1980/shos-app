"use client";

import { useState } from "react";

export default function LaserDoneButton({ itemId, heroName, toStatus = "ready_to_ship", label = "✓ Done", color = "var(--status-blue)" }) {
  const [state, setState] = useState("idle"); // idle | saving | done

  async function handleDone(e) {
    e.preventDefault();
    e.stopPropagation();
    setState("saving");
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, heroName, status: toStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setState("done");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span style={{ fontSize: 10, color: "var(--status-green)", fontWeight: 600 }}>
        {"\u2713"} Done
      </span>
    );
  }

  return (
    <button
      onClick={handleDone}
      disabled={state === "saving"}
      style={{
        fontSize: 10, fontWeight: 600, color,
        background: "none", border: `1px solid ${color}`,
        borderRadius: 4, padding: "2px 6px", cursor: "pointer",
        opacity: state === "saving" ? 0.5 : 1, whiteSpace: "nowrap",
      }}
    >
      {state === "saving" ? "..." : label}
    </button>
  );
}
