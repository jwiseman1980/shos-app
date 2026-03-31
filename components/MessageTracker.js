"use client";

import { useState, useCallback, useEffect } from "react";
import StatusBadge from "@/components/StatusBadge";
import { repairMojibake } from "@/lib/text-repair";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status) {
  const colors = {
    New: "var(--status-blue)",
    "Ready to Send": "var(--status-orange)",
    Sent: "var(--status-green)",
    Held: "var(--status-gray)",
  };
  return colors[status] || "var(--text-dim)";
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const BTN_STYLE = {
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 10,
  fontWeight: 600,
  padding: "3px 8px",
  transition: "opacity 0.15s",
};

// ---------------------------------------------------------------------------
// MessageRow — individual message with approve/hold actions
// ---------------------------------------------------------------------------

function MessageRow({ msg, onStatusChange, saving, lastSaved }) {
  const [expanded, setExpanded] = useState(false);
  const cleanMessage = repairMojibake(msg.message || "");
  const preview = cleanMessage.slice(0, 120);
  const hasMore = cleanMessage.length > 120;

  const isSent = msg.status === "Sent";
  const isSaving = saving;
  const saved = lastSaved;

  const rowBg = isSaving
    ? "rgba(212, 175, 55, 0.06)"
    : saved === "saved"
    ? "rgba(34, 197, 94, 0.06)"
    : saved === "error"
    ? "rgba(231, 76, 60, 0.06)"
    : "transparent";

  return (
    <tr style={{ borderBottom: "1px solid var(--card-border)", background: rowBg, transition: "background 0.3s ease" }}>
      <td style={{ fontSize: 12, padding: "8px 10px", verticalAlign: "top" }}>
        <div style={{ fontWeight: 500, color: "var(--text-bright)" }}>
          {msg.fromName || "Anonymous"}
        </div>
        {msg.consentToShare && msg.fromEmail && (
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
            {msg.fromEmail}
          </div>
        )}
      </td>
      <td style={{ fontSize: 11, padding: "8px 10px", color: "var(--text-dim)", verticalAlign: "top", whiteSpace: "nowrap" }}>
        {msg.source === "Squarespace Purchase" ? "Squarespace" : msg.source === "Bio Page Form" ? "Bio Page" : msg.source || "—"}
      </td>
      <td style={{ fontSize: 11, padding: "8px 10px", color: "var(--text-dim)", verticalAlign: "top", whiteSpace: "nowrap" }}>
        {formatDate(msg.submittedDate)}
      </td>
      <td style={{ fontSize: 12, padding: "8px 10px", lineHeight: 1.5, maxWidth: 400, verticalAlign: "top" }}>
        <div style={{ color: "var(--text-bright)" }}>
          {expanded ? cleanMessage : preview}
          {hasMore && !expanded && "..."}
        </div>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              color: "var(--gold)",
              fontSize: 11,
              cursor: "pointer",
              padding: "2px 0",
              marginTop: 4,
            }}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </td>
      <td style={{ fontSize: 11, padding: "8px 10px", verticalAlign: "top" }}>
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 600,
            background: statusColor(msg.status) + "22",
            color: statusColor(msg.status),
            border: `1px solid ${statusColor(msg.status)}44`,
          }}
        >
          {msg.status || "New"}
        </span>
      </td>
      <td style={{ padding: "8px 10px", verticalAlign: "top", whiteSpace: "nowrap" }}>
        {isSent ? (
          <span style={{ fontSize: 10, color: "var(--status-green)" }}>✓ Sent</span>
        ) : isSaving ? (
          <span style={{ fontSize: 10, color: "var(--gold)" }}>saving...</span>
        ) : (
          <div style={{ display: "flex", gap: 4 }}>
            {msg.status !== "Ready to Send" && (
              <button
                onClick={() => onStatusChange(msg.sfId, "Ready to Send")}
                style={{ ...BTN_STYLE, background: "var(--status-green)22", color: "var(--status-green)" }}
                title="Approve message"
              >
                ✓
              </button>
            )}
            {msg.status !== "Held" && (
              <button
                onClick={() => onStatusChange(msg.sfId, "Held")}
                style={{ ...BTN_STYLE, background: "var(--status-red)22", color: "var(--status-red)" }}
                title="Hold message"
              >
                ✕
              </button>
            )}
            {(msg.status === "Ready to Send" || msg.status === "Held") && (
              <button
                onClick={() => onStatusChange(msg.sfId, "New")}
                style={{ ...BTN_STYLE, background: "var(--status-blue)22", color: "var(--status-blue)" }}
                title="Reset to New"
              >
                ↩
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// HeroGroup — expandable hero row with bulk actions + draft creation
// ---------------------------------------------------------------------------

function HeroGroup({ group, senderEmail, senderName, onStatusChange, savingMap, lastSavedMap }) {
  const [expanded, setExpanded] = useState(false);
  const [draftState, setDraftState] = useState(null); // null | "creating" | { draftId } | { error }
  const [approveAllState, setApproveAllState] = useState(null); // null | "approving" | "done"
  const [outreachState, setOutreachState] = useState(null); // null | "loading" | "sending" | { draftsCreated, eligible } | { error }
  const [outreachStats, setOutreachStats] = useState(null); // { customers, alreadyMessaged, eligible }

  const noContact = !group.familyContactEmail;

  // Compute live counts from current message states
  const newCount = group.messages.filter((m) => m.status === "New" || !m.status).length;
  const readyCount = group.messages.filter((m) => m.status === "Ready to Send").length;
  const sentCount = group.messages.filter((m) => m.status === "Sent").length;
  const heldCount = group.messages.filter((m) => m.status === "Held").length;

  // Fetch outreach stats when group expands
  useEffect(() => {
    if (expanded && !outreachStats && group.braceletId) {
      fetch(`/api/messages/outreach?heroId=${group.braceletId}`)
        .then((r) => r.json())
        .then((data) => setOutreachStats(data))
        .catch(() => {});
    }
  }, [expanded, outreachStats, group.braceletId]);

  // Send outreach drafts to bracelet customers
  const handleOutreach = useCallback(async () => {
    if (!group.braceletId) return;
    setOutreachState("sending");
    try {
      const res = await fetch("/api/messages/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroId: group.braceletId,
          senderEmail,
          senderName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOutreachState({ draftsCreated: data.draftsCreated, eligible: data.eligibleCustomers });
      } else if (data.mock) {
        setOutreachState({ draftsCreated: 0, mock: true });
      } else {
        setOutreachState({ error: data.error || "Failed" });
      }
    } catch (err) {
      setOutreachState({ error: err.message });
    }
  }, [group.braceletId, senderEmail, senderName]);

  // Approve all "New" messages
  const handleApproveAll = useCallback(async () => {
    const newIds = group.messages
      .filter((m) => m.status === "New" || !m.status)
      .map((m) => m.sfId);

    if (newIds.length === 0) return;

    setApproveAllState("approving");
    try {
      const res = await fetch("/api/messages/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sfIds: newIds, status: "Ready to Send" }),
      });
      const data = await res.json();
      if (data.success || data.mock) {
        // Update local message states
        newIds.forEach((id) => onStatusChange(id, "Ready to Send", true));
        setApproveAllState("done");
        setTimeout(() => setApproveAllState(null), 2000);
      } else {
        setApproveAllState(null);
      }
    } catch {
      setApproveAllState(null);
    }
  }, [group.messages, onStatusChange]);

  // Create Gmail draft with all "Ready to Send" messages
  const handleCreateDraft = useCallback(async () => {
    const readyIds = group.messages
      .filter((m) => m.status === "Ready to Send")
      .map((m) => m.sfId);

    if (readyIds.length === 0 || noContact) return;

    setDraftState("creating");
    try {
      const res = await fetch("/api/messages/draft-packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          braceletId: group.braceletId,
          heroName: group.braceletName || group.braceletSku,
          familyName: group.familyContactName,
          familyEmail: group.familyContactEmail,
          senderEmail,
          senderName,
          messageIds: readyIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Mark messages as Sent locally
        readyIds.forEach((id) => onStatusChange(id, "Sent", true));
        setDraftState({ draftId: data.draftId, message: data.message });
      } else if (data.mock) {
        setDraftState({ draftId: "mock", message: "Mock mode — Gmail not connected" });
      } else {
        setDraftState({ error: data.error || "Failed to create draft" });
      }
    } catch (err) {
      setDraftState({ error: err.message });
    }
  }, [group, senderEmail, senderName, noContact, onStatusChange]);

  return (
    <>
      {/* Summary Row */}
      <tr
        style={{
          cursor: "pointer",
          borderBottom: expanded ? "none" : "1px solid var(--card-border)",
          background: expanded ? "rgba(196, 162, 55, 0.05)" : "transparent",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <td style={{ padding: "10px 10px", verticalAlign: "middle" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-dim)", transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>
              {"\u25B6"}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)" }}>
                {group.braceletName || group.braceletSku || "Unknown Hero"}
              </div>
              {group.braceletSku && group.braceletSku !== group.braceletName && (
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>
                  {group.braceletSku}
                </div>
              )}
            </div>
          </div>
        </td>
        <td style={{ padding: "10px 10px", fontSize: 12 }}>
          <div style={{ color: noContact ? "var(--status-red)" : "var(--text-bright)" }}>
            {group.familyContactName || (noContact ? "No contact" : "—")}
          </div>
          {group.familyContactEmail && (
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>
              {group.familyContactEmail}
            </div>
          )}
          {noContact && (
            <div style={{ fontSize: 10, color: "var(--status-red)", marginTop: 1 }}>
              Needs family contact
            </div>
          )}
        </td>
        <td style={{ padding: "10px 10px", fontSize: 13, fontWeight: 600, color: "var(--text-bright)", textAlign: "center" }}>
          {group.totalMessages}
          <div style={{ fontSize: 10, fontWeight: 400, color: "var(--text-dim)" }}>
            {readyCount > 0 && <span style={{ color: "var(--status-orange)" }}>{readyCount} ready</span>}
            {readyCount > 0 && sentCount > 0 && ", "}
            {sentCount > 0 && <span style={{ color: "var(--status-green)" }}>{sentCount} sent</span>}
            {(readyCount > 0 || sentCount > 0) && newCount > 0 && ", "}
            {newCount > 0 && `${newCount} new`}
          </div>
        </td>
        <td style={{ padding: "10px 10px", fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
          {group.uniqueSenders}
        </td>
        <td style={{ padding: "10px 10px", textAlign: "center" }}>
          {group.eligible ? (
            <span style={{
              display: "inline-block",
              padding: "3px 10px",
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 700,
              background: "var(--status-green)22",
              color: "var(--status-green)",
              border: "1px solid var(--status-green)44",
            }}>
              Eligible
            </span>
          ) : (
            <span style={{
              display: "inline-block",
              padding: "3px 10px",
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 600,
              background: "var(--status-gray)22",
              color: "var(--status-gray)",
              border: "1px solid var(--status-gray)44",
            }}>
              {(newCount + readyCount)}/6
            </span>
          )}
        </td>
        <td style={{ padding: "10px 10px", textAlign: "center" }}>
          {/* Draft status indicator */}
          {draftState && draftState.draftId && (
            <span style={{
              display: "inline-block",
              padding: "3px 8px",
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 600,
              background: "var(--status-green)22",
              color: "var(--status-green)",
              border: "1px solid var(--status-green)44",
            }}>
              Draft Created
            </span>
          )}
          {sentCount === group.totalMessages && sentCount > 0 && !draftState && (
            <span style={{
              display: "inline-block",
              padding: "3px 8px",
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 600,
              background: "var(--status-green)22",
              color: "var(--status-green)",
              border: "1px solid var(--status-green)44",
            }}>
              All Sent
            </span>
          )}
        </td>
      </tr>

      {/* Expanded Messages */}
      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0, background: "rgba(196, 162, 55, 0.03)" }}>
            <div style={{ padding: "0 10px 10px 30px" }}>

              {/* Bulk Action Bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", flexWrap: "wrap" }}>
                {/* Approve All */}
                {newCount > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleApproveAll(); }}
                    disabled={approveAllState === "approving"}
                    style={{
                      ...BTN_STYLE,
                      padding: "5px 12px",
                      fontSize: 11,
                      background: approveAllState === "done" ? "var(--status-green)22" : "var(--status-green)18",
                      color: "var(--status-green)",
                      border: "1px solid var(--status-green)44",
                      opacity: approveAllState === "approving" ? 0.5 : 1,
                    }}
                  >
                    {approveAllState === "approving" ? "Approving..." : approveAllState === "done" ? "✓ Approved" : `Approve All (${newCount})`}
                  </button>
                )}

                {/* Create Draft */}
                {readyCount > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCreateDraft(); }}
                    disabled={noContact || draftState === "creating" || (draftState && draftState.draftId)}
                    style={{
                      ...BTN_STYLE,
                      padding: "5px 12px",
                      fontSize: 11,
                      background: draftState && draftState.draftId
                        ? "var(--status-green)22"
                        : "var(--gold-soft)",
                      color: draftState && draftState.draftId
                        ? "var(--status-green)"
                        : noContact
                        ? "var(--text-dim)"
                        : "var(--gold-bright)",
                      border: draftState && draftState.draftId
                        ? "1px solid var(--status-green)44"
                        : "1px solid var(--gold)44",
                      opacity: noContact ? 0.4 : draftState === "creating" ? 0.5 : 1,
                      cursor: noContact ? "not-allowed" : "pointer",
                    }}
                    title={noContact ? "No family email — cannot create draft" : ""}
                  >
                    {draftState === "creating"
                      ? "Creating Draft..."
                      : draftState && draftState.draftId
                      ? "✓ Draft Created"
                      : `Create Draft (${readyCount} messages)`}
                  </button>
                )}

                {/* Request Messages — outreach to bracelet customers */}
                {group.braceletId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOutreach(); }}
                    disabled={
                      outreachState === "sending" ||
                      (outreachState && outreachState.draftsCreated != null) ||
                      (outreachStats && outreachStats.eligible === 0)
                    }
                    style={{
                      ...BTN_STYLE,
                      padding: "5px 12px",
                      fontSize: 11,
                      background: outreachState && outreachState.draftsCreated != null
                        ? "var(--status-green)22"
                        : "var(--status-blue)18",
                      color: outreachState && outreachState.draftsCreated != null
                        ? "var(--status-green)"
                        : outreachStats && outreachStats.eligible === 0
                        ? "var(--text-dim)"
                        : "var(--status-blue)",
                      border: outreachState && outreachState.draftsCreated != null
                        ? "1px solid var(--status-green)44"
                        : "1px solid var(--status-blue)44",
                      opacity: outreachState === "sending" ? 0.5
                        : outreachStats && outreachStats.eligible === 0 ? 0.4
                        : 1,
                      cursor: outreachStats && outreachStats.eligible === 0 ? "not-allowed" : "pointer",
                    }}
                    title={outreachStats
                      ? `${outreachStats.eligible} customers haven't left a message yet`
                      : "Email bracelet customers asking them to leave a tribute message"}
                  >
                    {outreachState === "sending"
                      ? "Creating Drafts..."
                      : outreachState && outreachState.draftsCreated != null
                      ? `✓ ${outreachState.draftsCreated} Outreach Drafts`
                      : outreachStats
                      ? `Request Messages (${outreachStats.eligible})`
                      : "Request Messages"}
                  </button>
                )}

                {/* Draft feedback */}
                {draftState && draftState.error && (
                  <span style={{ fontSize: 11, color: "var(--status-red)" }}>
                    Error: {draftState.error}
                  </span>
                )}
                {draftState && draftState.message && (
                  <span style={{ fontSize: 11, color: "var(--status-green)" }}>
                    {draftState.message}
                  </span>
                )}
                {outreachState && outreachState.error && (
                  <span style={{ fontSize: 11, color: "var(--status-red)" }}>
                    Outreach error: {outreachState.error}
                  </span>
                )}
                {outreachState && outreachState.mock && (
                  <span style={{ fontSize: 11, color: "var(--gold)" }}>
                    Mock mode — Gmail not configured
                  </span>
                )}

                {/* Status summary */}
                <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: "auto" }}>
                  {newCount > 0 && <span>{newCount} new</span>}
                  {readyCount > 0 && <span>{newCount > 0 ? " · " : ""}{readyCount} ready</span>}
                  {sentCount > 0 && <span>{(newCount > 0 || readyCount > 0) ? " · " : ""}{sentCount} sent</span>}
                  {heldCount > 0 && <span>{(newCount > 0 || readyCount > 0 || sentCount > 0) ? " · " : ""}{heldCount} held</span>}
                </span>
              </div>

              {/* Messages Table */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>From</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Source</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Date</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Message</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.messages.map((msg) => (
                    <MessageRow
                      key={msg.sfId}
                      msg={msg}
                      onStatusChange={onStatusChange}
                      saving={savingMap[msg.sfId]}
                      lastSaved={lastSavedMap[msg.sfId]}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// MessageTracker — main component with sender picker + all hero groups
// ---------------------------------------------------------------------------

export default function MessageTracker({ heroGroups, volunteers }) {
  // Sender identity (stored in localStorage)
  const [senderEmail, setSenderEmail] = useState("joseph@steel-hearts.org");
  const [senderName, setSenderName] = useState("Joseph Wiseman");

  // Per-message saving state
  const [savingMap, setSavingMap] = useState({});
  const [lastSavedMap, setLastSavedMap] = useState({});

  // Batch draft state
  const [batchState, setBatchState] = useState(null); // null | "drafting" | { drafted, errors } | { error }

  // Local message status overrides (optimistic updates)
  const [statusOverrides, setStatusOverrides] = useState({});

  // Load sender from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("shos-message-sender");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setSenderEmail(parsed.email);
        if (parsed.name) setSenderName(parsed.name);
      }
    } catch {}
  }, []);

  // Save sender to localStorage
  const handleSenderChange = useCallback((email, name) => {
    setSenderEmail(email);
    setSenderName(name);
    try {
      localStorage.setItem("shos-message-sender", JSON.stringify({ email, name }));
    } catch {}
  }, []);

  // Update a single message status (API call + optimistic update)
  const handleStatusChange = useCallback(async (sfId, newStatus, skipApi = false) => {
    // Optimistic update
    setStatusOverrides((prev) => ({ ...prev, [sfId]: newStatus }));

    if (skipApi) return; // Bulk operations handle their own API calls

    setSavingMap((s) => ({ ...s, [sfId]: true }));
    setLastSavedMap((s) => ({ ...s, [sfId]: null }));

    try {
      const res = await fetch("/api/messages/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sfId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success || data.mock) {
        setLastSavedMap((s) => ({ ...s, [sfId]: "saved" }));
      } else {
        setLastSavedMap((s) => ({ ...s, [sfId]: "error" }));
        // Revert optimistic update
        setStatusOverrides((prev) => {
          const next = { ...prev };
          delete next[sfId];
          return next;
        });
      }
    } catch {
      setLastSavedMap((s) => ({ ...s, [sfId]: "error" }));
      setStatusOverrides((prev) => {
        const next = { ...prev };
        delete next[sfId];
        return next;
      });
    } finally {
      setSavingMap((s) => ({ ...s, [sfId]: false }));
      setTimeout(() => setLastSavedMap((s) => ({ ...s, [sfId]: null })), 2000);
    }
  }, []);

  // Apply status overrides to hero groups
  const groupsWithOverrides = heroGroups.map((group) => ({
    ...group,
    messages: group.messages.map((msg) => ({
      ...msg,
      status: statusOverrides[msg.sfId] || msg.status || "New",
    })),
  }));

  if (!heroGroups || heroGroups.length === 0) {
    return (
      <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
        No hero groups to display.
      </p>
    );
  }

  // Eligible families with contact info (for batch draft)
  const eligibleWithContact = groupsWithOverrides.filter(g =>
    g.familyContactEmail && (
      g.messages.filter(m => m.status === "Ready to Send" || m.status === "New").length >= 1
    ) && !g.isUnmatched
  );

  // Build volunteer options for sender picker
  const volunteerOptions = (volunteers || [])
    .filter((v) => v.email && v.email.endsWith("@steel-hearts.org"))
    .map((v) => ({ email: v.email, name: v.name }));

  // Ensure current sender is in the list
  if (!volunteerOptions.find((v) => v.email === senderEmail)) {
    volunteerOptions.unshift({ email: senderEmail, name: senderName });
  }

  return (
    <div>
      {/* Sender Identity Picker */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
        padding: "10px 14px",
        background: "var(--bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--radius-md)",
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Sending as:
        </span>
        <select
          value={senderEmail}
          onChange={(e) => {
            const vol = volunteerOptions.find((v) => v.email === e.target.value);
            if (vol) handleSenderChange(vol.email, vol.name);
          }}
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: 4,
            color: "var(--text-bright)",
            fontSize: 12,
            padding: "4px 8px",
          }}
        >
          {volunteerOptions.map((v) => (
            <option key={v.email} value={v.email}>
              {v.name} ({v.email})
            </option>
          ))}
        </select>
      </div>

      {/* Batch Draft Button */}
      {eligibleWithContact.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
          padding: "10px 14px",
          background: "var(--gold-soft)",
          border: "1px solid var(--gold-border)",
          borderRadius: "var(--radius-md)",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gold-bright)" }}>
              {eligibleWithContact.length} {eligibleWithContact.length === 1 ? "family" : "families"} ready for message delivery
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
              {eligibleWithContact.map(g => g.braceletName || g.braceletSku).join(", ")}
            </div>
          </div>
          <button
            onClick={async () => {
              setBatchState("drafting");
              try {
                const res = await fetch("/api/messages/draft-batch", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                });
                const data = await res.json();
                if (data.success) {
                  // Mark all drafted messages as Sent locally
                  for (const r of (data.results || [])) {
                    const group = groupsWithOverrides.find(g =>
                      g.messages.some(m => m.braceletId === r.heroId || g.braceletId === r.heroId)
                    );
                    if (group) {
                      group.messages.forEach(m => {
                        if (m.status === "Ready to Send" || m.status === "New") {
                          setStatusOverrides(prev => ({ ...prev, [m.sfId]: "Sent" }));
                        }
                      });
                    }
                  }
                  setBatchState({
                    drafted: data.drafted,
                    totalMessages: data.totalMessages,
                    errors: data.errors,
                  });
                } else {
                  setBatchState({ error: data.error || "Failed" });
                }
              } catch (err) {
                setBatchState({ error: err.message });
              }
            }}
            disabled={batchState === "drafting"}
            style={{
              background: "var(--gold)", color: "#000", border: "none", cursor: "pointer",
              padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700,
              opacity: batchState === "drafting" ? 0.6 : 1, flexShrink: 0,
            }}
          >
            {batchState === "drafting" ? "Creating drafts..." : `Draft All (${eligibleWithContact.length} families)`}
          </button>
          {batchState && batchState !== "drafting" && !batchState.error && (
            <span style={{ fontSize: 11, color: "var(--status-green)" }}>
              {batchState.drafted} drafts created ({batchState.totalMessages} messages)
              {batchState.errors?.length > 0 && `, ${batchState.errors.length} errors`}
            </span>
          )}
          {batchState?.error && (
            <span style={{ fontSize: 11, color: "var(--status-red)" }}>{batchState.error}</span>
          )}
        </div>
      )}

      {/* Hero Groups Table */}
      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", minWidth: 180 }}>Hero / Bracelet</th>
              <th style={{ textAlign: "left", minWidth: 150 }}>Family Contact</th>
              <th style={{ textAlign: "center", minWidth: 80 }}>Messages</th>
              <th style={{ textAlign: "center", minWidth: 70 }}>Senders</th>
              <th style={{ textAlign: "center", minWidth: 80 }}>Eligible</th>
              <th style={{ textAlign: "center", minWidth: 90 }}>Draft</th>
            </tr>
          </thead>
          <tbody>
            {groupsWithOverrides.map((group) => (
              <HeroGroup
                key={group.braceletId || "unmatched"}
                group={group}
                senderEmail={senderEmail}
                senderName={senderName}
                onStatusChange={handleStatusChange}
                savingMap={savingMap}
                lastSavedMap={lastSavedMap}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
