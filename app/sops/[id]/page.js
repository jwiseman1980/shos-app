import { notFound } from "next/navigation";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatusBadge from "@/components/StatusBadge";
import SopChecklist from "@/components/SopChecklist";
import { getSopById } from "@/lib/data/sops";

const CADENCE_ICONS = {
  Daily: "Every day",
  Weekly: "Every week",
  Monthly: "Every month",
  Quarterly: "Every quarter",
  "As needed": "Triggered by request",
  Reference: "Reference document",
};

export default async function SopDetailPage({ params }) {
  const { id } = await params;
  const sop = await getSopById(decodeURIComponent(id));

  if (!sop) {
    notFound();
  }

  const isRunnable = sop.type === "procedure" && sop.steps && sop.steps.length > 0;

  return (
    <PageShell
      title={sop.id}
      subtitle={sop.title}
    >
      {/* Back Link */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/sops"
          style={{
            fontSize: 13,
            color: "var(--gold)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to SOP Registry
        </Link>
      </div>

      {/* Metadata */}
      <div className="stat-grid">
        <div className="stat-block" style={{ borderTop: "2px solid var(--gold)" }}>
          <div className="stat-label">Version</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{sop.version}</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-blue)" }}>
          <div className="stat-label">Cadence</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{sop.cadence}</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
            {CADENCE_ICONS[sop.cadence] || sop.cadence}
          </div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-green)" }}>
          <div className="stat-label">Owner</div>
          <div className="stat-value" style={{ fontSize: 14 }}>{sop.owner}</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-purple)" }}>
          <div className="stat-label">Type</div>
          <div className="stat-value" style={{ fontSize: 14 }}>
            {sop.type === "procedure" ? "Procedure" : "Reference"}
          </div>
          <div style={{ marginTop: 4 }}>
            <StatusBadge status={sop.status} />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="section">
        <DataCard title="Summary">
          <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>
            {sop.summary}
          </div>
          {sop.timeBox && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "var(--bg)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                color: "var(--gold)",
                fontWeight: 600,
                display: "inline-block",
              }}
            >
              Time Box: {sop.timeBox}
            </div>
          )}
        </DataCard>
      </div>

      {/* Checklist or Reference */}
      <div className="section">
        {isRunnable ? (
          <DataCard title={`Procedure (${sop.steps.length} steps)`}>
            <SopChecklist sopId={sop.id} sopTitle={sop.title} steps={sop.steps} />
          </DataCard>
        ) : (
          <DataCard title="Reference Document">
            <div
              style={{
                padding: "24px 0",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 40,
                  marginBottom: 12,
                  opacity: 0.5,
                }}
              >
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ display: "inline-block" }}>
                  <rect x="8" y="6" width="32" height="36" rx="4" stroke="var(--text-dim)" strokeWidth="2" fill="none" />
                  <line x1="14" y1="16" x2="34" y2="16" stroke="var(--text-dim)" strokeWidth="2" />
                  <line x1="14" y1="22" x2="34" y2="22" stroke="var(--text-dim)" strokeWidth="2" />
                  <line x1="14" y1="28" x2="28" y2="28" stroke="var(--text-dim)" strokeWidth="2" />
                </svg>
              </div>
              <div style={{ fontSize: 14, color: "var(--text)", marginBottom: 4 }}>
                This is a reference standard — not a runnable procedure.
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Used as a quality reference by other SOPs. The full document lives in the Active SOPs folder.
              </div>
            </div>
          </DataCard>
        )}
      </div>

      {/* Domain & Related Info */}
      <div className="section">
        <DataCard title="Details">
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px 16px", fontSize: 13 }}>
            <div style={{ color: "var(--text-dim)", fontWeight: 500 }}>Domain</div>
            <div style={{ color: "var(--text-bright)" }}>{sop.domain}</div>

            <div style={{ color: "var(--text-dim)", fontWeight: 500 }}>SOP ID</div>
            <div style={{ color: "var(--text-bright)", fontFamily: "monospace" }}>{sop.id}</div>

            <div style={{ color: "var(--text-dim)", fontWeight: 500 }}>Version</div>
            <div style={{ color: "var(--text-bright)" }}>{sop.version}</div>

            <div style={{ color: "var(--text-dim)", fontWeight: 500 }}>Status</div>
            <div><StatusBadge status={sop.status} /></div>

            <div style={{ color: "var(--text-dim)", fontWeight: 500 }}>Cadence</div>
            <div style={{ color: "var(--text-bright)" }}>{sop.cadence}</div>

            <div style={{ color: "var(--text-dim)", fontWeight: 500 }}>Owner</div>
            <div style={{ color: "var(--text-bright)" }}>{sop.owner}</div>
          </div>
        </DataCard>
      </div>
    </PageShell>
  );
}
