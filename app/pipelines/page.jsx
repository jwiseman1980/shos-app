"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getBrowserClient } from "@/lib/supabase";
import "./pipelines.css";

// ---------------------------------------------------------------------------
// Pipeline definitions (keep in sync with /api/pipelines)
// ---------------------------------------------------------------------------

const ORDER_STAGES = ["Intake", "Design Check", "Ready to Laser", "In Production", "QC / Pack", "Shipped"];
const DESIGN_STAGES = ["Brief Needed", "Brief Sent", "In Progress", "Proof Ready", "Approved"];
const ANNIVERSARY_STAGES = ["Not Started", "Prep", "Drafted", "Sent", "Complete"];
const HERO_STAGES = ["Intake", "Design", "Live"];

const PIPELINE_DEFS = [
  { key: "orders",        name: "Orders",                icon: "📦", color: "#22c55e", stages: ORDER_STAGES,       href: "/orders" },
  { key: "designs",       name: "Designs",               icon: "🎨", color: "#a855f7", stages: DESIGN_STAGES,      href: "/designs" },
  { key: "anniversaries", name: "Anniversary Outreach",  icon: "🎖️", color: "#3b82f6", stages: ANNIVERSARY_STAGES, href: "/anniversaries" },
  { key: "heroes",        name: "Heroes",                icon: "⭐",  color: "#c4a237", stages: HERO_STAGES,        href: "/heroes" },
];

// Next status per production stage (order_items.production_status enum)
const ORDER_NEXT = {
  not_started:    "design_needed",
  design_needed:  "ready_to_laser",
  ready_to_laser: "in_production",
  in_production:  "ready_to_ship",
  ready_to_ship:  "shipped",
};

// ---------------------------------------------------------------------------
// Stage column
// ---------------------------------------------------------------------------

