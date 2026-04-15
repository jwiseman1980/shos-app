"use client";

import { useState, useMemo, useEffect } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_LABELS = {
  squarespace: "Squarespace",
  stripe: "Stripe",
  donorbox: "DonorBox",
  "d-variant": "D-Variant",
  check: "Check",
  cash: "Cash",
  paypal: "PayPal",
  venmo: "Venmo",
  zelle: "Zelle",
  event: "Event",
  other: "Other",
};

const SOURCE_COLORS = {
  squarespace: "var(--status-blue)",
  stripe: "var(--status-purple)",
  donorbox: "var(--gold)",
  "d-variant": "var(--status-orange)",
  check: "var(--text-dim)",
  cash: "var(--text-dim)",
  paypal: "var(--status-blue)",
  venmo: "var(--status-purple)",
  zelle: "var(--status-green)",
  event: "var(--gold)",
  other: "var(--text-dim)",
};

const SENDER_STORAGE_KEY = "shos_donations_sender";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(d) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtAmt(a) {
  return `$${(a || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function buildEmailBody(donorName, amount, donationDate, isDVariant) {
  const name = donorName || "Friend";
  const amtStr = fmtAmt(amount);
  const dateStr = fmt(donationDate);

  if (isDVariant) {
    return (
      `Dear ${name},\n\n` +
      `Thank you for choosing the D-variant memorial bracelet on ${dateStr}. ` +
      `Your decision to contribute an extra $10 to Steel Hearts Foundation means so much to us ` +
      `and to the families of our fallen heroes.\n\n` +
      `Your generosity directly helps us continue honoring our fallen service members through ` +
      `memorial bracelets and family remembrance programs.\n\n` +
      `We are deeply grateful for your support.\n\n` +
      `Warm regards,\nJoseph Wiseman\nFounder, Steel Hearts Foundation\nsteel-hearts.org`
    );
  }

  return (
    `Dear ${name},\n\n` +
    `Thank you so much for your generous donation of ${amtStr} to Steel Hearts Foundation on ${dateStr}. ` +
    `Your support directly helps us honor our fallen heroes and provide memorial bracelets ` +
    `to Gold Star families and veteran organizations at no cost.\n\n` +
    `Every dollar raised goes toward designing, producing, and donating memorial bracelets ` +
    `that keep the memory of our fallen service members alive.\n\n` +
    `We are deeply grateful for your support.\n\n` +
    `Warm regards,\nJoseph Wiseman\nFounder, Steel Hearts Foundation\nsteel-hearts.org`
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SourceBadge({ source }) {
  const label = SOURCE_LABELS[source] || source || "—";
  const color = SOURCE_COLORS[source] || "var(--text-dim)";
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 700,
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        borderRadius: 4,
        padding: "1px 6px",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <span style={{ color: "var(--card-border)", marginLeft: 4 }}>↕</span>;
  return (
    <span style={{ color: "var(--gold)", marginLeft: 4 }}>
      {sortDir === "asc" ? "↑" : "↓"}
    </span>
  );
}

function StatMini({ label, value, note, color }) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        padding: "12px 16px",
        background: "var(--bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--radius-md)",
        borderTop: `2px solid ${color || "var(--card-border)"}`,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "var(--text-bright)" }}>
        {value}
      </div>
      {note && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{note}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thank-You Modal
// ---------------------------------------------------------------------------

function ThankYouModal({ donation, volunteers, onClose, onSent }) {
  const isDVariant = donation.recordType === "d-variant";
  const [subject, setSubject] = useState(
    "Thank you for your donation to Steel Hearts Foundation"
  );
  const [body, setBody] = useState(() =>
    buildEmailBody(donation.donorName, donation.amount, donation.donationDate, isDVariant)
  );
  const [senderEmail, setSenderEmail] = useState(() => {
    try {
      return localStorage.getItem(SENDER_STORAGE_KEY) || "joseph.wiseman@steel-hearts.org";
    } catch {
      return "joseph.wiseman@steel-hearts.org";
    }
  });
  const [state, setState] = useState("idle"); // idle / sending / sent / error
  const [errorMsg, setErrorMsg] = useState("");

  const sender = volunteers?.find((v) => v.email === senderEmail);

  function handleSenderChange(e) {
    setSenderEmail(e.target.value);
    try { localStorage.setItem(SENDER_STORAGE_KEY, e.target.value); } catch {}
  }

  async function handleSend() {
    setState("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/finance/donations-thank-you", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          donationId: donation.recordType === "donation" ? donation.id : null,
          donorName: donation.donorName,
          donorEmail: donation.donorEmail,
          amount: donation.amount,
          donationDate: donation.donationDate,
          emailSubject: subject,
          emailBody: body,
          senderEmail,
          senderName: sender?.name || "Joseph Wiseman",
        }),
      });
      const data = await res.json();
      if (data.success || data.mock) {
        setState("sent");
        onSent(donation.id, data.marked);
      } else {
        setState("error");
        setErrorMsg(data.error || "Failed to create draft");
      }
    } catch (err) {
      setState("error");
      setErrorMsg(err.message);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(680px, 95vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
          zIndex: 1001,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-bright)" }}>
              Draft Thank-You Email
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              {donation.donorName || "Anonymous"} — {fmtAmt(donation.amount)}
              {isDVariant && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "var(--status-orange)", background: "rgba(251,146,60,0.15)", padding: "1px 6px", borderRadius: 4 }}>
                  D-VARIANT
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 18, cursor: "pointer", padding: 4 }}
          >
            ✕
          </button>
        </div>

        {/* Sent state */}
        {state === "sent" ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--status-green)", marginBottom: 8 }}>
              Draft saved to Gmail
            </div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 24 }}>
              Open your Gmail drafts in {senderEmail} to review and send.
              {donation.recordType === "donation" && " Donation marked as thanked."}
            </div>
            <button
              onClick={onClose}
              style={{
                padding: "8px 24px",
                background: "var(--status-green)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* From */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                From
              </label>
              <select
                value={senderEmail}
                onChange={handleSenderChange}
                style={{
                  width: "100%",
                  background: "var(--bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text)",
                  padding: "8px 10px",
                  fontSize: 13,
                }}
              >
                {(volunteers || [])
                  .filter((v) => v.email?.endsWith("@steel-hearts.org"))
                  .map((v) => (
                    <option key={v.email} value={v.email}>
                      {v.name} ({v.email})
                    </option>
                  ))}
              </select>
            </div>

            {/* To */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                To
              </label>
              <div
                style={{
                  padding: "8px 10px",
                  background: "var(--bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  color: "var(--text-bright)",
                }}
              >
                {donation.donorEmail}
              </div>
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text)",
                  padding: "8px 10px",
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                style={{
                  width: "100%",
                  background: "var(--bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text)",
                  padding: "10px 12px",
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontFamily: "Georgia, serif",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Error */}
            {state === "error" && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "10px 14px",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12,
                  color: "var(--status-red)",
                }}
              >
                {errorMsg || "Failed to create draft. Check Gmail config."}
              </div>
            )}

            {/* Info for D-variants */}
            {isDVariant && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "10px 14px",
                  background: "rgba(251,146,60,0.08)",
                  border: "1px solid rgba(251,146,60,0.2)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12,
                  color: "var(--text-dim)",
                }}
              >
                D-variant thank-you: This donor paid $10 extra for their memorial bracelet.
                This draft will not auto-mark the order as thanked — use the bracelet order
                system for tracking if needed.
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                disabled={state === "sending"}
                style={{
                  padding: "8px 20px",
                  background: "transparent",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-dim)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={state === "sending" || !donation.donorEmail}
                style={{
                  padding: "8px 20px",
                  background: "var(--gold)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: "#000",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: state === "sending" ? "wait" : "pointer",
                  opacity: state === "sending" ? 0.7 : 1,
                }}
              >
                {state === "sending" ? "Saving…" : "Save to Gmail Drafts"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DonationsDashboard({ donations, dVariants, year, volunteers }) {
  // Merge all donations into a unified list
  const [allDonations, setAllDonations] = useState(() => [
    ...donations,
    ...dVariants,
  ]);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [sourceFilter, setSourceFilter] = useState("all");
  const [thankedFilter, setThankedFilter] = useState("all");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  // ── Sort ─────────────────────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  // ── Modal ────────────────────────────────────────────────────────────────
  const [modal, setModal] = useState(null);

  // ── Computed stats ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = allDonations.reduce((s, d) => s + (d.amount || 0), 0);
    const count = allDonations.length;

    const now = new Date();
    const thisMonth = allDonations.filter((d) => {
      if (!d.donationDate) return false;
      const dt = new Date(d.donationDate + "T12:00:00");
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    });

    const uniqueEmails = new Set(allDonations.map((d) => d.donorEmail).filter(Boolean));

    const bySource = {};
    for (const d of allDonations) {
      const src = d.source || "other";
      if (!bySource[src]) bySource[src] = { count: 0, total: 0 };
      bySource[src].count++;
      bySource[src].total += d.amount || 0;
    }

    const needsThanks = allDonations.filter((d) => d.donorEmail && !d.thankYouSent).length;
    const thanked = allDonations.filter((d) => d.thankYouSent).length;

    return {
      total,
      count,
      thisMonthTotal: thisMonth.reduce((s, d) => s + d.amount, 0),
      thisMonthCount: thisMonth.length,
      uniqueDonors: uniqueEmails.size,
      avg: count > 0 ? total / count : 0,
      bySource,
      needsThanks,
      thanked,
    };
  }, [allDonations]);

  // ── All present sources ───────────────────────────────────────────────────
  const presentSources = useMemo(() => {
    const s = new Set(allDonations.map((d) => d.source || "other"));
    return Array.from(s).sort();
  }, [allDonations]);

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = allDonations;

    if (sourceFilter !== "all") {
      result = result.filter((d) => (d.source || "other") === sourceFilter);
    }
    if (thankedFilter === "yes") result = result.filter((d) => d.thankYouSent);
    if (thankedFilter === "no") result = result.filter((d) => !d.thankYouSent);
    if (amountMin !== "") result = result.filter((d) => d.amount >= Number(amountMin));
    if (amountMax !== "") result = result.filter((d) => d.amount <= Number(amountMax));
    if (dateFrom) result = result.filter((d) => d.donationDate >= dateFrom);
    if (dateTo) result = result.filter((d) => d.donationDate <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          (d.donorName || "").toLowerCase().includes(q) ||
          (d.donorEmail || "").toLowerCase().includes(q) ||
          (d.notes || "").toLowerCase().includes(q) ||
          (d.source || "").toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      let av, bv;
      if (sortBy === "date") {
        av = a.donationDate || "";
        bv = b.donationDate || "";
      } else if (sortBy === "amount") {
        av = a.amount || 0;
        bv = b.amount || 0;
      } else {
        av = (a.donorName || a.donorEmail || "").toLowerCase();
        bv = (b.donorName || b.donorEmail || "").toLowerCase();
      }
      if (sortDir === "asc") return av < bv ? -1 : av > bv ? 1 : 0;
      return av > bv ? -1 : av < bv ? 1 : 0;
    });
  }, [allDonations, sourceFilter, thankedFilter, amountMin, amountMax, dateFrom, dateTo, search, sortBy, sortDir]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSort(col) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  function openModal(donation) {
    setModal(donation);
  }

  function handleModalSent(donationId, wasMarked) {
    if (wasMarked && donationId) {
      setAllDonations((prev) =>
        prev.map((d) =>
          d.id === donationId
            ? { ...d, thankYouSent: true, thankYouDate: new Date().toISOString().slice(0, 10) }
            : d
        )
      );
    }
  }

  async function toggleThankYou(donation) {
    if (donation.recordType !== "donation") return;

    const newValue = !donation.thankYouSent;

    // Optimistic update
    setAllDonations((prev) =>
      prev.map((d) =>
        d.id === donation.id
          ? {
              ...d,
              thankYouSent: newValue,
              thankYouDate: newValue ? new Date().toISOString().slice(0, 10) : null,
            }
          : d
      )
    );

    try {
      await fetch("/api/finance/donations-thank-you", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donationId: donation.id, thankYouSent: newValue }),
      });
    } catch {
      // Revert on error
      setAllDonations((prev) =>
        prev.map((d) =>
          d.id === donation.id ? { ...d, thankYouSent: !newValue } : d
        )
      );
    }
  }

  function clearFilters() {
    setSourceFilter("all");
    setThankedFilter("all");
    setAmountMin("");
    setAmountMax("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }

  const hasActiveFilters =
    sourceFilter !== "all" ||
    thankedFilter !== "all" ||
    amountMin !== "" ||
    amountMax !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    search !== "";

  const filteredTotal = filtered.reduce((s, d) => s + (d.amount || 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Summary Stats ─────────────────────────────────────────────────── */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-block" style={{ borderTop: "2px solid var(--gold)" }}>
          <div className="stat-label">Total {year}</div>
          <div className="stat-value">{stats.total > 0 ? fmtAmt(stats.total) : "—"}</div>
          <div className="stat-note">{stats.count} donation{stats.count !== 1 ? "s" : ""}</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-green)" }}>
          <div className="stat-label">This Month</div>
          <div className="stat-value">{stats.thisMonthTotal > 0 ? fmtAmt(stats.thisMonthTotal) : "—"}</div>
          <div className="stat-note">{stats.thisMonthCount} donations</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-blue)" }}>
          <div className="stat-label">Unique Donors</div>
          <div className="stat-value">{stats.uniqueDonors || "—"}</div>
          <div className="stat-note">with email on file</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-purple)" }}>
          <div className="stat-label">Avg Donation</div>
          <div className="stat-value">{stats.avg > 0 ? fmtAmt(stats.avg) : "—"}</div>
          <div className="stat-note">per donation</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-red)" }}>
          <div className="stat-label">Need Thanks</div>
          <div className="stat-value">{stats.needsThanks > 0 ? stats.needsThanks : "✓"}</div>
          <div className="stat-note">
            {stats.thanked} thanked · {stats.needsThanks} pending
          </div>
        </div>
      </div>

      {/* ── Source Breakdown ──────────────────────────────────────────────── */}
      {Object.keys(stats.bySource).length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Source Breakdown — {year}</span>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "4px 0" }}>
            {Object.entries(stats.bySource)
              .sort(([, a], [, b]) => b.total - a.total)
              .map(([src, data]) => {
                const color = SOURCE_COLORS[src] || "var(--text-dim)";
                const label = SOURCE_LABELS[src] || src;
                const pct = stats.total > 0 ? Math.round((data.total / stats.total) * 100) : 0;
                return (
                  <button
                    key={src}
                    onClick={() => setSourceFilter(sourceFilter === src ? "all" : src)}
                    style={{
                      flex: "1 1 160px",
                      padding: "14px 16px",
                      background: sourceFilter === src
                        ? `color-mix(in srgb, ${color} 15%, var(--bg))`
                        : "var(--bg)",
                      border: `1px solid ${sourceFilter === src ? color : "var(--card-border)"}`,
                      borderLeft: `4px solid ${color}`,
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-bright)" }}>
                      {fmtAmt(data.total)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      {data.count} donation{data.count !== 1 ? "s" : ""} · {pct}% of total
                    </div>
                    {src === "d-variant" && (
                      <div style={{ fontSize: 10, color, marginTop: 4 }}>
                        extra $10 from D-variant bracelets
                      </div>
                    )}
                  </button>
                );
              })}
          </div>
          {/* Click-to-filter hint */}
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 10 }}>
            Click a source card to filter the table below.
          </div>
        </div>
      )}

      {/* ── Donations Table ───────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {hasActiveFilters
              ? `Filtered: ${filtered.length} donations · ${fmtAmt(filteredTotal)}`
              : `All ${year} Donations — ${allDonations.length} records`}
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                fontSize: 11,
                color: "var(--status-red)",
                background: "transparent",
                border: "1px solid var(--status-red)",
                borderRadius: "var(--radius-sm)",
                padding: "3px 10px",
                cursor: "pointer",
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── Filter Controls ───────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 16,
            padding: "12px 14px",
            background: "var(--bg)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--card-border)",
          }}
        >
          {/* Search */}
          <input
            type="text"
            placeholder="Search name, email, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: "2 1 180px",
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text)",
              padding: "6px 10px",
              fontSize: 12,
            }}
          />

          {/* Source filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{
              flex: "1 1 130px",
              background: "var(--card-bg)",
              border: `1px solid ${sourceFilter !== "all" ? "var(--gold)" : "var(--card-border)"}`,
              borderRadius: "var(--radius-sm)",
              color: "var(--text)",
              padding: "6px 8px",
              fontSize: 12,
            }}
          >
            <option value="all">All Sources</option>
            {presentSources.map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>
            ))}
          </select>

          {/* Thanked filter */}
          <select
            value={thankedFilter}
            onChange={(e) => setThankedFilter(e.target.value)}
            style={{
              flex: "1 1 120px",
              background: "var(--card-bg)",
              border: `1px solid ${thankedFilter !== "all" ? "var(--gold)" : "var(--card-border)"}`,
              borderRadius: "var(--radius-sm)",
              color: "var(--text)",
              padding: "6px 8px",
              fontSize: 12,
            }}
          >
            <option value="all">All Thank-You</option>
            <option value="no">Not Yet Thanked</option>
            <option value="yes">Already Thanked</option>
          </select>

          {/* Amount range */}
          <div style={{ display: "flex", gap: 4, alignItems: "center", flex: "1 1 160px" }}>
            <input
              type="number"
              placeholder="$ Min"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              style={{
                flex: 1,
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text)",
                padding: "6px 8px",
                fontSize: 12,
                minWidth: 60,
              }}
            />
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>–</span>
            <input
              type="number"
              placeholder="$ Max"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              style={{
                flex: 1,
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text)",
                padding: "6px 8px",
                fontSize: 12,
                minWidth: 60,
              }}
            />
          </div>

          {/* Date range */}
          <div style={{ display: "flex", gap: 4, alignItems: "center", flex: "1 1 220px" }}>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                flex: 1,
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text)",
                padding: "6px 8px",
                fontSize: 12,
                minWidth: 120,
              }}
            />
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                flex: 1,
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text)",
                padding: "6px 8px",
                fontSize: 12,
                minWidth: 120,
              }}
            />
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "40px 0",
              textAlign: "center",
              color: "var(--text-dim)",
              fontSize: 13,
            }}
          >
            {allDonations.length === 0
              ? "No donations recorded for 2026 yet. Add a manual entry below."
              : "No donations match the current filters."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th
                    style={{ textAlign: "left", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    onClick={() => handleSort("date")}
                  >
                    Date <SortIcon col="date" sortBy={sortBy} sortDir={sortDir} />
                  </th>
                  <th
                    style={{ textAlign: "left", cursor: "pointer", userSelect: "none" }}
                    onClick={() => handleSort("donor")}
                  >
                    Donor <SortIcon col="donor" sortBy={sortBy} sortDir={sortDir} />
                  </th>
                  <th
                    style={{ textAlign: "right", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    onClick={() => handleSort("amount")}
                  >
                    Amount <SortIcon col="amount" sortBy={sortBy} sortDir={sortDir} />
                  </th>
                  <th style={{ textAlign: "left" }}>Source</th>
                  <th style={{ textAlign: "left" }}>Notes</th>
                  <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Thank-You</th>
                  <th style={{ textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <DonationRow
                    key={d.id}
                    donation={d}
                    onToggle={toggleThankYou}
                    onDraftEmail={openModal}
                  />
                ))}
              </tbody>
              {filtered.length > 5 && (
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ fontWeight: 600, color: "var(--text-dim)", fontSize: 12, paddingTop: 10 }}>
                      {filtered.length} donations shown
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--status-green)", fontSize: 13, paddingTop: 10 }}>
                      {fmtAmt(filteredTotal)}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Stripe / DonorBox status notes */}
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            background: "rgba(59,130,246,0.06)",
            border: "1px solid rgba(59,130,246,0.15)",
            borderRadius: "var(--radius-sm)",
            fontSize: 11,
            color: "var(--text-dim)",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "var(--text)" }}>Data sources:</strong> This table shows all {year} donations
          recorded in Supabase (any source) plus D-variant order donations from Squarespace.
          {" "}Stripe webhook is not yet active — manually enter any Stripe donations below.
          {" "}DonorBox imports can be added via manual entry. Use source=DonorBox when entering.
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {modal && (
        <ThankYouModal
          donation={modal}
          volunteers={volunteers}
          onClose={() => setModal(null)}
          onSent={handleModalSent}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Donation Row
// ---------------------------------------------------------------------------

function DonationRow({ donation, onToggle, onDraftEmail }) {
  const name =
    donation.donorName ||
    (donation.donorEmail
      ? donation.donorEmail.split("@")[0].replace(/[._]/g, " ")
      : "Anonymous");

  const isDVariant = donation.recordType === "d-variant";
  const canToggle = donation.recordType === "donation" && donation.donorEmail;

  return (
    <tr>
      {/* Date */}
      <td style={{ whiteSpace: "nowrap", color: "var(--text-dim)" }}>
        {fmt(donation.donationDate)}
      </td>

      {/* Donor */}
      <td>
        <div style={{ fontWeight: 500, color: "var(--text-bright)", fontSize: 12 }}>
          {donation.donorEmail ? (
            <a
              href={`/donors/${encodeURIComponent(donation.donorEmail)}`}
              style={{
                color: "var(--text-bright)",
                textDecoration: "none",
                borderBottom: "1px dashed var(--card-border)",
              }}
            >
              {name}
            </a>
          ) : (
            name
          )}
          {isDVariant && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 9,
                fontWeight: 700,
                color: "var(--status-orange)",
                background: "rgba(251,146,60,0.12)",
                padding: "1px 5px",
                borderRadius: 4,
              }}
            >
              D-VAR
            </span>
          )}
        </div>
        {donation.donorEmail && (
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{donation.donorEmail}</div>
        )}
        {isDVariant && donation.heroName && (
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
            For: {donation.heroName}
          </div>
        )}
      </td>

      {/* Amount */}
      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--status-green)", whiteSpace: "nowrap" }}>
        {fmtAmt(donation.amount)}
      </td>

      {/* Source */}
      <td>
        <SourceBadge source={donation.source || "other"} />
        {donation.campaign && (
          <div style={{ fontSize: 10, color: "var(--status-blue)", marginTop: 3 }}>
            {donation.campaign}
          </div>
        )}
      </td>

      {/* Notes */}
      <td style={{ fontSize: 11, color: "var(--text-dim)", maxWidth: 180 }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {donation.notes || "—"}
        </div>
      </td>

      {/* Thank-You Status */}
      <td style={{ textAlign: "center" }}>
        {canToggle ? (
          <button
            onClick={() => onToggle(donation)}
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: donation.thankYouSent ? "var(--status-green)" : "var(--gold)",
              background: donation.thankYouSent
                ? "rgba(34,197,94,0.1)"
                : "rgba(212,175,55,0.1)",
              border: `1px solid ${donation.thankYouSent ? "var(--status-green)" : "var(--gold)"}`,
              borderRadius: "var(--radius-sm)",
              padding: "3px 8px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {donation.thankYouSent ? "✓ Thanked" : "Not Sent"}
          </button>
        ) : donation.thankYouSent ? (
          <span style={{ fontSize: 10, color: "var(--status-green)" }}>✓ Thanked</span>
        ) : (
          <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
            {isDVariant ? "—" : "No email"}
          </span>
        )}
        {donation.thankYouDate && (
          <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>
            {fmt(donation.thankYouDate)}
          </div>
        )}
      </td>

      {/* Action */}
      <td style={{ textAlign: "center" }}>
        {donation.donorEmail ? (
          <button
            onClick={() => onDraftEmail(donation)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--gold)",
              background: "transparent",
              border: "1px dashed var(--gold)",
              borderRadius: "var(--radius-sm)",
              padding: "4px 10px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Draft Thank You
          </button>
        ) : (
          <span style={{ fontSize: 10, color: "var(--text-dim)" }}>no email</span>
        )}
      </td>
    </tr>
  );
}
