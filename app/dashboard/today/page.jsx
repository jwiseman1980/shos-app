"use client";

import { useState, useEffect, useCallback } from "react";
import { getBrowserClient } from "@/lib/supabase";
import "./today.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(amount) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function urgencyClass(urgency = "") {
  const map = { OVERDUE: "urgency-overdue", TODAY: "urgency-today", WEEK: "urgency-week", SOMEDAY: "urgency-someday" };
  return map[urgency.toUpperCase()] || "urgency-someday";
}

// ---------------------------------------------------------------------------
// Pipeline Bar — shows stage progress inline on every card
// ---------------------------------------------------------------------------

function PipelineBar({ pipeline }) {
  if (!pipeline?.stages?.length) return null;
  const { name, stages, current, stageName } = pipeline;
  const total = stages.length;
  return (
    <div className="pipeline-bar">
      <span className="pipeline-name">{name}</span>
      <div className="pipeline-dots">
        {stages.map((_, i) => (
          <span
            key={i}
            className={`pipeline-dot ${i < current ? "pdot-done" : i === current ? "pdot-active" : "pdot-pending"}`}
            title={stages[i]}
          />
        ))}
      </div>
      <span className="pipeline-stage">
        Stage {current + 1}/{total} — {stageName}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workflow chips — suggested pipeline start buttons (for email cards)
// ---------------------------------------------------------------------------

function WorkflowChips({ suggestedPipelines = [] }) {
  if (!suggestedPipelines.length) return null;
  const LABELS = {
    start_hero_intake: "Start Hero Intake",
    create_order:      "Create Order",
    request_design:    "Request Design",
  };
  const HREFS = {
    start_hero_intake: "/heroes/new",
    create_order:      "/orders/new",
    request_design:    "/designs",
  };
  return (
    <div className="workflow-chips">
      {suggestedPipelines.map((p) => (
        <a key={p} href={HREFS[p] || "#"} className="workflow-chip">
          {LABELS[p] || p}
        </a>
      ))}
    </div>
  );
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
        body: JSON.stringify({ draft, instruction: chatInput, context: { to: item.context?.from, subject: item.context?.subject, category: item.context?.category } }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.draft) setDraft(data.draft);
        setChatInput("");
      }
    } catch {}
    finally { setAdjusting(false); }
  }, [draft, chatInput, adjusting, item.context]);

  const handleSend = useCallback(async () => {
    if (!item.context?.threadId || sending || sent) return;
    setSending(true);
    try {
      const res = await fetch("/api/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", messageId: item.context.messageId, threadId: item.context.threadId, body: draft }),
      });
      if (res.ok) setSent(true);
    } catch {}
    finally { setSending(false); }
  }, [item.context, draft, sending, sent]);

  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="email-meta">
        <div className="email-from"><strong>{item.context?.from || "Unknown sender"}</strong></div>
        <div className="email-subject">{item.context?.subject || "(no subject)"}</div>
        {item.context?.snippet && <div className="email-snippet">{item.context.snippet}</div>}
      </div>

      {/* Workflow routing */}
      <WorkflowChips suggestedPipelines={item.context?.suggestedPipelines} />

      {draft ? (
        <>
          <span className="draft-label">Draft</span>
          <textarea className="draft-textarea" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck />
          <div className="chat-row">
            <input
              className="chat-input"
              placeholder="Make it shorter · more urgent · add pricing..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdjust()}
              disabled={adjusting}
            />
            <button className="btn-adjust" onClick={handleAdjust} disabled={!chatInput.trim() || adjusting}>
              {adjusting ? "..." : "Adjust"}
            </button>
          </div>
          <div className="action-row">
            {item.context?.threadId ? (
              <button className="btn-primary btn-send" onClick={handleSend} disabled={sending || sent}>
                {sent ? "✓ Sent" : sending ? "Sending..." : "Send Email"}
              </button>
            ) : (
              <button className="btn-primary btn-send" onClick={() => {
                const b = encodeURIComponent(draft);
                const s = encodeURIComponent(`Re: ${item.context?.subject || ""}`.replace(/^Re:\s*Re:\s*/i, "Re: "));
                window.open(`mailto:?subject=${s}&body=${b}`);
              }}>
                Open in Mail App
              </button>
            )}
            <button className="btn-secondary" onClick={onClose}>Later</button>
          </div>
        </>
      ) : (
        <div className="action-row">
          <a href="/email" className="btn-primary btn-send" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
            Go to Inbox
          </a>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      )}
    </div>
  );
}