function StageColumn({ stage, items, color, onItemClick, onAdvance, onShip, expandedId, busyIds, justMovedIds }) {
  const count = items.length;
  return (
    <div className="stage-col">
      <div className="stage-header" style={{ borderTopColor: color }}>
        <span className="stage-name">{stage}</span>
        {count > 0 && <span className="stage-count" style={{ background: color + "22", color }}>{count}</span>}
      </div>
      <div className="stage-items">
        {items.map((item) => (
          <PipelineItem
            key={item.id}
            item={item}
            color={color}
            expanded={expandedId === item.id}
            busy={busyIds.has(item.id)}
            justMoved={justMovedIds.has(item.id)}
            onClick={() => onItemClick(item.id)}
            onAdvance={() => onAdvance(item)}
            onShip={() => onShip(item)}
          />
        ))}
        {items.length === 0 && <div className="stage-empty">—</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline item card — with Advance / Push to ShipStation buttons
// ---------------------------------------------------------------------------

function PipelineItem({ item, color, expanded, busy, justMoved, onClick, onAdvance, onShip }) {
  const canAdvance = canItemAdvance(item);
  const canShip = canItemShip(item);

  return (
    <div
      className={`pipeline-item ${expanded ? "pi-expanded" : ""} ${justMoved ? "pi-just-moved" : ""}`}
      style={{ "--pi-color": color }}
      onClick={onClick}
    >
      <div className="pi-title">{item.title}</div>
      {item.subtitle && <div className="pi-subtitle">{item.subtitle}</div>}
      {(item.productionStatus || item.designStatus || item.anniversaryStatus || item.lifecycleStage) && (
        <span className="pi-stage-pill">
          {(item.productionStatus || item.designStatus || item.anniversaryStatus || item.lifecycleStage).replace(/_/g, " ")}
        </span>
      )}
      {expanded && item.brief && (
        <div className="pi-brief">
          <span className="operator-label-sm">Operator</span>
          {item.brief}
        </div>
      )}

      {(canAdvance || canShip) && (
        <div className="pi-action-row" onClick={(e) => e.stopPropagation()}>
          {canAdvance && (
            <button
              className="pi-btn pi-btn-advance"
              disabled={busy}
              onClick={onAdvance}
              title={advanceTitle(item)}
            >
              {busy ? "Moving…" : `Advance →`}
            </button>
          )}
          {canShip && (
            <button
              className="pi-btn pi-btn-ship"
              disabled={busy || !item.hasShipAddress}
              onClick={onShip}
              title={item.hasShipAddress ? "Push to ShipStation" : "No shipping address on file"}
            >
              {busy ? "Pushing…" : "🚀 Push to ShipStation"}
            </button>
          )}
        </div>
      )}

      {expanded && item.actions?.length > 0 && (
        <div className="pi-actions">
          {item.actions.map((action) => (
            <a key={action.label} href={action.href} className="pi-action-btn" onClick={(e) => e.stopPropagation()}>
              {action.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function canItemAdvance(item) {
  if (item.pipeline === "orders") {
    return Boolean(ORDER_NEXT[item.productionStatus]);
  }
  if (item.pipeline === "designs" && item.heroId) {
    return item.designStatus !== "complete";
  }
  if (item.pipeline === "anniversaries" && (item.heroId || item.sfId)) {
    return item.anniversaryStatus !== "complete";
  }
  if (item.pipeline === "heroes" && item.heroId) {
    return item.lifecycleStage !== "live";
  }
  return false;
}

function canItemShip(item) {
  return (
    item.pipeline === "orders" &&
    item.orderType === "donated" &&
    item.productionStatus === "ready_to_ship" &&
    Boolean(item.orderId)
  );
}

function advanceTitle(item) {
  if (item.pipeline === "orders") {
    const next = ORDER_NEXT[item.productionStatus];
    return next ? `Move to ${next.replace(/_/g, " ")}` : "Already at final stage";
  }
  if (item.pipeline === "designs") return "Advance design status";
  if (item.pipeline === "anniversaries") return "Advance anniversary status";
  if (item.pipeline === "heroes") return "Advance hero lifecycle";
  return "";
}

// ---------------------------------------------------------------------------
// Pipeline section (collapsible)
// ---------------------------------------------------------------------------

function PipelineSection({ def, data, expandedId, onItemClick, onAdvance, onShip, busyIds, justMovedIds }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalItems = data ? Object.values(data).reduce((sum, arr) => sum + arr.length, 0) : 0;

  return (
    <div className="pipeline-section">
      <div className="ps-header" onClick={() => setCollapsed((v) => !v)}>
        <span className="ps-icon">{def.icon}</span>
        <span className="ps-name">{def.name}</span>
        <span className="ps-count">{totalItems}</span>
        <span className="ps-toggle" style={{ color: def.color }}>{collapsed ? "▸" : "▾"}</span>
        <a href={def.href} className="ps-link" onClick={(e) => e.stopPropagation()}>
          Full view →
        </a>
      </div>

      {!collapsed && (
        <div className="ps-stages">
          {def.stages.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              items={data?.[stage] || []}
              color={def.color}
              expandedId={expandedId}
              busyIds={busyIds}
              justMovedIds={justMovedIds}
              onItemClick={onItemClick}
              onAdvance={onAdvance}
              onShip={onShip}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

async function fetchPipelineData() {
  const res = await fetch("/api/pipelines", { cache: "no-store" });
  if (!res.ok) throw new Error(`Pipeline API failed: ${res.status}`);
  return res.json();
}

export default function PipelinesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [justMovedIds, setJustMovedIds] = useState(() => new Set());
  const [live, setLive] = useState(false);
  const justMovedTimers = useRef(new Map());

  const load = useCallback(async () => {
    try {
      const d = await fetchPipelineData();
      setData(d);
    } catch {
      // Keep prior data on error rather than blanking out
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark a card as "just moved" — pulses for 2.4s
  const flashMoved = useCallback((itemId) => {
    setJustMovedIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
    if (justMovedTimers.current.has(itemId)) {
      clearTimeout(justMovedTimers.current.get(itemId));
    }
    const t = setTimeout(() => {
      setJustMovedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      justMovedTimers.current.delete(itemId);
    }, 2400);
    justMovedTimers.current.set(itemId, t);
  }, []);

  const setBusy = useCallback((id, isBusy) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  // -------- Initial load + polling fallback --------
  useEffect(() => {
    load();
    const poll = setInterval(load, 30_000);
    return () => clearInterval(poll);
  }, [load]);

  // -------- Supabase Realtime: live updates from anywhere (chat, button, cron) --------
  useEffect(() => {
    let sb;
    try {
      sb = getBrowserClient();
    } catch {
      return; // No keys — fall back to polling
    }

    const debounced = (() => {
      let t = null;
      return (id) => {
        if (id) flashMoved(id);
        if (t) return;
        t = setTimeout(() => { t = null; load(); }, 350);
      };
    })();

    const channel = sb
      .channel("pipelines-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "heroes" }, (payload) => {
        const id = payload.new?.id || payload.old?.id;
        if (id) {
          // Match the front-end ID convention
          ["hero-intake-", "hero-design-", "hero-live-", "design-", "anniversary-"].forEach((p) => debounced(p + id));
        } else {
          debounced();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, (payload) => {
        const id = payload.new?.id || payload.old?.id;
        debounced(id ? `order-${id}` : null);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => debounced())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLive(true);
        else if (status === "CHANNEL_ERROR" || status === "CLOSED") setLive(false);
      });

    return () => {
      setLive(false);
      sb.removeChannel(channel);
    };
  }, [load, flashMoved]);

  // -------- Listen for chat-driven pipeline_change events --------
  useEffect(() => {
    function onChatPipelineChange() {
      load();
    }
    window.addEventListener("shos:pipeline_change", onChatPipelineChange);
    return () => window.removeEventListener("shos:pipeline_change", onChatPipelineChange);
  }, [load]);

  // -------- Item actions --------
  const handleAdvance = useCallback(async (item) => {
    setBusy(item.id, true);
    try {
      if (item.pipeline === "orders") {
        const next = ORDER_NEXT[item.productionStatus];
        if (!next) return;
        await fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: item.itemId, status: next, heroName: item.heroName }),
        });
      } else if (item.pipeline === "designs" && item.heroId) {
        await fetch("/api/heroes/workflow", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hero_id: item.heroId, workflow: "design", direction: "next" }),
        });
      } else if (item.pipeline === "anniversaries" && item.heroId) {
        await fetch("/api/heroes/workflow", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hero_id: item.heroId, workflow: "anniversary", direction: "next" }),
        });
      } else if (item.pipeline === "heroes" && item.heroId) {
        await fetch("/api/heroes/workflow", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hero_id: item.heroId, workflow: "lifecycle", direction: "next" }),
        });
      }
      flashMoved(item.id);
      // Realtime should refresh on its own; load() is a safety net
      await load();
    } catch (e) {
      console.error("Advance failed:", e);
    } finally {
      setBusy(item.id, false);
    }
  }, [flashMoved, load, setBusy]);

  const handleShip = useCallback(async (item) => {
    if (!item.orderId) return;
    setBusy(item.id, true);
    try {
      const res = await fetch("/api/orders/push-shipstation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: item.orderId }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.success) {
        // Auto-advance to shipped after a successful push
        await fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: item.itemId, status: "shipped", heroName: item.heroName }),
        });
        flashMoved(item.id);
      }
      await load();
    } catch (e) {
      console.error("Push to ShipStation failed:", e);
    } finally {
      setBusy(item.id, false);
    }
  }, [flashMoved, load, setBusy]);

  const handleItemClick = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (loading && !data) {
    return (
      <div className="pipelines-shell">
        <div className="pipelines-loading">
          <div className="loading-ring-gold" />
          <span>Loading pipelines…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pipelines-shell">
      <div className="pipelines-header">
        <div className="pipelines-datestr">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div className="pipelines-title">
          Pipelines
          {live && <span className="pipelines-live">Live</span>}
        </div>
        <p className="pipelines-sub">All active workflows — tap any card for details, or talk to the Operator.</p>
      </div>

      <div className="pipelines-body">
        {PIPELINE_DEFS.map((def) => (
          <PipelineSection
            key={def.key}
            def={def}
            data={data?.[def.key]}
            expandedId={expandedId}
            busyIds={busyIds}
            justMovedIds={justMovedIds}
            onItemClick={handleItemClick}
            onAdvance={handleAdvance}
            onShip={handleShip}
          />
        ))}

        {!data && (
          <div className="pipelines-empty">
            Could not load pipeline data. Check your API connection.
          </div>
        )}
      </div>
    </div>
  );
}
