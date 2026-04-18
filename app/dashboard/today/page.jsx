"use client";

import { useState, useEffect, useCallback } from "react";
import "./today.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(amount) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function urgencyClass(urgency = "") {
  const map = {
    OVERDUE: "urgency-overdue",
    TODAY: "urgency-today",
    WEEK: "urgency-week",
    SOMEDAY: "urgency-someday",
  };
  return map[urgency.toUpperCase()] || "urgency-someday";
}

// ---------------------------------------------------------------------------
// Expanded body components
// ---------------------------------------------------------------------------

function EmailBody({ item, onClose }) {
  const [draft, setDraft] = useState(item.context?.draftText || "");
  const [chatInput, setChatInput] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleAdjust = useCallback(async () => {
    if (!chatInput.trim() || adjusting) return;
    setAdjusting(true);
    try {
      const res = await fetch("/api/dashboard/adjust-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          instruction: chatInput,
          context: {
            to: item.context?.from,
            subject: item.context?.subject,
            category: item.context?.category,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.draft) setDraft(data.draft);
        setChatInput("");
      }
    } catch {
      // fail silently — draft is still editable
    } finally {
      setAdjusting(false);
    }
  }, [draft, chatInput, adjusting, item.context]);

  const handleSend = useCallback(async () => {
    if (!item.context?.threadId || sending || sent) return;
    setSending(true);
    try {
      const res = await fetch("/api/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          messageId: item.context.messageId,
          threadId: item.context.threadId,
          body: draft,
        }),
      });
      if (res.ok) setSent(true);
    } catch {
      // no-op
    } finally {
      setSending(false);
    }
  }, [item.context, draft, sending, sent]);

  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="email-meta">
        <div className="email-from">
          <strong>{item.context?.from || "Unknown sender"}</strong>
        </div>
        <div className="email-subject">{item.context?.subject || "(no subject)"}</div>
        {item.context?.snippet && (
          <div className="email-snippet">{item.context.snippet}</div>
        )}
      </div>

      {draft ? (
        <>
          <span className="draft-label">Draft</span>
          <textarea
            className="draft-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck
          />

          <div className="chat-row">
            <input
              className="chat-input"
              placeholder="Make it shorter · more urgent · add pricing..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdjust()}
              disabled={adjusting}
            />
            <button
              className="btn-adjust"
              onClick={handleAdjust}
              disabled={!chatInput.trim() || adjusting}
            >
              {adjusting ? "..." : "Adjust"}
            </button>
          </div>

          <div className="action-row">
            {item.context?.threadId ? (
              <button
                className="btn-primary btn-send"
                onClick={handleSend}
                disabled={sending || sent}
              >
                {sent ? "✓ Sent" : sending ? "Sending..." : "Send Email"}
              </button>
            ) : (
              <button
                className="btn-primary btn-send"
                onClick={() => {
                  const mailtoBody = encodeURIComponent(draft);
                  const mailtoSubject = encodeURIComponent(
                    `Re: ${item.context?.subject || ""}`.replace(/^Re:\s*Re:\s*/i, "Re: ")
                  );
                  window.open(`mailto:?subject=${mailtoSubject}&body=${mailtoBody}`);
                }}
              >
                Open in Mail App
              </button>
            )}
            <button className="btn-secondary" onClick={onClose}>
              Later
            </button>
          </div>
        </>
      ) : (
        <div className="action-row">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

function OrderBody({ item, onClose }) {
  const ctx = item.context || {};
  const statusClass = {
    pending_approval: "pill-amber",
    needs_info: "pill-amber",
    awaiting_proof_approval: "pill-purple",
    in_production: "pill-teal",
    shipped: "pill-green",
    complete: "pill-green",
  }[ctx.productionStatus] || "pill-gray";

  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="detail-grid">
        <div className="detail-item">
          <span className="detail-label">Hero</span>
          <span className="detail-value">{ctx.heroName || "—"}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Quantity</span>
          <span className="detail-value">{ctx.quantity ?? "—"}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Value</span>
          <span className="detail-value">{ctx.orderValue != null ? fmt(ctx.orderValue) : "—"}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">SKU</span>
          <span className="detail-value">{ctx.sku || "—"}</span>
        </div>
      </div>

      {ctx.productionStatus && (
        <div style={{ marginBottom: 12 }}>
          <span className={`status-pill ${statusClass}`}>{ctx.productionStatus.replace(/_/g, " ")}</span>
        </div>
      )}

      {ctx.notes && <div className="detail-notes">{ctx.notes}</div>}

      <div className="action-row">
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function TaskBody({ item, onClose }) {
  const ctx = item.context || {};
  const [subtasks, setSubtasks] = useState(ctx.subtasks || []);

  const toggle = (id) =>
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));

  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="detail-grid">
        {ctx.role && (
          <div className="detail-item">
            <span className="detail-label">Role</span>
            <span className="detail-value">{ctx.role}</span>
          </div>
        )}
        {ctx.dueDate && (
          <div className="detail-item">
            <span className="detail-label">Due</span>
            <span className="detail-value">{fmtDate(ctx.dueDate)}</span>
          </div>
        )}
        {ctx.status && (
          <div className="detail-item">
            <span className="detail-label">Status</span>
            <span className="detail-value">{ctx.status}</span>
          </div>
        )}
      </div>

      {ctx.notes && <div className="detail-notes">{ctx.notes}</div>}
      {ctx.source && <div className="detail-notes">Source: {ctx.source}</div>}

      {subtasks.length > 0 && (
        <div style={{ paddingTop: 4, paddingBottom: 12 }}>
          {subtasks.map((s) => (
            <div
              key={s.id}
              onClick={() => toggle(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                cursor: "pointer",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: `2px solid ${s.done ? "#22c55e" : "rgba(255,255,255,0.2)"}`,
                  background: s.done ? "#22c55e" : "transparent",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "#000",
                  fontWeight: 700,
                  transition: "all 0.15s",
                }}
              >
                {s.done ? "✓" : ""}
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: s.done ? "#4b5563" : "#9ca3af",
                  textDecoration: s.done ? "line-through" : "none",
                }}
              >
                {s.text}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="action-row">
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function ComplianceBody({ item, onClose }) {
  const ctx = item.context || {};
  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="detail-grid">
        {ctx.dueDate && (
          <div className="detail-item">
            <span className="detail-label">Due Date</span>
            <span className="detail-value">{fmtDate(ctx.dueDate)}</span>
          </div>
        )}
        {ctx.daysUntilDue != null && (
          <div className="detail-item">
            <span className="detail-label">Days Until Due</span>
            <span
              className="detail-value"
              style={{ color: ctx.daysUntilDue < 0 ? "#ef4444" : ctx.daysUntilDue <= 7 ? "#f59e0b" : "#e8eaed" }}
            >
              {ctx.daysUntilDue < 0 ? `${Math.abs(ctx.daysUntilDue)}d overdue` : `${ctx.daysUntilDue} days`}
            </span>
          </div>
        )}
        {ctx.status && (
          <div className="detail-item">
            <span className="detail-label">Status</span>
            <span className="detail-value">{ctx.status}</span>
          </div>
        )}
        {ctx.authority && (
          <div className="detail-item">
            <span className="detail-label">Authority</span>
            <span className="detail-value">{ctx.authority}</span>
          </div>
        )}
      </div>
      {ctx.notes && <div className="detail-notes">{ctx.notes}</div>}
      <div className="action-row">
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function PropertyBody({ item, onClose }) {
  const ctx = item.context || {};
  const cashflow = ctx.monthlyCashFlow;
  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="detail-grid">
        {ctx.address && (
          <div className="detail-item">
            <span className="detail-label">Address</span>
            <span className="detail-value">{ctx.address}</span>
          </div>
        )}
        {ctx.tenant && (
          <div className="detail-item">
            <span className="detail-label">Tenant</span>
            <span className="detail-value">{ctx.tenant}</span>
          </div>
        )}
        {ctx.rentAmount != null && (
          <div className="detail-item">
            <span className="detail-label">Rent</span>
            <span className="detail-value">{fmt(ctx.rentAmount)}/mo</span>
          </div>
        )}
        {cashflow != null && (
          <div className="detail-item">
            <span className="detail-label">Cash Flow</span>
            <span
              className={`detail-value ${cashflow >= 0 ? "cashflow-pos" : "cashflow-neg"}`}
            >
              {fmt(cashflow)}/mo
            </span>
          </div>
        )}
        {ctx.leaseEnd && (
          <div className="detail-item">
            <span className="detail-label">Lease End</span>
            <span className="detail-value">{fmtDate(ctx.leaseEnd)}</span>
          </div>
        )}
        {ctx.status && (
          <div className="detail-item">
            <span className="detail-label">Status</span>
            <span className="detail-value">{ctx.status}</span>
          </div>
        )}
      </div>
      {ctx.notes && <div className="detail-notes">{ctx.notes}</div>}
      <div className="action-row">
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function FinancialBody({ item, onClose }) {
  const ctx = item.context || {};
  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="detail-grid">
        {ctx.vendor && (
          <div className="detail-item">
            <span className="detail-label">Vendor / Contact</span>
            <span className="detail-value">{ctx.vendor}</span>
          </div>
        )}
        {ctx.amount != null && (
          <div className="detail-item">
            <span className="detail-label">Amount</span>
            <span className="detail-value" style={{ color: "#f59e0b" }}>
              {fmt(ctx.amount)}
            </span>
          </div>
        )}
        {ctx.deadline && (
          <div className="detail-item">
            <span className="detail-label">Deadline</span>
            <span className="detail-value" style={{ color: "#ef4444" }}>
              {fmtDate(ctx.deadline)}
            </span>
          </div>
        )}
      </div>
      {ctx.notes && <div className="detail-notes">{ctx.notes}</div>}

      {/* Debt list */}
      {ctx.debts?.length > 0 && (
        <div className="debt-list">
          {ctx.debts.map((d, i) => (
            <div key={i} className="debt-row">
              <span className="debt-name">{d.name || "Account"}</span>
              <div className="debt-details">
                <div className="debt-balance">{fmt(d.balance)}</div>
                {d.rate && <div className="debt-rate">{d.rate}% APR</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="action-row">
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function GystBody({ item, onClose }) {
  const ctx = item.context || {};
  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      {ctx.actionText && <div className="detail-notes">{ctx.actionText}</div>}
      <div className="detail-grid">
        {ctx.dueDate && (
          <div className="detail-item">
            <span className="detail-label">Due</span>
            <span className="detail-value">{fmtDate(ctx.dueDate)}</span>
          </div>
        )}
        {ctx.category && (
          <div className="detail-item">
            <span className="detail-label">Category</span>
            <span className="detail-value">{ctx.category}</span>
          </div>
        )}
      </div>
      <div className="action-row">
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function CalendarBody({ item, onClose }) {
  const ctx = item.context || {};
  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="cal-time">
        {ctx.allDay
          ? "All day event"
          : `${new Date(ctx.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} — ${new Date(ctx.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}`}
      </div>
      {ctx.description && <div className="detail-notes">{ctx.description}</div>}
      <div className="action-row">
        {ctx.htmlLink && (
          <a
            href={ctx.htmlLink}
            target="_blank"
            rel="noreferrer"
            style={{
              flex: 1,
              padding: 14,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 10,
              color: "#9ca3af",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              textAlign: "center",
              display: "block",
            }}
          >
            Open in Calendar
          </a>
        )}
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI row
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub, health, active, onClick }) {
  const healthColor = {
    green:   "#22c55e",
    amber:   "#f59e0b",
    red:     "#ef4444",
    blue:    "#3b82f6",
    neutral: "#4b5563",
  }[health] || "#4b5563";

  return (
    <button
      className={`kpi-card${active ? " kpi-card-active" : ""}`}
      onClick={onClick}
    >
      <div className="kpi-dot" style={{ background: healthColor }} />
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value ?? "—"}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </button>
  );
}

function KpiRow({ kpis }) {
  const [activeIdx, setActiveIdx] = useState(null);

  if (!kpis) return null;

  const fmtC = (n) =>
    n == null
      ? "—"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(n);
  const fmtN = (n) => (n == null ? "—" : n.toLocaleString());
  const month = new Date().toLocaleString("en-US", { month: "long" });

  const cards = [
    {
      label: "Heroes Honored",
      value: fmtN(kpis.heroesHonored),
      sub: "active listings",
      health: "blue",
      detail: `${fmtN(kpis.heroesHonored)} heroes actively listed on the Steel Hearts website.`,
    },
    {
      label: "Bracelets Shipped",
      value: fmtN(kpis.braceletsShipped),
      sub: month,
      health: kpis.braceletsShipped > 0 ? "green" : "amber",
      detail: `${fmtN(kpis.braceletsShipped)} bracelets shipped so far in ${month}.`,
    },
    {
      label: "In Pipeline",
      value: fmtN(kpis.pipelineTotal),
      sub: "orders",
      health: kpis.pipelineTotal === 0 ? "neutral" : kpis.pipelineTotal <= 5 ? "amber" : "red",
      detail:
        kpis.pipeline && Object.keys(kpis.pipeline).length
          ? Object.entries(kpis.pipeline)
              .map(([s, c]) => `${s.replace(/_/g, " ")}: ${c}`)
              .join("\n")
          : "No orders in pipeline.",
    },
    {
      label: "Revenue",
      value: fmtC(kpis.revenueThisMonth),
      sub: month,
      health:
        kpis.revenueThisMonth > 500
          ? "green"
          : kpis.revenueThisMonth > 0
          ? "amber"
          : "neutral",
      detail: `${fmtC(kpis.revenueThisMonth)} in order revenue in ${month}.`,
    },
    {
      label: "Donations",
      value: fmtC(kpis.donationsThisMonth),
      sub: month,
      health: kpis.donationsThisMonth > 0 ? "green" : "amber",
      detail: `${fmtC(kpis.donationsThisMonth)} donated in ${month}.`,
    },
    {
      label: "Thank-Yous Due",
      value: fmtN(kpis.pendingThanks),
      health:
        kpis.pendingThanks === 0 ? "green" : kpis.pendingThanks <= 3 ? "amber" : "red",
      detail:
        kpis.pendingThanks === 0
          ? "All donors have been thanked."
          : `${fmtN(kpis.pendingThanks)} donors haven't received a thank-you yet.`,
    },
    {
      label: "Family Messages",
      value: fmtN(kpis.familyMessagesPending),
      health: kpis.familyMessagesPending === 0 ? "green" : "red",
      detail:
        kpis.familyMessagesPending === 0
          ? "No pending family messages."
          : `${fmtN(kpis.familyMessagesPending)} new family message${
              kpis.familyMessagesPending !== 1 ? "s" : ""
            } need attention.`,
    },
    {
      label: "Anniversaries",
      value: fmtN(kpis.anniversaryEmailsDue),
      sub: "next 14 days",
      health: kpis.anniversaryEmailsDue === 0 ? "green" : "red",
      detail:
        kpis.anniversaryEmailsDue === 0
          ? "No anniversary emails due in the next 14 days."
          : `${kpis.anniversaryEmailsDue} memorial anniversary${
              kpis.anniversaryEmailsDue !== 1 ? "ies" : ""
            } in the next 14 days need email preparation.`,
    },
  ];

  const activeCard = activeIdx !== null ? cards[activeIdx] : null;

  return (
    <div className="kpi-section">
      <div className="kpi-row">
        {cards.map((c, i) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value={c.value}
            sub={c.sub}
            health={c.health}
            active={activeIdx === i}
            onClick={() => setActiveIdx(activeIdx === i ? null : i)}
          />
        ))}
      </div>
      {activeCard && (
        <div className="kpi-detail-panel">
          <div className="kpi-detail-heading">{activeCard.label}</div>
          <div className="kpi-detail-text">
            {activeCard.detail.split("\n").map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function DashboardCard({ item, expanded, onExpand, onCollapse }) {
  const isExpanded = expanded;

  function renderExpandedBody() {
    const onClose = onCollapse;
    switch (item.type) {
      case "EMAIL":      return <EmailBody item={item} onClose={onClose} />;
      case "ORDER":      return <OrderBody item={item} onClose={onClose} />;
      case "TASK":       return <TaskBody item={item} onClose={onClose} />;
      case "COMPLIANCE": return <ComplianceBody item={item} onClose={onClose} />;
      case "PROPERTY":   return <PropertyBody item={item} onClose={onClose} />;
      case "FINANCIAL":  return <FinancialBody item={item} onClose={onClose} />;
      case "GYST":       return <GystBody item={item} onClose={onClose} />;
      case "CALENDAR":   return <CalendarBody item={item} onClose={onClose} />;
      default:           return <TaskBody item={item} onClose={onClose} />;
    }
  }

  return (
    <div
      className={`today-card ${urgencyClass(item.urgency)} ${isExpanded ? "expanded" : ""}`}
      onClick={!isExpanded ? onExpand : undefined}
    >
      {/* Collapsed header — always visible */}
      <div
        className="card-collapsed"
        style={isExpanded ? { cursor: "default" } : {}}
      >
        <span className="card-icon">{item.icon}</span>
        <div className="card-main">
          <div className="card-title">{item.title}</div>
          {item.subtitle && <div className="card-subtitle">{item.subtitle}</div>}
        </div>
        {item.badgeLabel && (
          <span className={`card-badge ${item.badgeClass || "badge-week"}`}>
            {item.badgeLabel}
          </span>
        )}
        {isExpanded && (
          <button
            className="btn-collapse"
            style={{ marginLeft: 8, flexShrink: 0 }}
            onClick={(e) => { e.stopPropagation(); onCollapse(); }}
          >
            ↑
          </button>
        )}
      </div>

      {/* Expandable body */}
      <div className={`card-expand-wrapper ${isExpanded ? "open" : ""}`}>
        <div className="card-expand-inner">{renderExpandedBody()}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

function Section({ title, color, dividerClass, items, expandedId, onExpand, onCollapse }) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <div className="section-header">
        <span className="section-label" style={{ color }}>
          {title}
        </span>
        <div className={`section-divider ${dividerClass}`} style={{ background: color }} />
        <span style={{ fontSize: 11, color: "#374151", flexShrink: 0 }}>{items.length}</span>
      </div>
      {items.map((item) => (
        <DashboardCard
          key={item.id}
          item={item}
          expanded={expandedId === item.id}
          onExpand={() => onExpand(item.id)}
          onCollapse={onCollapse}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TodayPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/dashboard/today");
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const todayItems    = (data?.items || []).filter((i) => i.section === "TODAY");
  const weekItems     = (data?.items || []).filter((i) => i.section === "WEEK");
  const trackedItems  = (data?.items || []).filter((i) => i.section === "TRACKED");

  const overdue = todayItems.filter((i) => i.urgency === "OVERDUE").length;

  const handleExpand = useCallback((id) => setExpandedId(id), []);
  const handleCollapse = useCallback(() => setExpandedId(null), []);

  if (loading) {
    return (
      <div className="today-shell">
        <div className="loading-shell">
          <div className="loading-ring" />
          <span className="loading-text">Loading your day…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="today-shell">
      {/* Header */}
      <div className="today-header">
        <div className="today-datestr">{data?.dateLabel || "Today"}</div>
        <div className="today-title-row">
          <span className="today-title">Command Center</span>
          <span className="today-counts">
            {overdue > 0 && (
              <span className="today-count-badge">
                <span className="dot" style={{ background: "#ef4444" }} />
                <span style={{ color: "#ef4444" }}>{overdue} overdue</span>
              </span>
            )}
            {data?.counts && (
              <span style={{ marginLeft: overdue > 0 ? 8 : 0 }}>
                {data.counts.today}↑ {data.counts.week}~ {data.counts.tracked}·
              </span>
            )}
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <KpiRow kpis={data?.kpis} />

      {/* Inbox banner */}
      {data?.emailCount > 0 && (
        <a
          href="/email"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            margin: "0 0 4px", padding: "10px 16px",
            background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)",
            borderRadius: 8, textDecoration: "none", cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 13, color: "#93c5fd" }}>
            📧 <strong style={{ color: "#60a5fa" }}>{data.emailCount} email{data.emailCount !== 1 ? "s" : ""}</strong> need your attention
          </span>
          <span style={{ fontSize: 12, color: "#60a5fa", fontWeight: 600 }}>Go to Inbox →</span>
        </a>
      )}

      {/* Body */}
      <div className="today-body">
        <Section
          title="Respond Today"
          color="#ef4444"
          items={todayItems}
          expandedId={expandedId}
          onExpand={handleExpand}
          onCollapse={handleCollapse}
        />
        <Section
          title="This Week"
          color="#f59e0b"
          items={weekItems}
          expandedId={expandedId}
          onExpand={handleExpand}
          onCollapse={handleCollapse}
        />
        <Section
          title="Tracked"
          color="#22c55e"
          items={trackedItems}
          expandedId={expandedId}
          onExpand={handleExpand}
          onCollapse={handleCollapse}
        />

        {!data?.items?.length && (
          <div className="section-empty" style={{ marginTop: 40, fontSize: 15 }}>
            Nothing on the radar. Clean slate.
          </div>
        )}
      </div>

      {/* Refresh FAB */}
      <button
        className={`refresh-fab ${refreshing ? "spinning" : ""}`}
        onClick={() => load(true)}
        title="Refresh"
        aria-label="Refresh dashboard"
      >
        ↻
      </button>
    </div>
  );
}
