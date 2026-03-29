import { getSopById } from "@/lib/data/sops";
import SopChecklist from "@/components/SopChecklist";
import Link from "next/link";

export const metadata = {
  title: "Social Media | SHOS",
};

export default async function SocialMediaPage() {
  const sop = await getSopById("SOP-001");

  return (
    <main className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Social Media</h1>
        <p className="page-subtitle">Daily engagement hub — SOP-001</p>
      </div>

      {/* Quick Stats */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-block" style={{ borderTop: "3px solid #8e44ad" }}>
          <div className="stat-label">SOP</div>
          <div className="stat-value" style={{ fontSize: 18 }}>SOP-001</div>
          <div className="stat-sub">v{sop.version}</div>
        </div>
        <div className="stat-block" style={{ borderTop: "3px solid #8e44ad" }}>
          <div className="stat-label">Cadence</div>
          <div className="stat-value" style={{ fontSize: 18 }}>Daily</div>
          <div className="stat-sub">15-20 minutes</div>
        </div>
        <div className="stat-block" style={{ borderTop: "3px solid #8e44ad" }}>
          <div className="stat-label">Platform</div>
          <div className="stat-value" style={{ fontSize: 18 }}>Meta</div>
          <div className="stat-sub">Facebook + Instagram</div>
        </div>
        <div className="stat-block" style={{ borderTop: "3px solid #8e44ad" }}>
          <div className="stat-label">Owner</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{sop.owner}</div>
          <div className="stat-sub">Any volunteer</div>
        </div>
      </div>

      {/* Today's Engagement Checklist */}
      <div className="data-card" style={{ marginBottom: 24 }}>
        <div className="data-card-header">
          <h2 className="data-card-title">Today&apos;s Engagement</h2>
          <a
            href="https://business.facebook.com/latest/inbox"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              padding: "5px 12px",
              background: "rgba(142, 68, 173, 0.15)",
              color: "#8e44ad",
              border: "1px solid rgba(142, 68, 173, 0.3)",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Open Meta Business Suite &rarr;
          </a>
        </div>
        <SopChecklist
          sopId={sop.id}
          sopTitle={sop.title}
          steps={sop.steps}
        />
      </div>

      {/* Quick Links */}
      <div className="data-card">
        <div className="data-card-header">
          <h2 className="data-card-title">Quick Links</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <QuickLink
            href="https://business.facebook.com/latest/inbox"
            label="Meta Business Suite"
            sub="DMs, comments, inbox"
            external
          />
          <QuickLink
            href="/sops/SOP-001"
            label="SOP-001 Reference"
            sub="Full procedure document"
          />
          <QuickLink
            href="/content"
            label="Content Generator"
            sub="Create posts and content"
          />
          <QuickLink
            href="/memorials"
            label="Memorial Pages"
            sub="Hero memorial content"
          />
        </div>
      </div>
    </main>
  );
}

function QuickLink({ href, label, sub, external }) {
  const style = {
    display: "block",
    padding: "14px 16px",
    background: "var(--bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "var(--radius-md)",
    textDecoration: "none",
    transition: "border-color 0.15s ease",
  };

  const inner = (
    <>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)", marginBottom: 3 }}>
        {label} {external && <span style={{ fontSize: 10, opacity: 0.5 }}>&#8599;</span>}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{sub}</div>
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={style}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} style={style}>
      {inner}
    </Link>
  );
}
