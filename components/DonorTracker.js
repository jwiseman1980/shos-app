"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

const SENDER_KEY = "shos_donor_sender";

function loadSender() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(SENDER_KEY));
  } catch {
    return null;
  }
}

function saveSender(sender) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SENDER_KEY, JSON.stringify(sender));
}

function formatDate(dateStr) {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAmount(amount) {
  return `$${(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function extractName(donation) {
  if (donation.donorName) return donation.donorName;
  if (donation.donorEmail) {
    const local = donation.donorEmail.split("@")[0];
    return local.replace(/[._]/g, " ");
  }
  return "Anonymous";
}

const SEGMENT_COLORS = {
  "Major ($500+)": { bg: "rgba(212, 175, 55, 0.15)", color: "var(--gold)", label: "MAJOR" },
  Recurring: { bg: "rgba(59, 130, 246, 0.15)", color: "var(--status-blue)", label: "RECURRING" },
  Regular: { bg: "rgba(34, 197, 94, 0.15)", color: "var(--status-green)", label: "REGULAR" },
  "First-Time": { bg: "rgba(156, 163, 175, 0.15)", color: "var(--text-dim)", label: "NEW" },
  Lapsed: { bg: "rgba(239, 68, 68, 0.15)", color: "var(--status-red)", label: "LAPSED" },
};

function DonorRow({
  donation,
  onToggleThankYou,
  onCreateDraft,
  draftState,
  saveState,
  repeatDonorEmails,
}) {
  const name = extractName(donation);
  const email = donation.donorEmail;
  const isRepeat = email && repeatDonorEmails.has(email);
  const state = draftState[donation.sfId];
  const saving = saveState[donation.sfId];
  const seg = donation.donorSegment ? SEGMENT_COLORS[donation.donorSegment] : null;

  // Day 30 impact update indicator
  const daysSinceDonation = donation.donationDate
    ? Math.floor((new Date() - new Date(donation.donationDate)) / (1000 * 60 * 60 * 24))
    : null;
  const impactDue =
    donation.thankYouSent &&
    !donation.impactUpdateSent &&
    daysSinceDonation >= 25 &&
    daysSinceDonation <= 45;

  return (
    <tr>
      {/* Date */}
      <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
        {formatDate(donation.donationDate)}
      </td>

      {/* Donor */}
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {email ? (
            <a
              href={`/donors/${encodeURIComponent(email)}`}
              style={{
                fontWeight: 500,
                color: "var(--text-bright)",
                fontSize: 13,
                textDecoration: "none",
                borderBottom: "1px dashed var(--card-border)",
              }}
            >
              {name}
            </a>
          ) : (
            <div style={{ fontWeight: 500, color: "var(--text-bright)", fontSize: 13 }}>
              {name}
            </div>
          )}
          {isRepeat && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                background: "rgba(139, 92, 246, 0.15)",
                color: "var(--status-purple)",
                padding: "1px 5px",
                borderRadius: 8,
              }}
            >
              REPEAT
            </span>
          )}
          {seg && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                background: seg.bg,
                color: seg.color,
                padding: "1px 5px",
                borderRadius: 8,
              }}
            >
              {seg.label}
            </span>
          )}
          {impactDue && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                background: "rgba(251, 146, 60, 0.15)",
                color: "var(--status-orange)",
                padding: "1px 5px",
                borderRadius: 8,
              }}
            >
              IMPACT DUE
            </span>
          )}
        </div>
        {email && (
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{email}</div>
        )}
      </td>

      {/* Amount */}
      <td
        style={{
          fontWeight: 600,
          color: "var(--status-green)",
          whiteSpace: "nowrap",
        }}
      >
        {formatAmount(donation.amount)}
      </td>

      {/* Source / Campaign */}
      <td style={{ fontSize: 11, color: "var(--text-dim)" }}>
        <div>{donation.source || "--"}</div>
        {donation.campaign && (
          <div style={{ fontSize: 10, color: "var(--status-blue)" }}>
            {donation.campaign}
          </div>
        )}
      </td>

      {/* Thank You Status */}
      <td>
        <button
          onClick={() => onToggleThankYou(donation)}
          disabled={saving === "saving"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: donation.thankYouSent
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(212, 175, 55, 0.1)",
            color: donation.thankYouSent ? "var(--status-green)" : "var(--gold)",
            border: `1px solid ${
              donation.thankYouSent ? "var(--status-green)" : "var(--gold)"
            }`,
            borderRadius: "var(--radius-sm)",
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            cursor: saving === "saving" ? "wait" : "pointer",
            opacity: saving === "saving" ? 0.6 : 1,
            transition: "all 0.2s ease",
          }}
        >
          {saving === "saving"
            ? "saving..."
            : saving === "saved"
            ? "saved"
            : saving === "error"
            ? "error"
            : donation.thankYouSent
            ? "Thanked"
            : "Send Thanks"}
        </button>
        {donation.thankYouSent && donation.thankYouBy && (
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
            by {donation.thankYouBy}
          </div>
        )}
      </td>

      {/* Email Action */}
      <td>
        {email ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => onCreateDraft(donation, isRepeat)}
              disabled={state === "creating"}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color:
                  state === "created"
                    ? "var(--status-green)"
                    : state === "error"
                    ? "var(--status-red)"
                    : "var(--gold)",
                background: "transparent",
                border: `1px dashed ${
                  state === "created"
                    ? "var(--status-green)"
                    : state === "error"
                    ? "var(--status-red)"
                    : "var(--gold)"
                }`,
                borderRadius: "var(--radius-sm)",
                padding: "3px 8px",
                cursor: state === "creating" ? "wait" : "pointer",
                opacity: state === "creating" ? 0.6 : 1,
              }}
            >
              {state === "creating"
                ? "creating..."
                : state === "created"
                ? "draft created"
                : state === "error"
                ? "failed \u2014 retry"
                : "create draft"}
            </button>
            <a
              href={`mailto:${email}?subject=Thank%20you%20for%20your%20donation%20to%20Steel%20Hearts&body=Dear%20${encodeURIComponent(
                name
              )}%2C%0A%0AThank%20you%20so%20much%20for%20your%20generous%20donation%20of%20${encodeURIComponent(
                formatAmount(donation.amount)
              )}%20to%20Steel%20Hearts.%0A%0AWarm%20regards%2C%0ASteel%20Hearts%20Team`}
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                textDecoration: "none",
                borderBottom: "1px dashed var(--card-border)",
              }}
              title="Fallback: open in mail client"
            >
              mailto
            </a>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>no email</span>
        )}
      </td>
    </tr>
  );
}

export default function DonorTracker({ donations, stats, volunteers }) {
  const [donationData, setDonationData] = useState(donations);
  const [filter, setFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [draftState, setDraftState] = useState({});
  const [saveState, setSaveState] = useState({});
  const [sender, setSender] = useState(null);
  const [showSenderPicker, setShowSenderPicker] = useState(false);

  useEffect(() => {
    setSender(loadSender());
  }, []);

  // Compute repeat donor emails
  const repeatDonorEmails = useMemo(() => {
    const counts = {};
    for (const d of donationData) {
      if (d.donorEmail) {
        counts[d.donorEmail] = (counts[d.donorEmail] || 0) + 1;
      }
    }
    return new Set(
      Object.entries(counts)
        .filter(([, c]) => c > 1)
        .map(([e]) => e)
    );
  }, [donationData]);

  // Save thank-you status to Salesforce
  const toggleThankYou = useCallback(
    async (donation) => {
      const newValue = !donation.thankYouSent;
      const senderName = sender?.name || "Unknown";

      // Optimistic update
      setDonationData((prev) =>
        prev.map((d) =>
          d.sfId === donation.sfId
            ? {
                ...d,
                thankYouSent: newValue,
                thankYouBy: newValue ? senderName : null,
                thankYouDate: newValue
                  ? new Date().toISOString().split("T")[0]
                  : null,
              }
            : d
        )
      );

      setSaveState((prev) => ({ ...prev, [donation.sfId]: "saving" }));

      try {
        const res = await fetch("/api/donors/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sfId: donation.sfId,
            thankYouSent: newValue,
            thankYouBy: newValue ? senderName : null,
          }),
        });
        const data = await res.json();
        if (data.success || data.mock) {
          setSaveState((prev) => ({ ...prev, [donation.sfId]: "saved" }));
        } else {
          setSaveState((prev) => ({ ...prev, [donation.sfId]: "error" }));
          // Revert optimistic update
          setDonationData((prev) =>
            prev.map((d) =>
              d.sfId === donation.sfId
                ? { ...d, thankYouSent: !newValue, thankYouBy: donation.thankYouBy }
                : d
            )
          );
        }
      } catch {
        setSaveState((prev) => ({ ...prev, [donation.sfId]: "error" }));
        setDonationData((prev) =>
          prev.map((d) =>
            d.sfId === donation.sfId
              ? { ...d, thankYouSent: !newValue, thankYouBy: donation.thankYouBy }
              : d
          )
        );
      }

      setTimeout(() => {
        setSaveState((prev) => {
          const next = { ...prev };
          delete next[donation.sfId];
          return next;
        });
      }, 2000);
    },
    [sender]
  );

  const handleSenderSelect = (vol) => {
    const s = { email: vol.email, name: vol.name };
    setSender(s);
    saveSender(s);
    setShowSenderPicker(false);
  };

  const createDraft = useCallback(
    async (donation, isRepeat) => {
      if (!sender) {
        setShowSenderPicker(true);
        return;
      }

      setDraftState((prev) => ({ ...prev, [donation.sfId]: "creating" }));

      try {
        const res = await fetch("/api/donors/draft-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            donorName: extractName(donation),
            donorEmail: donation.donorEmail,
            amount: donation.amount,
            donationDate: donation.donationDate,
            isRepeatDonor: isRepeat,
            senderEmail: sender.email,
            senderName: sender.name,
            sfId: donation.sfId,
          }),
        });

        const data = await res.json();

        if (data.success) {
          setDraftState((prev) => ({ ...prev, [donation.sfId]: "created" }));
          setTimeout(() => {
            setDraftState((prev) => {
              const next = { ...prev };
              if (next[donation.sfId] === "created") delete next[donation.sfId];
              return next;
            });
          }, 5000);
        } else {
          setDraftState((prev) => ({ ...prev, [donation.sfId]: "error" }));
          if (data.mock) {
            alert(
              "Gmail service account not configured yet. Use the 'mailto' fallback for now."
            );
          }
        }
      } catch {
        setDraftState((prev) => ({ ...prev, [donation.sfId]: "error" }));
      }
    },
    [sender]
  );

  // Filter and sort donations
  const filtered = useMemo(() => {
    let result = [...donationData];

    if (timeRange !== "all") {
      const now = new Date();
      let cutoff;
      if (timeRange === "this_month") {
        cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (timeRange === "last_30") {
        cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
      } else if (timeRange === "last_90") {
        cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
      }
      if (cutoff) {
        result = result.filter(
          (d) => d.donationDate && new Date(d.donationDate) >= cutoff
        );
      }
    }

    if (filter === "needs_thanks") {
      result = result.filter((d) => d.donorEmail && !d.thankYouSent);
    } else if (filter === "thanked") {
      result = result.filter((d) => d.thankYouSent);
    } else if (filter === "no_email") {
      result = result.filter((d) => !d.donorEmail);
    } else if (filter === "impact_due") {
      const now = new Date();
      result = result.filter((d) => {
        if (!d.thankYouSent || d.impactUpdateSent || !d.donorEmail) return false;
        if (!d.donationDate) return false;
        const days = Math.floor(
          (now - new Date(d.donationDate)) / (1000 * 60 * 60 * 24)
        );
        return days >= 25 && days <= 45;
      });
    }

    if (segmentFilter !== "all") {
      result = result.filter((d) => d.donorSegment === segmentFilter);
    }

    return result;
  }, [donationData, filter, timeRange, segmentFilter]);

  const totalDonors = donationData.filter((d) => d.donorEmail).length;
  const thankedCount = donationData.filter((d) => d.thankYouSent).length;
  const needsThankCount = donationData.filter(
    (d) => d.donorEmail && !d.thankYouSent
  ).length;
  const noEmailCount = donationData.filter((d) => !d.donorEmail).length;
  const impactDueCount = donationData.filter((d) => {
    if (!d.thankYouSent || d.impactUpdateSent || !d.donorEmail || !d.donationDate)
      return false;
    const days = Math.floor(
      (new Date() - new Date(d.donationDate)) / (1000 * 60 * 60 * 24)
    );
    return days >= 25 && days <= 45;
  }).length;

  // Segment counts for filter badges
  const segmentCounts = useMemo(() => {
    const counts = {};
    for (const d of donationData) {
      if (d.donorSegment) {
        counts[d.donorSegment] = (counts[d.donorSegment] || 0) + 1;
      }
    }
    return counts;
  }, [donationData]);

  const hasSegments = Object.keys(segmentCounts).length > 0;

  return (
    <div>
      {/* Sender Identity Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          padding: "10px 14px",
          background: sender
            ? "rgba(34, 197, 94, 0.06)"
            : "rgba(212, 175, 55, 0.08)",
          border: `1px solid ${sender ? "var(--status-green)" : "var(--gold)"}`,
          borderRadius: "var(--radius-md)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Sending as:
        </span>
        {sender ? (
          <>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-bright)",
              }}
            >
              {sender.name}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              ({sender.email})
            </span>
            <button
              onClick={() => setShowSenderPicker(true)}
              style={{
                fontSize: 10,
                color: "var(--gold)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              change
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowSenderPicker(true)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--gold)",
              background: "transparent",
              border: "1px solid var(--gold)",
              borderRadius: "var(--radius-sm)",
              padding: "4px 12px",
              cursor: "pointer",
            }}
          >
            Select your @steel-hearts.org identity
          </button>
        )}
      </div>

      {/* Sender Picker Modal */}
      {showSenderPicker && (
        <div
          style={{
            marginBottom: 16,
            padding: "14px",
            background: "var(--card-bg)",
            border: "1px solid var(--gold)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-bright)",
              marginBottom: 10,
            }}
          >
            Who are you? Select your @steel-hearts.org account:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {volunteers
              .filter((v) => v.email && v.email.endsWith("@steel-hearts.org"))
              .map((v) => (
                <button
                  key={v.email}
                  onClick={() => handleSenderSelect(v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    background:
                      sender?.email === v.email
                        ? "rgba(212, 175, 55, 0.15)"
                        : "var(--bg)",
                    border: `1px solid ${
                      sender?.email === v.email
                        ? "var(--gold)"
                        : "var(--card-border)"
                    }`,
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: v.color || "var(--text-dim)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {v.initials}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--text-bright)",
                      }}
                    >
                      {v.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                      {v.email}
                    </div>
                  </div>
                </button>
              ))}
          </div>
          <button
            onClick={() => setShowSenderPicker(false)}
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "var(--text-dim)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            cancel
          </button>
        </div>
      )}

      {/* Engagement Stats */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {[
          { value: needsThankCount, label: "Need Thank You", color: "var(--gold)" },
          { value: thankedCount, label: "Thanked", color: "var(--status-green)" },
          {
            value:
              totalDonors > 0
                ? `${Math.round((thankedCount / totalDonors) * 100)}%`
                : "--",
            label: "Completion Rate",
            color: totalDonors > 0 ? "var(--status-blue)" : "var(--text-dim)",
          },
          {
            value: impactDueCount,
            label: "Impact Updates Due",
            color: impactDueCount > 0 ? "var(--status-orange)" : "var(--text-dim)",
          },
          {
            value: noEmailCount,
            label: "No Email on File",
            color: noEmailCount > 0 ? "var(--status-orange)" : "var(--text-dim)",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              flex: "1 1 120px",
              padding: "12px 16px",
              background: "var(--bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Status:
          </span>
          {[
            { key: "all", label: "All" },
            { key: "needs_thanks", label: "Needs Thanks", badge: needsThankCount },
            { key: "thanked", label: "Thanked" },
            { key: "impact_due", label: "Impact Due", badge: impactDueCount },
            { key: "no_email", label: "No Email" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={filter === f.key ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "3px 8px", fontSize: 11 }}
            >
              {f.label}
              {f.badge > 0 && (
                <span
                  style={{
                    marginLeft: 4,
                    background: "var(--gold)",
                    color: "#000",
                    borderRadius: 8,
                    padding: "1px 5px",
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {f.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Time:
          </span>
          {[
            { key: "all", label: "All Time" },
            { key: "this_month", label: "This Month" },
            { key: "last_30", label: "Last 30 Days" },
            { key: "last_90", label: "Last 90 Days" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTimeRange(t.key)}
              className={timeRange === t.key ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "3px 8px", fontSize: 11 }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Segment filter (only show if segments exist) */}
        {hasSegments && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Segment:
            </span>
            <button
              onClick={() => setSegmentFilter("all")}
              className={
                segmentFilter === "all" ? "btn btn-primary" : "btn btn-ghost"
              }
              style={{ padding: "3px 8px", fontSize: 11 }}
            >
              All
            </button>
            {Object.entries(segmentCounts).map(([seg, count]) => (
              <button
                key={seg}
                onClick={() => setSegmentFilter(seg)}
                className={
                  segmentFilter === seg ? "btn btn-primary" : "btn btn-ghost"
                }
                style={{ padding: "3px 8px", fontSize: 11 }}
              >
                {SEGMENT_COLORS[seg]?.label || seg}
                <span
                  style={{
                    marginLeft: 3,
                    fontSize: 9,
                    color: "var(--text-dim)",
                  }}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
        Showing {filtered.length} of {donationData.length} donations
      </div>

      {/* Donor Table */}
      {filtered.length === 0 ? (
        <p
          style={{
            color: "var(--text-dim)",
            fontSize: 13,
            padding: "20px 0",
            textAlign: "center",
          }}
        >
          {donationData.length === 0
            ? "No donation data available. Connect Salesforce (SF_LIVE=true) to see donations."
            : "No donations match the current filters."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Donor</th>
                <th>Amount</th>
                <th>Source</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((donation) => (
                <DonorRow
                  key={donation.sfId}
                  donation={donation}
                  onToggleThankYou={toggleThankYou}
                  onCreateDraft={createDraft}
                  draftState={draftState}
                  saveState={saveState}
                  repeatDonorEmails={repeatDonorEmails}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer note */}
      <div
        style={{
          marginTop: 16,
          padding: "10px 14px",
          background: "var(--bg)",
          border: "1px solid var(--card-border)",
          borderRadius: "var(--radius-sm)",
          fontSize: 11,
          color: "var(--text-dim)",
          lineHeight: 1.5,
        }}
      >
        Thank-you status is saved to Salesforce and visible to all team members.
        &quot;Create draft&quot; places a ready-to-send email in your @steel-hearts.org
        Gmail Drafts folder. Review, personalize if needed, then hit Send in Gmail.
      </div>
    </div>
  );
}
