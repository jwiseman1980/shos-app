"use client";

import { useState } from "react";

const DOMAINS = ["app", "website", "ops", "finance", "comms", "family", "partnership", "governance", "other"];

export default function IdeasForm() {
  const [idea, setIdea] = useState("");
  const [domain, setDomain] = useState("");
  const [details, setDetails] = useState("");
  const [energy, setEnergy] = useState("warm");
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!idea.trim()) return;
    setSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: idea.trim(),
          domain,
          details: details.trim(),
          energy,
          source: "ideas-page",
          submittedBy: "manual",
        }),
      });

      if (res.ok) {
        setStatus("success");
        setIdea("");
        setDetails("");
        setDomain("");
        setEnergy("warm");
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 11, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
          Idea *
        </label>
        <input
          type="text"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="One-line summary of the idea..."
          required
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text)",
            fontSize: 13,
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
            Domain
          </label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text)",
              fontSize: 13,
            }}
          >
            <option value="">Select...</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
            Energy
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {["hot", "warm", "cool"].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEnergy(e)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  background: energy === e ? (e === "hot" ? "#e74c3c" : e === "warm" ? "#c4a237" : "var(--bg-2)") : "var(--bg)",
                  border: `1px solid ${energy === e ? "transparent" : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)",
                  color: energy === e ? "#fff" : "var(--text-dim)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: energy === e ? 600 : 400,
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 11, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
          Details (optional)
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Any additional context, requirements, or thoughts..."
          rows={3}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text)",
            fontSize: 13,
            resize: "vertical",
          }}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !idea.trim()}
        style={{
          padding: "10px 0",
          background: status === "success" ? "#27ae60" : "#c4a237",
          border: "none",
          borderRadius: "var(--radius-sm)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: submitting ? "wait" : "pointer",
          transition: "background 0.2s",
        }}
      >
        {submitting ? "Submitting..." : status === "success" ? "Submitted!" : "Submit to Architect Queue"}
      </button>

      {status === "error" && (
        <p style={{ fontSize: 12, color: "#e74c3c", margin: 0 }}>Failed to submit. Try again.</p>
      )}
    </form>
  );
}