function OrderBody({ item, onClose }) {
  const ctx = item.context || {};
  const [advancing, setAdvancing] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const NEXT_STATUS = {
    not_started:    "design_needed",
    design_needed:  "ready_to_laser",
    ready_to_laser: "in_production",
    in_production:  "ready_to_ship",
    ready_to_ship:  "shipped",
  };

  const NEXT_LABELS = {
    not_started:    "Advance to Design Check",
    design_needed:  "Mark Ready to Laser",
    ready_to_laser: "Mark In Production",
    in_production:  "Mark QC / Pack",
    ready_to_ship:  "Mark Shipped",
  };

  const nextStatus = NEXT_STATUS[ctx.productionStatus];
  const nextLabel = NEXT_LABELS[ctx.productionStatus] || "Advance";

  const handleAdvance = useCallback(async () => {
    if (!nextStatus || advancing || advanced) return;
    setAdvancing(true);
    try {
      const res = await fetch("/api/orders/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: ctx.orderId, status: nextStatus }),
      });
      if (res.ok) setAdvanced(true);
    } catch {}
    finally { setAdvancing(false); }
  }, [ctx, nextStatus, advancing, advanced]);

  const statusClass = {
    pending_approval: "pill-amber", needs_info: "pill-amber",
    awaiting_proof_approval: "pill-purple", in_production: "pill-teal",
    shipped: "pill-green", complete: "pill-green",
  }[ctx.productionStatus] || "pill-gray";

  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="detail-grid">
        {ctx.heroName && <div className="detail-item"><span className="detail-label">Hero</span><span className="detail-value">{ctx.heroName}</span></div>}
        {ctx.quantity && <div className="detail-item"><span className="detail-label">Quantity</span><span className="detail-value">{ctx.quantity}</span></div>}
        {ctx.orderValue != null && <div className="detail-item"><span className="detail-label">Value</span><span className="detail-value">{fmt(ctx.orderValue)}</span></div>}
        {ctx.sku && <div className="detail-item"><span className="detail-label">SKU</span><span className="detail-value">{ctx.sku}</span></div>}
      </div>
      {ctx.productionStatus && (
        <div style={{ marginBottom: 12 }}>
          <span className={`status-pill ${statusClass}`}>{(ctx.productionStatus || "").replace(/_/g, " ")}</span>
        </div>
      )}
      {ctx.notes && <div className="detail-notes">{ctx.notes}</div>}
      <div className="action-row">
        {nextStatus && (
          <button className="btn-primary btn-send" onClick={handleAdvance} disabled={advancing || advanced}>
            {advanced ? "✓ Advanced" : advancing ? "Saving..." : nextLabel}
          </button>
        )}
        <a href={`/orders`} className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
          View Orders
        </a>
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function AnniversaryBody({ item, onClose }) {
  const ctx = item.context || {};
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);

  const handleMarkSent = useCallback(async () => {
    if (!ctx.heroId || marking || marked) return;
    setMarking(true);
    try {
      const res = await fetch("/api/anniversaries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroId: ctx.heroId, status: "email_sent" }),
      });
      if (res.ok) setMarked(true);
    } catch {}
    finally { setMarking(false); }
  }, [ctx, marking, marked]);

  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="detail-grid">
        {ctx.heroName && <div className="detail-item"><span className="detail-label">Hero</span><span className="detail-value">{ctx.heroName}</span></div>}
        {ctx.dateStr && <div className="detail-item"><span className="detail-label">Anniversary</span><span className="detail-value">{ctx.dateStr}</span></div>}
        {ctx.daysUntil != null && (
          <div className="detail-item">
            <span className="detail-label">Days Away</span>
            <span className="detail-value" style={{ color: ctx.daysUntil <= 3 ? "#ef4444" : "#e8eaed" }}>
              {ctx.daysUntil === 0 ? "Today" : ctx.daysUntil === 1 ? "Tomorrow" : `${ctx.daysUntil} days`}
            </span>
          </div>
        )}
        {ctx.familyContact && <div className="detail-item"><span className="detail-label">Family Contact</span><span className="detail-value">{ctx.familyContact}</span></div>}
        {ctx.familyEmail && <div className="detail-item"><span className="detail-label">Email</span><span className="detail-value" style={{ wordBreak: "break-all", fontSize: 12 }}>{ctx.familyEmail}</span></div>}
        {ctx.status && <div className="detail-item"><span className="detail-label">Outreach Status</span><span className="detail-value">{(ctx.status || "").replace(/_/g, " ")}</span></div>}
      </div>
      <div className="action-row">
        <a href="/anniversaries" className="btn-primary btn-send" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
          Draft Outreach
        </a>
        <button className="btn-primary" style={{ background: "#22c55e" }} onClick={handleMarkSent} disabled={marking || marked}>
          {marked ? "✓ Marked Sent" : marking ? "Saving..." : "Mark Sent"}
        </button>
        <button className="btn-secondary" onClick={onClose}>Defer</button>
      </div>
    </div>
  );
}

