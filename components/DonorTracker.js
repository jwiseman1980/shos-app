"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

const THANK_YOU_KEY = "shos_donor_thankyou";
const SENDER_KEY = "shos_donor_sender";

function loadThankYouMap() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(THANK_YOU_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveThankYouMap(map) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THANK_YOU_KEY, JSON.stringify(map));
}

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

function DonorRow({ donation, isThankYouSent, onToggleThankYou, onCreateDraft, draftState, repeatDonorEmails }) {
  const name = extractName(donation);
  const email = donation.donorEmail;
  const isRepeat = email && repeatDonorEmails.has(email);
  const state = draftState[donation.sfId];

  return (
    <tr>
      {/* Date */}
      <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
        {formatDate(donation.donationDate)}
      </td>

      {/* Donor */}
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontWeight: 500, color: "var(--text-bright)", fontSize: 13 }}>
            {name}
          </div>
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

      {/* Source */}
      <td style={{ fontSize: 11, color: "var(--text-dim)" }}>
        {donation.source || "--"}
      </td>

      {/* Thank You Status */}
      <td>
        <button
          onClick={() => onToggleThankYou(donation.sfId)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: isThankYouSent
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(212, 175, 55, 0.1)",
            color: isThankYouSent ? "var(--status-green)" : "var(--gold)",
            border: `1px solid ${
              isThankYouSent ? "var(--status-green)" : "var(--gold)"
            }`,
            borderRadius: "var(--radius-sm)",
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          {isThankYouSent ? "Thanked" : "Send Thanks"}
        </button>
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
                color: state === "created" ? "var(--status-green)" : state === "error" ? "var(--status-red)" : "var(--gold)",
                background: "transparent",
                border: `1px dashed ${state === "created" ? "var(--status-green)" : state === "error" ? "var(--status-red)" : "var(--gold)"}`,
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
                ? "failed — retry"
                : "create draft"}
            </button>
            <a
              href={`mailto:${email}?subject=Thank%20you%20for%20your%20donation%20to%20Steel%20Hearts&body=Dear%20${encodeURIComponent(
                name
              )}%2C%0A%0AThank%20you%20so%20much%20for%20your%20generous%20donation%20of%20${encodeURIComponent(
                formatAmount(donation.amount)
              )}%20to%20Steel%20Hearts.%20Your%20support%20helps%20us%20honor%20our%20fallen%20heroes%20and%20support%20their%20families.%0A%0AWarm%20regards%2C%0ASteel%20Hearts%20Team`}
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
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
            no email
          </span>
        )}
      </td>
    </tr>
  );
}

