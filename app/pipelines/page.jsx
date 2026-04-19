"use client";

import { useState, useEffect, useCallback } from "react";
import "./pipelines.css";

// ---------------------------------------------------------------------------
// Pipeline definitions (keep in sync with API route constants)
// ---------------------------------------------------------------------------

const ORDER_STAGES = ["Intake", "Design Check", "Ready to Laser", "In Production", "QC / Pack", "Shipped"];
const DESIGN_STAGES = ["Brief Needed", "Brief Sent", "In Progress", "Proof Ready", "Approved"];
const ANNIVERSARY_STAGES = ["Not Started", "Prep", "Drafted", "Sent", "Complete"];
const HERO_STAGES = ["Intake", "Design", "Live"];

const PIPELINE_DEFS = [
  {
    key: "orders",
    name: "Orders",
    icon: "📦",
    color: "#22c55e",
    stages: ORDER_STAGES,
    href: "/orders",
  },
  {
    key: "designs",
    name: "Designs",
    icon: "🎨",
    color: "#a855f7",
    stages: DESIGN_STAGES,
    href: "/designs",
  },
  {
    key: "anniversaries",
    name: "Anniversary Outreach",
    icon: "🎖️",
    color: "#3b82f6",
    stages: ANNIVERSARY_STAGES,
    href: "/anniversaries",
  },
  {
    key: "heroes",
    name: "Heroes",
    icon: "⭐",
    color: "#c4a237",
    stages: HERO_STAGES,
    href: "/heroes",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(amount) {
  if (amount == null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Stage column
// ---------------------------------------------------------------------------

function StageColumn({ stage, items, color, onItemClick, expandedId }) {
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
            onClick={() => onItemClick(item.id)}
          />
        ))}
        {items.length === 0 && <div className="stage-empty">—</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline item card
// ---------------------------------------------------------------------------

function PipelineItem({ item, color, expanded, onClick }) {
  return (
    <div
      className={`pipeline-item ${expanded ? "pi-expanded" : ""}`}
      style={{ "--pi-color": color }}
      onClick={onClick}
    >
      <div className="pi-title">{item.title}</div>
      {item.subtitle && <div className="pi-subtitle">{item.subtitle}</div>}
      {expanded && item.brief && (
        <div className="pi-brief">
          <span className="operator-label-sm">Operator</span>
          {item.brief}
        </div>
      )}
      {expanded && item.actions?.length > 0 && (
        <div className="pi-actions">
          {item.actions.map((action) => (
            <a key={action.label} href={action.href} className="pi-action-btn">
              {action.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline section (collapsible)
// ---------------------------------------------------------------------------

function PipelineSection({ def, data, expandedId, onItemClick }) {
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
              onItemClick={onItemClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data fetcher
// ---------------------------------------------------------------------------

async function fetchPipelineData() {
  const res = await fetch("/api/pipelines");
  if (!res.ok) throw new Error(`Pipeline API failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PipelinesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchPipelineData();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleItemClick = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (loading) {
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
        <div className="pipelines-title">Pipelines</div>
        <p className="pipelines-sub">All active workflows — tap any card for details</p>
      </div>

      <div className="pipelines-body">
        {PIPELINE_DEFS.map((def) => (
          <PipelineSection
            key={def.key}
            def={def}
            data={data?.[def.key]}
            expandedId={expandedId}
            onItemClick={handleItemClick}
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