function DesignBody({ item, onClose }) {
  const ctx = item.context || {};

  const pingMessage = `Hey Ryan — following up on the ${ctx.sku || ctx.heroName || "design"} brief. Any update on the proof? Need to get into production.`;

  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="detail-grid">
        {ctx.heroName && <div className="detail-item"><span className="detail-label">Hero</span><span className="detail-value">{ctx.heroName}</span></div>}
        {ctx.sku && <div className="detail-item"><span className="detail-label">SKU</span><span className="detail-value">{ctx.sku}</span></div>}
        {ctx.designStatus && <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value">{(ctx.designStatus || "").replace(/_/g, " ")}</span></div>}
        {ctx.designPriority && <div className="detail-item"><span className="detail-label">Priority</span><span className="detail-value">{ctx.designPriority}</span></div>}
      </div>
      {ctx.designBrief && <div className="detail-notes">{ctx.designBrief}</div>}
      <div className="action-row">
        <button className="btn-primary btn-send" onClick={() => {
          navigator.clipboard?.writeText(pingMessage);
          window.open("https://slack.com/app_redirect?channel=ryan", "_blank");
        }}>
          Ping Ryan (Slack)
        </button>
        <a href="/designs" className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
          Design Queue
        </a>
        <button className="btn-secondary" onClick={onClose}>Defer</button>
      </div>
    </div>
  );
}

