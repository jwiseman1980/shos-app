"use client";

import { useCallback, useEffect, useState } from "react";
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

function Card({ item, expanded, onClick }) {
  const typeClass = `pipe-type pipe-type-${item.type || "inquiry"}`;
  return (
    <div
      className={`pipe-card ${staleness(item.daysInStage)}`}
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
                  Advance
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

function Column({ col, items, expandedId, onCardClick }) {
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
              onClick={() => onCardClick(item.id)}
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/pipeline");
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

  useEffect(() => { load(); }, [load]);

  const handleCardClick = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="pipe-shell">
      <div className="pipe-header">
        <div>
          <div className="pipe-title">Pipeline</div>
          <div className="pipe-sub">
            {data?.total ?? 0} item{(data?.total ?? 0) === 1 ? "" : "s"} in flight ·
            {" "}everything from inquiry to listed
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
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
