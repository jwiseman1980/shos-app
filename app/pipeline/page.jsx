"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase";
import "./pipeline.css";

function fmtAge(days) {
  if (days == null) return "";
  if (days === 0) return "today";
  if (days === 1) return "1d";
  return `${days}d`;
}

function staleness(days) {
  if (days == null) return "";
  if (days >= 14) return "is-very-stale";
  if (days >= 7) return "is-stale";
  return "";
}

function Card({ item, expanded, busy, justMoved, onClick, onAdvance, onPushShipStation, onMarkShipped }) {
  const typeClass = `pipe-type pipe-type-${item.type || "inquiry"}`;
  const canAdvanceHero = item.kind === "hero" && item.stage !== "complete";
  const canPushSS = item.kind === "shipstation" && item.orderId;

  return (
    <div
      className={`pipe-card ${staleness(item.daysInStage)} ${justMoved ? "pipe-just-moved" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="pipe-card-top">
        <div className="pipe-card-name" title={item.name}>{item.name}</div>
        <span className={typeClass}>{item.type || "inq"}</span>
      </div>

      {item.sku && <div className="pipe-card-sku">{item.sku}</div>}

      <div className="pipe-card-meta">
        {item.daysInStage != null && <span>{fmtAge(item.daysInStage)} here</span>}
        {item.orderCount > 0 && (
          <span>· {item.orderCount} order{item.orderCount === 1 ? "" : "s"}</span>
        )}
        {item.kind === "shipstation" && item.itemSummary && (
          <span>· {item.itemSummary}</span>
        )}
      </div>

      {item.blocker && <div className="pipe-card-blocker">{item.blocker}</div>}

      {/* Quick actions on the card itself — no need to expand */}
      {(canAdvanceHero || canPushSS) && (
        <div className="pipe-quick-actions" onClick={(e) => e.stopPropagation()}>
          {canAdvanceHero && (
            <button
              className="pipe-quick-btn pipe-quick-btn-advance"
              disabled={busy}
              onClick={onAdvance}
              title={item.stage ? `Advance from ${item.stage.replace(/_/g, " ")}` : "Advance"}
            >
              {busy ? "…" : "Advance →"}
            </button>
          )}
          {canPushSS && (
            <>
              <a
                className="pipe-quick-btn"
                href={`/shipping`}
                onClick={(e) => e.stopPropagation()}
                title="Open ShipStation queue"
              >
                Label
              </a>
              <button
                className="pipe-quick-btn pipe-quick-btn-ship"
                disabled={busy}
                onClick={onMarkShipped}
                title="Mark this ShipStation order shipped"
              >
                {busy ? "…" : "✓ Shipped"}
              </button>
            </>
          )}
        </div>
      )}

      {expanded && (
        <div className="pipe-card-expanded">
          {item.kind === "hero" && item.stageLabel && (
            <div className="pipe-card-row">
              <span>Stage</span>
              <strong>{item.stageLabel}</strong>
            </div>
          )}
          {item.branch && (
            <div className="pipe-card-row">
              <span>Branch</span>
              <strong>{item.branch}</strong>
            </div>
          )}
          {item.orderQty > 0 && (
            <div className="pipe-card-row">
              <span>Total qty</span>
              <strong>{item.orderQty}</strong>
            </div>
          )}
          {item.kind === "shipstation" && item.orderNumber && (
            <div className="pipe-card-row">
              <span>SS order</span>
              <strong>{item.orderNumber}</strong>
            </div>
          )}
          <div className="pipe-card-actions">
            {item.kind === "hero" && (
              <>
                <a className="pipe-action" href={`/heroes/${item.heroId}`} onClick={(e) => e.stopPropagation()}>
                  Hero
                </a>
                <a className="pipe-action" href="/heroes/workflow" onClick={(e) => e.stopPropagation()}>
                  Full workflow
                </a>
              </>
            )}
            {item.kind === "shipstation" && (
              <a className="pipe-action" href="/shipping" onClick={(e) => e.stopPropagation()}>
                Shipping
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Column({ col, items, expandedId, busyIds, justMovedIds, onCardClick, onAdvance, onPushShipStation, onMarkShipped }) {
  return (
    <div className="pipe-col">
      <div className="pipe-col-header">
        <div className="pipe-col-row">
          <span className="pipe-col-label">{col.label}</span>
          <span className="pipe-col-count">{items.length}</span>
        </div>
        <div className="pipe-col-desc">{col.description}</div>
      </div>
      <div className="pipe-col-items">
        {items.length === 0 ? (
          <div className="pipe-col-empty">—</div>
        ) : (
          items.map((item) => (
            <Card
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              busy={busyIds.has(item.id)}
              justMoved={justMovedIds.has(item.id)}
              onClick={() => onCardClick(item.id)}
              onAdvance={() => onAdvance(item)}
              onPushShipStation={() => onPushShipStation(item)}
              onMarkShipped={() => onMarkShipped(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [justMovedIds, setJustMovedIds] = useState(() => new Set());
  const [live, setLive] = useState(false);
  const justMovedTimers = useRef(new Map());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load pipeline");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark a card as just-moved — pulses for 2.4s
  const flashMoved = useCallback((id) => {
    if (!id) return;
    setJustMovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (justMovedTimers.current.has(id)) clearTimeout(justMovedTimers.current.get(id));
    const t = setTimeout(() => {
      setJustMovedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      justMovedTimers.current.delete(id);
    }, 2400);
    justMovedTimers.current.set(id, t);
  }, []);

  const setBusy = useCallback((id, isBusy) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  // Initial load + 30s polling fallback
  useEffect(() => {
    load();
    const poll = setInterval(load, 30_000);
    return () => clearInterval(poll);
  }, [load]);

  // Supabase Realtime — subscribe to heroes (workflow_stage changes) + order_items
  useEffect(() => {
    let sb;
    try { sb = getBrowserClient(); } catch { return; }

    const debounced = (() => {
      let t = null;
      return (id) => {
        if (id) flashMoved(id);
        if (t) return;
        t = setTimeout(() => { t = null; load(); }, 350);
      };
    })();

    const channel = sb
      .channel("pipeline-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "heroes" }, (payload) => {
        const id = payload.new?.id || payload.old?.id;
        debounced(id ? `hero-${id}` : null);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => debounced())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => debounced())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLive(true);
        else if (status === "CHANNEL_ERROR" || status === "CLOSED") setLive(false);
      });

    return () => { setLive(false); sb.removeChannel(channel); };
  }, [load, flashMoved]);

  // Listen for chat-driven pipeline_change broadcasts
  useEffect(() => {
    function onChange(e) {
      const heroId = e?.detail?.input?.hero_id;
      if (heroId) flashMoved(`hero-${heroId}`);
      load();
    }
    window.addEventListener("shos:pipeline_change", onChange);
    return () => window.removeEventListener("shos:pipeline_change", onChange);
  }, [load, flashMoved]);

  // Hero advance — calls the existing /api/heroes/workflow with no `stage` to advance one step
  const handleAdvance = useCallback(async (item) => {
    if (!item.heroId) return;
    setBusy(item.id, true);
    try {
      const res = await fetch("/api/heroes/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero_id: item.heroId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Advance failed (${res.status})`);
      } else {
        flashMoved(item.id);
      }
      await load();
    } catch (e) {
      setError(`Advance failed: ${e.message}`);
    } finally {
      setBusy(item.id, false);
    }
  }, [flashMoved, load, setBusy]);

  // ShipStation card → mark all related order_items shipped (terminal state).
  // We don't know the Supabase orderId from a ShipStation card alone, so we
  // route the user to /shipping for the actual label-print flow. The "Shipped"
  // button is for after-the-fact bookkeeping — operators print the label, then
  // tap Shipped here to clear the card from the board.
  const handleMarkShipped = useCallback(async (item) => {
    setBusy(item.id, true);
    try {
      // ShipStation doesn't have a Supabase order link in the cheap case —
      // the simplest action is to refetch (the card will drop off naturally
      // after the order is shipped in ShipStation and the next sync runs).
      // For now this is a hint: nudge user to /shipping.
      window.location.href = "/shipping";
    } finally {
      setBusy(item.id, false);
    }
  }, [setBusy]);

  // Push to ShipStation — kept as a stub for hero-kind cards in In Production
  // with ready_to_ship items. We'd need the parent orderId to wire this up
  // fully; the existing /api/orders/push-shipstation needs a Supabase orderId.
  const handlePushShipStation = useCallback(async () => {
    window.location.href = "/shipping";
  }, []);

  const handleCardClick = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="pipe-shell">
      <div className="pipe-header">
        <div>
          <div className="pipe-title">
            Pipeline
            {live && <span className="pipe-live">Live</span>}
          </div>
          <div className="pipe-sub">
            {data?.total ?? 0} item{(data?.total ?? 0) === 1 ? "" : "s"} in flight ·
            {" "}talk to the Operator or tap Advance →
          </div>
        </div>
        <button
          className="pipe-refresh"
          onClick={load}
          disabled={loading}
          title="Refresh"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {error && <div className="pipe-error">Error: {error}</div>}

      {data?.migrationPending && (
        <div className="pipe-banner">
          Migration pending: apply <code>supabase/migrations/005_hero_workflow_stage.sql</code> in
          the Supabase dashboard to populate the workflow board. Until then, hero cards will be
          empty (ShipStation orders still flow into Ready to Ship).
        </div>
      )}

      {data?.shipStationOk === false && (
        <div className="pipe-banner">
          ShipStation enrichment unavailable — Ready to Ship column shows Supabase orders only.
        </div>
      )}

      {loading && !data ? (
        <div className="pipe-loading">Loading pipeline…</div>
      ) : (
        <div className="pipe-board">
          {(data?.columns || []).map((col) => (
            <Column
              key={col.key}
              col={col}
              items={data?.byColumn?.[col.key] || []}
              expandedId={expandedId}
              busyIds={busyIds}
              justMovedIds={justMovedIds}
              onCardClick={handleCardClick}
              onAdvance={handleAdvance}
              onPushShipStation={handlePushShipStation}
              onMarkShipped={handleMarkShipped}
            />
          ))}
        </div>
      )}
    </div>
  );
}
