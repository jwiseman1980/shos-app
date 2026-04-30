"use client";

import { useState, useEffect, useCallback } from "react";
import "./workflow.css";

const STAGES = [
  { key: "inquiry",              label: "Inquiry" },
  { key: "researching",          label: "Researching" },
  { key: "hero_created",         label: "Hero Created" },
  { key: "contacting_requestor", label: "Confirming" },
  { key: "design_briefed",       label: "Design Briefed" },
  { key: "design_received",      label: "Design Received" },
  { key: "proof_sent",           label: "Proof Sent" },
  { key: "approved_production",  label: "Approved" },
  { key: "lasering",             label: "Lasering" },
  { key: "photographing",        label: "Photographed" },
  { key: "letter_drafted",       label: "Letter Drafted" },
  { key: "social_posted",        label: "Social Posted" },
  { key: "shipped",              label: "Shipped" },
  { key: "listed",               label: "Listed" },
  { key: "complete",             label: "Complete" },
];

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StageColumn({ stage, items, onAdvance, busyId }) {
  return (
    <div className="hw-col">
      <div className="hw-col-header">
        <span className="hw-col-label">{stage.label}</span>
        {items.length > 0 && <span className="hw-col-count">{items.length}</span>}
      </div>
      <div className="hw-col-items">
        {items.map((item) => (
          <HeroCard
            key={item.id}
            item={item}
            onAdvance={onAdvance}
            busy={busyId === item.id}
            isFinal={stage.key === "complete"}
          />
        ))}
        {items.length === 0 && <div className="hw-col-empty">—</div>}
      </div>
    </div>
  );
}

function HeroCard({ item, onAdvance, busy, isFinal }) {
  return (
    <div className="hw-card">
      <div className="hw-card-name">{item.name}</div>
      {item.sku && <div className="hw-card-sku">{item.sku}</div>}
      {item.blockers && <div className="hw-card-blocker">{item.blockers}</div>}
      <div className="hw-card-footer">
        <span className="hw-card-date">{fmtDate(item.updatedAt)}</span>
        {!isFinal && (
          <button
            className="hw-advance-btn"
            disabled={busy}
            onClick={() => onAdvance(item.id)}
          >
            {busy ? "…" : "Advance →"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function HeroWorkflowPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/heroes/workflow");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const advance = useCallback(async (heroId) => {
    setBusyId(heroId);
    try {
      const res = await fetch("/api/heroes/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero_id: heroId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Advance failed");
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }, [load]);

  if (loading) {
    return (
      <div className="hw-shell">
        <div className="hw-loading">Loading workflow…</div>
      </div>
    );
  }

  return (
    <div className="hw-shell">
      <div className="hw-header">
        <div className="hw-title">Hero Workflow</div>
        <div className="hw-sub">
          {data?.total ?? 0} hero{(data?.total ?? 0) === 1 ? "" : "es"} in flight ·
          {" "}15-stage bracelet lifecycle
        </div>
      </div>

      {error && <div className="hw-error">{error}</div>}
      {data?.migrationPending && (
        <div className="hw-error">
          Migration pending: apply <code>supabase/migrations/005_hero_workflow_stage.sql</code> in the Supabase dashboard
          to enable workflow tracking. Until then, this board will be empty.
        </div>
      )}

      <div className="hw-board">
        {STAGES.map((stage) => (
          <StageColumn
            key={stage.key}
            stage={stage}
            items={data?.byStage?.[stage.key] || []}
            onAdvance={advance}
            busyId={busyId}
          />
        ))}
      </div>
    </div>
  );
}
