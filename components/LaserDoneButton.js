"use client";

import { useState, useRef } from "react";

export default function LaserDoneButton({ itemId, heroName, toStatus = "ready_to_ship", label = "✓ Done", color = "var(--status-blue)" }) {
  const [state, setState] = useState("idle"); // idle | saving | done
  const rowRef = useRef(null);

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
        // Fade out the parent pipeline item row, then remove it from the DOM
        const row = rowRef.current?.closest("[data-pipeline-item]");
        if (row) {
          row.style.transition = "opacity 0.4s, max-height 0.4s";
          row.style.opacity = "0";
          row.style.maxHeight = "0";
          row.style.overflow = "hidden";
          row.style.padding = "0";
          row.style.margin = "0";
          row.style.borderBottom = "none";
          setTimeout(() => row.remove(), 500);
        }
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span ref={rowRef} style={{ fontSize: 10, color: "var(--status-green)", fontWeight: 600 }}>
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