export default function DonorTracker({ donations, stats, volunteers }) {
  const [thankYouMap, setThankYouMap] = useState({});
  const [filter, setFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [draftState, setDraftState] = useState({}); // sfId -> "creating" | "created" | "error"
  const [sender, setSender] = useState(null);
  const [showSenderPicker, setShowSenderPicker] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    setThankYouMap(loadThankYouMap());
    setSender(loadSender());
  }, []);

  // Compute repeat donor emails
  const repeatDonorEmails = useMemo(() => {
    const counts = {};
    for (const d of donations) {
      if (d.donorEmail) {
        counts[d.donorEmail] = (counts[d.donorEmail] || 0) + 1;
      }
    }
    return new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([e]) => e));
  }, [donations]);

  const toggleThankYou = (sfId) => {
    setThankYouMap((prev) => {
      const updated = { ...prev };
      if (updated[sfId]) {
        delete updated[sfId];
      } else {
        updated[sfId] = new Date().toISOString();
      }
      saveThankYouMap(updated);
      return updated;
    });
  };

  const handleSenderSelect = (vol) => {
    const s = {
      email: vol.email,
      name: vol.name,
    };
    setSender(s);
    saveSender(s);
    setShowSenderPicker(false);
  };

  const createDraft = useCallback(async (donation, isRepeat) => {
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
        // Auto-clear after 5 seconds
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
          alert("Gmail service account not configured yet. Use the 'mailto' fallback for now.");
        }
      }
    } catch {
      setDraftState((prev) => ({ ...prev, [donation.sfId]: "error" }));
    }
  }, [sender]);

  // Filter and sort donations
  const filtered = useMemo(() => {
    let result = [...donations];

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
      result = result.filter((d) => d.donorEmail && !thankYouMap[d.sfId]);
    } else if (filter === "thanked") {
      result = result.filter((d) => thankYouMap[d.sfId]);
    } else if (filter === "no_email") {
      result = result.filter((d) => !d.donorEmail);
    }

    return result;
  }, [donations, filter, timeRange, thankYouMap]);

  const totalDonors = donations.filter((d) => d.donorEmail).length;
  const thankedCount = donations.filter((d) => thankYouMap[d.sfId]).length;
  const needsThankCount = donations.filter(
    (d) => d.donorEmail && !thankYouMap[d.sfId]
  ).length;
  const noEmailCount = donations.filter((d) => !d.donorEmail).length;

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
          background: sender ? "rgba(34, 197, 94, 0.06)" : "rgba(212, 175, 55, 0.08)",
          border: `1px solid ${sender ? "var(--status-green)" : "var(--gold)"}`,
          borderRadius: "var(--radius-md)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Sending as:
        </span>
        {sender ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-bright)" }}>
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
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 10 }}>
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
                    background: sender?.email === v.email ? "rgba(212, 175, 55, 0.15)" : "var(--bg)",
                    border: `1px solid ${sender?.email === v.email ? "var(--gold)" : "var(--card-border)"}`,
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
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-bright)" }}>
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
        <div
          style={{
            flex: "1 1 140px",
            padding: "12px 16px",
            background: "var(--bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "var(--radius-md)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>
            {needsThankCount}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Need Thank You
          </div>
        </div>
        <div
          style={{
            flex: "1 1 140px",
            padding: "12px 16px",
            background: "var(--bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "var(--radius-md)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--status-green)" }}>
            {thankedCount}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Thanked
          </div>
        </div>
        <div
          style={{
            flex: "1 1 140px",
            padding: "12px 16px",
            background: "var(--bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "var(--radius-md)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: totalDonors > 0 ? "var(--status-blue)" : "var(--text-dim)",
            }}
          >
            {totalDonors > 0
              ? `${Math.round((thankedCount / totalDonors) * 100)}%`
              : "--"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Completion Rate
          </div>
        </div>
        <div
          style={{
            flex: "1 1 140px",
            padding: "12px 16px",
            background: "var(--bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "var(--radius-md)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: noEmailCount > 0 ? "var(--status-orange)" : "var(--text-dim)",
            }}
          >
            {noEmailCount}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            No Email on File
          </div>
        </div>
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
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Status:
          </span>
          {[
            { key: "all", label: "All" },
            { key: "needs_thanks", label: "Needs Thanks" },
            { key: "thanked", label: "Thanked" },
            { key: "no_email", label: "No Email" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={filter === f.key ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "3px 8px", fontSize: 11 }}
            >
              {f.label}
              {f.key === "needs_thanks" && needsThankCount > 0 && (
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
                  {needsThankCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
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
      </div>

      {/* Results count */}
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
        Showing {filtered.length} of {donations.length} donations
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
          {donations.length === 0
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
                  isThankYouSent={!!thankYouMap[donation.sfId]}
                  onToggleThankYou={toggleThankYou}
                  onCreateDraft={createDraft}
                  draftState={draftState}
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
        &quot;Create draft&quot; places a ready-to-send email in your @steel-hearts.org Gmail Drafts folder.
        Review, personalize if needed, then hit Send in Gmail.
        Thank-you tracking is stored locally in this browser until the Salesforce Thank_You_Sent__c field is configured.
      </div>
    </div>
  );
}