function TaskBody({ item, onClose }) {
  const ctx = item.context || {};
  const [subtasks, setSubtasks] = useState(ctx.subtasks || []);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);
  const toggle = (id) => setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));

  const handleMarkDone = useCallback(async () => {
    if (!ctx.taskId || marking || marked) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/tasks/${ctx.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (res.ok) {
        setMarked(true);
        setTimeout(onClose, 600);
      }
    } catch {}
    finally { setMarking(false); }
  }, [ctx.taskId, marking, marked, onClose]);

  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="detail-grid">
        {ctx.role && <div className="detail-item"><span className="detail-label">Role</span><span className="detail-value">{ctx.role}</span></div>}
        {ctx.dueDate && <div className="detail-item"><span className="detail-label">Due</span><span className="detail-value">{fmtDate(ctx.dueDate)}</span></div>}
        {ctx.status && <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value">{ctx.status}</span></div>}
      </div>
      {ctx.notes && <div className="detail-notes">{ctx.notes}</div>}
      {ctx.source && <div className="detail-notes">Source: {ctx.source}</div>}
      {subtasks.length > 0 && (
        <div style={{ paddingTop: 4, paddingBottom: 12 }}>
          {subtasks.map((s) => (
            <div key={s.id} onClick={() => toggle(s.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${s.done ? "#22c55e" : "rgba(255,255,255,0.2)"}`, background: s.done ? "#22c55e" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 700, transition: "all 0.15s" }}>
                {s.done ? "✓" : ""}
              </div>
              <span style={{ fontSize: 13, color: s.done ? "#4b5563" : "#9ca3af", textDecoration: s.done ? "line-through" : "none" }}>{s.text}</span>
            </div>
          ))}
        </div>
      )}
      <div className="action-row">
        {ctx.taskId && (
          <button className="btn-primary btn-send" style={{ background: "#22c55e" }} onClick={handleMarkDone} disabled={marking || marked}>
            {marked ? "✓ Done" : marking ? "Saving..." : "Mark Done"}
          </button>
        )}
        <a href="/tasks" className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>View Tasks</a>
        <button className="btn-secondary" onClick={onClose}>Close</button>
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
        {ctx.dueDate && <div className="detail-item"><span className="detail-label">Due Date</span><span className="detail-value">{fmtDate(ctx.dueDate)}</span></div>}
        {ctx.daysUntilDue != null && (
          <div className="detail-item">
            <span className="detail-label">Days Until Due</span>
            <span className="detail-value" style={{ color: ctx.daysUntilDue < 0 ? "#ef4444" : ctx.daysUntilDue <= 7 ? "#f59e0b" : "#e8eaed" }}>
              {ctx.daysUntilDue < 0 ? `${Math.abs(ctx.daysUntilDue)}d overdue` : `${ctx.daysUntilDue} days`}
            </span>
          </div>
        )}
        {ctx.status && <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value">{ctx.status}</span></div>}
        {ctx.authority && <div className="detail-item"><span className="detail-label">Authority</span><span className="detail-value">{ctx.authority}</span></div>}
      </div>
      {ctx.notes && <div className="detail-notes">{ctx.notes}</div>}
      <div className="action-row"><button className="btn-secondary" onClick={onClose}>Close</button></div>
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
        {ctx.address && <div className="detail-item"><span className="detail-label">Address</span><span className="detail-value">{ctx.address}</span></div>}
        {ctx.tenant && <div className="detail-item"><span className="detail-label">Tenant</span><span className="detail-value">{ctx.tenant}</span></div>}
        {ctx.rentAmount != null && <div className="detail-item"><span className="detail-label">Rent</span><span className="detail-value">{fmt(ctx.rentAmount)}/mo</span></div>}
        {cashflow != null && (
          <div className="detail-item">
            <span className="detail-label">Cash Flow</span>
            <span className={`detail-value ${cashflow >= 0 ? "cashflow-pos" : "cashflow-neg"}`}>{fmt(cashflow)}/mo</span>
          </div>
        )}
        {ctx.leaseEnd && <div className="detail-item"><span className="detail-label">Lease End</span><span className="detail-value">{fmtDate(ctx.leaseEnd)}</span></div>}
        {ctx.status && <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value">{ctx.status}</span></div>}
      </div>
      {ctx.notes && <div className="detail-notes">{ctx.notes}</div>}
      <div className="action-row"><button className="btn-secondary" onClick={onClose}>Close</button></div>
    </div>
  );
}

function FinancialBody({ item, onClose }) {
  const ctx = item.context || {};
  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="detail-grid">
        {ctx.vendor && <div className="detail-item"><span className="detail-label">Vendor / Contact</span><span className="detail-value">{ctx.vendor}</span></div>}
        {ctx.amount != null && <div className="detail-item"><span className="detail-label">Amount</span><span className="detail-value" style={{ color: "#f59e0b" }}>{fmt(ctx.amount)}</span></div>}
        {ctx.deadline && <div className="detail-item"><span className="detail-label">Deadline</span><span className="detail-value" style={{ color: "#ef4444" }}>{fmtDate(ctx.deadline)}</span></div>}
      </div>
      {ctx.notes && <div className="detail-notes">{ctx.notes}</div>}
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
        <a href="/gyst" className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>View GYST</a>
        <button className="btn-secondary" onClick={onClose}>Close</button>
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
        {ctx.dueDate && <div className="detail-item"><span className="detail-label">Due</span><span className="detail-value">{fmtDate(ctx.dueDate)}</span></div>}
        {ctx.category && <div className="detail-item"><span className="detail-label">Category</span><span className="detail-value">{ctx.category}</span></div>}
      </div>
      <div className="action-row">
        <a href="/gyst" className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>View GYST</a>
        <button className="btn-secondary" onClick={onClose}>Close</button>
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
          <a href={ctx.htmlLink} target="_blank" rel="noreferrer" className="btn-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
            Open in Calendar
          </a>
        )}
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function DonorBody({ item, onClose }) {
  const ctx = item.context || {};
  return (
    <div className="card-expand-body">
      <div className="expand-separator" />
      <div className="detail-grid">
        {ctx.donorName && <div className="detail-item"><span className="detail-label">Donor</span><span className="detail-value">{ctx.donorName}</span></div>}
        {ctx.amount != null && <div className="detail-item"><span className="detail-label">Amount</span><span className="detail-value" style={{ color: "#22c55e" }}>{fmt(ctx.amount)}</span></div>}
        {ctx.campaign && <div className="detail-item"><span className="detail-label">Campaign</span><span className="detail-value">{ctx.campaign}</span></div>}
        {ctx.donationDate && <div className="detail-item"><span className="detail-label">Date</span><span className="detail-value">{fmtDate(ctx.donationDate)}</span></div>}
        {ctx.donorEmail && <div className="detail-item"><span className="detail-label">Email</span><span className="detail-value" style={{ fontSize: 12 }}>{ctx.donorEmail}</span></div>}
        {ctx.donorSegment && <div className="detail-item"><span className="detail-label">Segment</span><span className="detail-value">{ctx.donorSegment}</span></div>}
      </div>
      {ctx.notes && <div className="detail-notes">{ctx.notes}</div>}
      <div className="action-row">
        <a href="/finance/donations" className="btn-primary btn-send" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
          Send Thank-You
        </a>
        <button className="btn-secondary" onClick={onClose}>Defer</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI strip (compact)
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub, health, active, onClick }) {
  const healthColor = { green: "#22c55e", amber: "#f59e0b", red: "#ef4444", blue: "#3b82f6", neutral: "#4b5563" }[health] || "#4b5563";
  return (
    <button className={`kpi-card${active ? " kpi-card-active" : ""}`} onClick={onClick}>
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

  const fmtC = (n) => n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const fmtN = (n) => (n == null ? "—" : n.toLocaleString());
  const month = new Date().toLocaleString("en-US", { month: "long" });

  const cards = [
    { label: "Heroes Honored", value: fmtN(kpis.heroesHonored), sub: "active listings", health: "blue", detail: `${fmtN(kpis.heroesHonored)} heroes actively listed.` },
    { label: "Bracelets Shipped", value: fmtN(kpis.braceletsShipped), sub: month, health: kpis.braceletsShipped > 0 ? "green" : "amber", detail: `${fmtN(kpis.braceletsShipped)} shipped in ${month}.` },
    { label: "In Pipeline", value: fmtN(kpis.pipelineTotal), sub: "orders", health: kpis.pipelineTotal === 0 ? "neutral" : kpis.pipelineTotal <= 5 ? "amber" : "red", detail: kpis.pipeline ? Object.entries(kpis.pipeline).map(([s, c]) => `${s.replace(/_/g, " ")}: ${c}`).join("\n") : "No orders." },
    { label: "Revenue", value: fmtC(kpis.revenueThisMonth), sub: month, health: kpis.revenueThisMonth > 500 ? "green" : kpis.revenueThisMonth > 0 ? "amber" : "neutral", detail: `${fmtC(kpis.revenueThisMonth)} in ${month}.` },
    { label: "Donations", value: fmtC(kpis.donationsThisMonth), sub: month, health: kpis.donationsThisMonth > 0 ? "green" : "amber", detail: `${fmtC(kpis.donationsThisMonth)} donated in ${month}.` },
    { label: "Thank-Yous Due", value: fmtN(kpis.pendingThanks), health: kpis.pendingThanks === 0 ? "green" : kpis.pendingThanks <= 3 ? "amber" : "red", detail: kpis.pendingThanks === 0 ? "All donors thanked." : `${fmtN(kpis.pendingThanks)} need thank-yous.` },
    { label: "Family Messages", value: fmtN(kpis.familyMessagesPending), health: kpis.familyMessagesPending === 0 ? "green" : "red", detail: kpis.familyMessagesPending === 0 ? "No pending messages." : `${fmtN(kpis.familyMessagesPending)} need attention.` },
    { label: "Anniversaries", value: fmtN(kpis.anniversaryEmailsDue), sub: "next 14d", health: kpis.anniversaryEmailsDue === 0 ? "green" : "red", detail: kpis.anniversaryEmailsDue === 0 ? "No anniversaries due." : `${kpis.anniversaryEmailsDue} due in next 14 days.` },
  ];

  const activeCard = activeIdx !== null ? cards[activeIdx] : null;

  return (
    <div className="kpi-section">
      <div className="kpi-row">
        {cards.map((c, i) => (
          <KpiCard key={c.label} label={c.label} value={c.value} sub={c.sub} health={c.health} active={activeIdx === i} onClick={() => setActiveIdx(activeIdx === i ? null : i)} />
        ))}
      </div>
      {activeCard && (
        <div className="kpi-detail-panel">
          <div className="kpi-detail-heading">{activeCard.label}</div>
          <div className="kpi-detail-text">{activeCard.detail.split("\n").map((line, i) => <div key={i}>{line}</div>)}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Triage Card
// ---------------------------------------------------------------------------

function TriageCard({ item, expanded, onExpand, onCollapse }) {
  function renderBody() {
    const onClose = onCollapse;
    switch (item.type) {
      case "EMAIL":       return <EmailBody item={item} onClose={onClose} />;
      case "ORDER":       return <OrderBody item={item} onClose={onClose} />;
      case "ANNIVERSARY": return <AnniversaryBody item={item} onClose={onClose} />;
      case "DESIGN":      return <DesignBody item={item} onClose={onClose} />;
      case "TASK":        return <TaskBody item={item} onClose={onClose} />;
      case "COMPLIANCE":  return <ComplianceBody item={item} onClose={onClose} />;
      case "PROPERTY":    return <PropertyBody item={item} onClose={onClose} />;
      case "FINANCIAL":   return <FinancialBody item={item} onClose={onClose} />;
      case "GYST":        return <GystBody item={item} onClose={onClose} />;
      case "CALENDAR":    return <CalendarBody item={item} onClose={onClose} />;
      case "DONOR":       return <DonorBody item={item} onClose={onClose} />;
      default:            return <TaskBody item={item} onClose={onClose} />;
    }
  }

  return (
    <div
      className={`today-card ${urgencyClass(item.urgency)} ${expanded ? "expanded" : ""}`}
      style={{ "--card-accent": item.accentColor || "rgba(255,255,255,0.15)" }}
      onClick={!expanded ? onExpand : undefined}
    >
      {/* Collapsed header — always visible */}
      <div className="card-collapsed" style={expanded ? { cursor: "default" } : {}}>
        <span className="card-icon">{item.icon}</span>
        <div className="card-main">
          <div className="card-title-row">
            <div className="card-title">{item.title}</div>
            {item.badgeLabel && (
              <span className={`card-badge ${item.badgeClass || "badge-week"}`}>{item.badgeLabel}</span>
            )}
            {expanded && (
              <button className="btn-collapse" onClick={(e) => { e.stopPropagation(); onCollapse(); }}>↑</button>
            )}
          </div>
          {item.subtitle && <div className="card-subtitle">{item.subtitle}</div>}
          {item.brief && (
            <div className="card-brief">
              <span className="operator-label">Operator</span>
              {item.brief}
            </div>
          )}
          {item.pipeline && <PipelineBar pipeline={item.pipeline} />}
        </div>
      </div>

      {/* Expandable body */}
      <div className={`card-expand-wrapper ${expanded ? "open" : ""}`}>
        <div className="card-expand-inner">{renderBody()}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

const SECTION_CONFIG = {
  TODAY:   { label: "Act Now",    color: "#ef4444" },
  WEEK:    { label: "This Week",  color: "#f59e0b" },
  TRACKED: { label: "Coming Up",  color: "#22c55e" },
};

function Section({ sectionKey, items, expandedId, onExpand, onCollapse }) {
  const cfg = SECTION_CONFIG[sectionKey] || { label: sectionKey, color: "#6b7280" };
  if (!items?.length) return null;

  return (
    <div>
      <div className="section-header">
        <span className="section-label" style={{ color: cfg.color }}>{cfg.label}</span>
        <div className="section-divider" style={{ background: cfg.color }} />
        <span style={{ fontSize: 11, color: "#374151", flexShrink: 0 }}>{items.length}</span>
      </div>
      {items.map((item) => (
        <TriageCard
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
      if (res.ok) setData(await res.json());
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Supabase realtime — refresh feed when any task changes
  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel("feed-tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        load(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const actNow    = (data?.items || []).filter((i) => i.section === "TODAY");
  const thisWeek  = (data?.items || []).filter((i) => i.section === "WEEK");
  const comingUp  = (data?.items || []).filter((i) => i.section === "TRACKED");

  const totalActionable = actNow.length + thisWeek.length;
  const overdueCount = actNow.filter((i) => i.urgency === "OVERDUE").length;

  const handleExpand = useCallback((id) => setExpandedId(id), []);
  const handleCollapse = useCallback(() => setExpandedId(null), []);

  if (loading) {
    return (
      <div className="today-shell">
        <div className="loading-shell">
          <div className="loading-ring" />
          <span className="loading-text">Building your triage queue…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="today-shell">
      {/* Sticky header */}
      <div className="today-header">
        <div className="today-datestr">{data?.dateLabel || "Today"}</div>
        <div className="today-title-row">
          <span className="today-title">Feed</span>
          <span className="today-counts">
            {overdueCount > 0 && (
              <span className="today-count-badge">
                <span className="dot" style={{ background: "#ef4444" }} />
                <span style={{ color: "#ef4444" }}>{overdueCount} overdue</span>
              </span>
            )}
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <KpiRow kpis={data?.kpis} />

      {/* Attention banner */}
      {totalActionable > 0 && (
        <div className="attention-banner">
          <span className="attention-count">{totalActionable}</span>
          <span className="attention-text">
            item{totalActionable !== 1 ? "s" : ""} need{totalActionable === 1 ? "s" : ""} your attention
          </span>
          {overdueCount > 0 && (
            <span className="attention-overdue">{overdueCount} overdue</span>
          )}
        </div>
      )}

      {/* Feed */}
      <div className="today-body">
        <Section sectionKey="TODAY"   items={actNow}   expandedId={expandedId} onExpand={handleExpand} onCollapse={handleCollapse} />
        <Section sectionKey="WEEK"    items={thisWeek} expandedId={expandedId} onExpand={handleExpand} onCollapse={handleCollapse} />
        <Section sectionKey="TRACKED" items={comingUp} expandedId={expandedId} onExpand={handleExpand} onCollapse={handleCollapse} />

        {!data?.items?.length && (
          <div className="section-empty" style={{ marginTop: 40, fontSize: 15 }}>
            Nothing on the radar. Clean slate.
          </div>
        )}
      </div>

      {/* Refresh FAB */}
      <button className={`refresh-fab ${refreshing ? "spinning" : ""}`} onClick={() => load(true)} title="Refresh" aria-label="Refresh feed">
        ↻
      </button>
    </div>
  );
}
