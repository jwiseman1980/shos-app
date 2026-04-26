"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ACADEMIES = ["None", "USMA", "USNA", "USAFA"];
const BRANCHES = ["USA", "USN", "USMC", "USAF", "USSF", "FIRE", "Other"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function NewHeroModal({ onClose }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    last_name: "",
    academy: "None",
    branch: "USA",
    grad_year: "",
    memorial_month: "",
    memorial_day: "",
    family_contact_name: "",
    family_contact_email: "",
    design_notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [researchInput, setResearchInput] = useState("");
  const [researchContext, setResearchContext] = useState("");
  const [researching, setResearching] = useState(false);
  const [researchNote, setResearchNote] = useState(null);

  const academySelected = form.academy && form.academy !== "None";

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function runResearch() {
    if (!researchInput.trim()) {
      setResearchNote({ type: "error", text: "Enter a name first" });
      return;
    }
    setResearching(true);
    setResearchNote(null);
    setError(null);
    try {
      const res = await fetch("/api/heroes/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: researchInput,
          context: researchContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      if (data.error) {
        setResearchNote({
          type: "warn",
          text: data.suggestions
            ? `${data.error}. ${data.suggestions}`
            : data.error,
        });
        return;
      }

      const r = data.research || {};
      const branchOk = ["USA", "USN", "USMC", "USAF", "USSF", "USCG", "FIRE", "Other"];
      const academyOk = ["USMA", "USNA", "USAFA", "USCGA", "USMMA", "None"];

      setForm((f) => ({
        ...f,
        name: r.name || f.name || researchInput,
        last_name: r.last_name || f.last_name,
        academy: academyOk.includes(r.academy) ? r.academy : f.academy,
        branch: branchOk.includes(r.branch) ? r.branch : f.branch,
        grad_year: r.grad_year ? String(r.grad_year) : f.grad_year,
        memorial_month: r.memorial_month ? String(r.memorial_month) : f.memorial_month,
        memorial_day: r.memorial_day ? String(r.memorial_day) : f.memorial_day,
        design_notes: r.design_notes || f.design_notes,
      }));

      const summaryParts = [];
      if (r.unit) summaryParts.push(r.unit);
      if (r.incident) summaryParts.push(r.incident);
      if (r.location) summaryParts.push(r.location);
      setResearchNote({
        type: "ok",
        text: summaryParts.length
          ? `Found: ${summaryParts.join(" • ")}. Review fields below.`
          : "Research returned partial info. Review fields below.",
      });
    } catch (err) {
      setResearchNote({ type: "error", text: err.message });
    } finally {
      setResearching(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError("Hero name is required");
    if (!form.last_name.trim()) return setError("Last name is required for SKU");

    setSubmitting(true);
    try {
      const res = await fetch("/api/heroes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Create failed");
      router.push(`/heroes/${data.hero.id}`);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div>
            <div style={title}>New Hero</div>
            <div style={subtitle}>Adds the record and DMs Ryan a design request.</div>
          </div>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={submit} style={formStyle}>
          <div style={researchBox}>
            <div style={researchLabel}>AI Research (optional)</div>
            <input
              type="text"
              value={researchInput}
              onChange={(e) => setResearchInput(e.target.value)}
              placeholder="Hero name"
              style={input}
              disabled={researching}
            />
            <textarea
              rows={2}
              value={researchContext}
              onChange={(e) => setResearchContext(e.target.value)}
              placeholder="Context: branch, year, incident, or paste an email snippet"
              style={{ ...input, resize: "vertical", minHeight: 48, fontFamily: "inherit", marginTop: 6 }}
              disabled={researching}
            />
            <button
              type="button"
              onClick={runResearch}
              disabled={researching}
              style={{ ...btnGhost, marginTop: 8, width: "100%", justifyContent: "center" }}
            >
              {researching ? (
                <>
                  <span style={spinner} />
                  Researching...
                </>
              ) : (
                "Research"
              )}
            </button>
            {researchNote && (
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  borderRadius: 4,
                  fontSize: 12,
                  background:
                    researchNote.type === "ok"
                      ? "rgba(39, 174, 96, 0.1)"
                      : researchNote.type === "warn"
                      ? "rgba(243, 156, 18, 0.1)"
                      : "var(--status-red-bg)",
                  color:
                    researchNote.type === "ok"
                      ? "var(--status-green)"
                      : researchNote.type === "warn"
                      ? "var(--status-orange)"
                      : "var(--status-red)",
                }}
              >
                {researchNote.text}
              </div>
            )}
          </div>

          <div style={divider} />

          <Field label="Hero name *">
            <input
              type="text"
              required
              autoFocus
              placeholder="CPT John Smith"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              style={input}
            />
          </Field>

          <Field label="Last name (for SKU) *">
            <input
              type="text"
              required
              placeholder="Smith"
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
              style={input}
            />
          </Field>

          <div style={row2}>
            <Field label="Academy">
              <select
                value={form.academy}
                onChange={(e) => set("academy", e.target.value)}
                style={input}
              >
                {ACADEMIES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Branch">
              <select
                value={form.branch}
                onChange={(e) => set("branch", e.target.value)}
                style={input}
              >
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          </div>

          {academySelected && (
            <Field label="Grad year">
              <input
                type="number"
                min="1950"
                max="2050"
                placeholder="2008"
                value={form.grad_year}
                onChange={(e) => set("grad_year", e.target.value)}
                style={input}
              />
            </Field>
          )}

          <div style={row2}>
            <Field label="Memorial month">
              <select
                value={form.memorial_month}
                onChange={(e) => set("memorial_month", e.target.value)}
                style={input}
              >
                <option value="">—</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Memorial day">
              <input
                type="number"
                min="1"
                max="31"
                value={form.memorial_day}
                onChange={(e) => set("memorial_day", e.target.value)}
                style={input}
              />
            </Field>
          </div>

          <Field label="Family contact name">
            <input
              type="text"
              placeholder="Optional"
              value={form.family_contact_name}
              onChange={(e) => set("family_contact_name", e.target.value)}
              style={input}
            />
          </Field>

          <Field label="Family contact email">
            <input
              type="email"
              placeholder="Optional"
              value={form.family_contact_email}
              onChange={(e) => set("family_contact_email", e.target.value)}
              style={input}
            />
          </Field>

          <Field label="Design notes for Ryan">
            <textarea
              rows={3}
              placeholder="Optional"
              value={form.design_notes}
              onChange={(e) => set("design_notes", e.target.value)}
              style={{ ...input, resize: "vertical", minHeight: 64, fontFamily: "inherit" }}
            />
          </Field>

          <SkuPreview form={form} />

          {error && <div style={errorBox}>{error}</div>}

          <div style={actions}>
            <button type="button" onClick={onClose} style={btnGhost}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={btnPrimary}>
              {submitting ? "Creating..." : "Create + Notify Ryan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SkuPreview({ form }) {
  const ln = (form.last_name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  let sku = "—";
  if (ln) {
    if (form.academy && form.academy !== "None") {
      const yr = String(form.grad_year || "").trim();
      const yrSuffix = /^\d{4}$/.test(yr) ? yr.slice(-2) : "";
      sku = `${form.academy}${yrSuffix}-${ln}`;
    } else if (form.branch) {
      sku = `${form.branch}-${ln}`;
    }
  }
  return (
    <div style={skuPreview}>
      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>SKU preview:</span>
      <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--gold)" }}>
        {sku}
      </code>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={fieldLabel}>
      <span style={fieldLabelText}>{label}</span>
      {children}
    </label>
  );
}

const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  zIndex: 9000,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "5vh 16px",
  overflowY: "auto",
};

const panel = {
  width: "100%",
  maxWidth: 480,
  background: "var(--card-bg)",
  border: "1px solid var(--border-strong)",
  borderRadius: 12,
  boxShadow: "var(--shadow-lg)",
  overflow: "hidden",
};

const header = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: "1px solid var(--card-border)",
};

const title = {
  fontSize: 16,
  fontWeight: 700,
  color: "var(--text-bright)",
  marginBottom: 2,
};

const subtitle = {
  fontSize: 12,
  color: "var(--text-dim)",
};

const closeBtn = {
  background: "transparent",
  border: "none",
  color: "var(--text-dim)",
  fontSize: 24,
  lineHeight: 1,
  cursor: "pointer",
  padding: "0 4px",
};

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "16px 20px 20px",
};

const row2 = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const fieldLabel = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const fieldLabelText = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-dim)",
};

const input = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--card-border)",
  background: "var(--bg)",
  color: "var(--text-bright)",
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const skuPreview = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  background: "var(--bg-3)",
  borderRadius: 6,
  marginTop: 4,
};

const errorBox = {
  padding: "8px 12px",
  background: "var(--status-red-bg)",
  border: "1px solid var(--status-red)",
  borderRadius: 6,
  color: "var(--status-red)",
  fontSize: 12,
};

const actions = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  marginTop: 4,
};

const btnPrimary = {
  padding: "9px 16px",
  background: "var(--gold)",
  color: "#0a0a0e",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost = {
  padding: "9px 14px",
  background: "transparent",
  color: "var(--text)",
  border: "1px solid var(--card-border)",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const researchBox = {
  padding: 12,
  background: "rgba(196, 162, 55, 0.04)",
  border: "1px solid rgba(196, 162, 55, 0.2)",
  borderRadius: 8,
};

const researchLabel = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--gold)",
  marginBottom: 8,
};

const divider = {
  height: 1,
  background: "var(--card-border)",
  margin: "4px 0",
};

const spinner = {
  display: "inline-block",
  width: 12,
  height: 12,
  border: "1.5px solid rgba(255, 255, 255, 0.2)",
  borderTopColor: "var(--text-bright)",
  borderRadius: "50%",
  animation: "tool-spin 0.8s linear infinite",
};
