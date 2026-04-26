"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getBrowserClient } from "@/lib/supabase";
import "./today.css";

const DOT_COLOR = { red: "#ef4444", yellow: "#f59e0b", gray: "#6b7280" };
const INITIAL_VISIBLE = 7;

function dotFor(item) {
  if (item.section === "TODAY" || item.urgency === "OVERDUE") return "red";
  if (item.section === "WEEK"  || item.urgency === "WEEK")    return "yellow";
  return "gray";
}

function actionsFor(item) {
  const ctx = item.context || {};
  switch (item.type) {
    case "EMAIL":
      return {
        primary: ctx.draftText && ctx.threadId ? {
          label: "Send",
          fn: () => fetch("/api/email", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "send", threadId: ctx.threadId, body: ctx.draftText }),
          }).then((r) => r.ok),
        } : null,
        openHref: "/email",
      };
    case "ORDER": {
      const NEXT = { not_started: "design_needed", design_needed: "ready_to_laser", ready_to_laser: "in_production", in_production: "ready_to_ship", ready_to_ship: "shipped" };
      const next = NEXT[ctx.productionStatus];
      return {
        primary: next && ctx.orderId ? {
          label: "Advance",
          fn: () => fetch("/api/orders/status", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: ctx.orderId, status: next }),
          }).then((r) => r.ok),
        } : null,
        openHref: "/orders",
      };
    }
    case "ANNIVERSARY":
      return {
        primary: ctx.heroId ? {
          label: "Mark Sent",
          fn: () => fetch("/api/anniversaries", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ heroId: ctx.heroId, status: "email_sent" }),
          }).then((r) => r.ok),
        } : null,
        openHref: "/anniversaries",
      };
    case "TASK":
      return {
        primary: ctx.taskId ? {
          label: "Done",
          fn: () => fetch(`/api/tasks/${ctx.taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "done" }),
          }).then((r) => r.ok),
        } : null,
        openHref: "/tasks",
      };
    case "DESIGN":   return { primary: null, openHref: "/designs" };
    case "DONOR":    return { primary: null, openHref: "/finance/donations" };
    case "CALENDAR": return { primary: null, openHref: ctx.htmlLink || null };
    case "PROPERTY":
    case "FINANCIAL":
    case "GYST":     return { primary: null, openHref: "/gyst" };
    default:         return { primary: null, openHref: null };
  }
}

function FeedItem({ item, expanded, onToggle, onSkip }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { primary, openHref } = useMemo(() => actionsFor(item), [item]);
  const color = dotFor(item);

  if (done) return null;

  async function handlePrimary(e) {
    e.stopPropagation();
    if (!primary || busy) return;
    setBusy(true);
    try {
      const ok = await primary.fn();
      if (ok) setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`feed-item ${expanded ? "is-expanded" : ""}`}>
      <button className="feed-row" onClick={onToggle} aria-expanded={expanded}>
        <span className="feed-dot" style={{ background: DOT_COLOR[color] }} />
        <span className="feed-title">{item.title}</span>
      </button>
      {expanded && (
        <div className="feed-body">
          {item.brief && <p className="feed-brief">{item.brief}</p>}
          <div className="feed-actions">
            {primary && (
              <button className="act-primary" onClick={handlePrimary} disabled={busy}>
                {busy ? "…" : primary.label}
              </button>
            )}
            {openHref && (
              <a
                className="act-open"
                href={openHref}
                target={openHref.startsWith("http") ? "_blank" : undefined}
                rel={openHref.startsWith("http") ? "noreferrer" : undefined}
                onClick={(e) => e.stopPropagation()}
              >
                Open
              </a>
            )}
            <button className="act-skip" onClick={(e) => { e.stopPropagation(); onSkip(); }}>
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TodayPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [skipped, setSkipped] = useState(() => new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/today");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Supabase realtime — refresh feed when any task changes
  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel("feed-tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const sorted = useMemo(() => {
    const order = { red: 0, yellow: 1, gray: 2 };
    return items
      .filter((i) => !skipped.has(i.id))
      .sort((a, b) => {
        const oa = order[dotFor(a)] ?? 2;
        const ob = order[dotFor(b)] ?? 2;
        if (oa !== ob) return oa - ob;
        return (b.priority || 0) - (a.priority || 0);
      });
  }, [items, skipped]);

  const visible = showAll ? sorted : sorted.slice(0, INITIAL_VISIBLE);
  const hidden  = sorted.length - visible.length;

  const handleSkip = useCallback((id) => {
    setSkipped((prev) => { const next = new Set(prev); next.add(id); return next; });
    setExpandedId((cur) => (cur === id ? null : cur));
  }, []);

  if (loading) {
    return <div className="feed-shell"><div className="feed-status">Loading…</div></div>;
  }

  if (sorted.length === 0) {
    return <div className="feed-shell"><div className="feed-status">All clear.</div></div>;
  }

  return (
    <div className="feed-shell">
      {visible.map((item) => (
        <FeedItem
          key={item.id}
          item={item}
          expanded={expandedId === item.id}
          onToggle={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
          onSkip={() => handleSkip(item.id)}
        />
      ))}
      {hidden > 0 && (
        <button className="feed-more" onClick={() => setShowAll(true)}>
          Show {hidden} more
        </button>
      )}
    </div>
  );
}
