"use client";

import { useState, useCallback } from "react";
import StatusBadge from "@/components/StatusBadge";

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

function MessageRow({ msg }) {
  const [expanded, setExpanded] = useState(false);
  const preview = (msg.message || "").slice(0, 120);
  const hasMore = (msg.message || "").length > 120;

  return (
    <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
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
          {expanded ? msg.message : preview}
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
    </tr>
  );
}

function HeroGroup({ group }) {
  const [expanded, setExpanded] = useState(false);

  const noContact = !group.familyContactEmail;

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
            {group.newMessages > 0 && `${group.newMessages} new`}
            {group.sentMessages > 0 && `${group.newMessages > 0 ? ", " : ""}${group.sentMessages} sent`}
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
              {group.newMessages + group.readyToSendMessages}/6
            </span>
          )}
        </td>
      </tr>

      {/* Expanded Messages */}
      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: 0, background: "rgba(196, 162, 55, 0.03)" }}>
            <div style={{ padding: "0 10px 10px 30px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>From</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Source</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Date</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Message</th>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {group.messages.map((msg) => (
                    <MessageRow key={msg.sfId} msg={msg} />
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

export default function MessageTracker({ heroGroups }) {
  if (!heroGroups || heroGroups.length === 0) {
    return (
      <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
        No hero groups to display.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", minWidth: 180 }}>Hero / Bracelet</th>
            <th style={{ textAlign: "left", minWidth: 150 }}>Family Contact</th>
            <th style={{ textAlign: "center", minWidth: 80 }}>Messages</th>
            <th style={{ textAlign: "center", minWidth: 70 }}>Senders</th>
            <th style={{ textAlign: "center", minWidth: 80 }}>Eligible</th>
          </tr>
        </thead>
        <tbody>
          {heroGroups.map((group) => (
            <HeroGroup key={group.braceletId || "unmatched"} group={group} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
