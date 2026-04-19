import Link from "next/link";

export const dynamic = "force-dynamic";

const ED_COLOR = "#c4a237";

const PERSONAL_AREAS = [
  {
    area: "Properties",
    description: "Investment property dashboard — costs, P&L, tenant tracking.",
    status: "live",
    link: "/gyst/properties",
    icon: "⊕",
  },
  {
    area: "Bank Accounts",
    description: "Connect USAA and other accounts. Automatic transaction sync — no more CSV imports.",
    status: "live",
    link: "/gyst/connect",
    icon: "◎",
  },
  {
    area: "Fitness",
    description: "Workout log and weekly movement tracking.",
    status: "stub",
    icon: "♦",
  },
  {
    area: "Professional Development",
    description: "Books, certifications, and learning queue.",
    status: "stub",
    icon: "◇",
  },
  {
    area: "Personal Planning",
    description: "Weekly personal priorities and time blocking.",
    status: "stub",
    icon: "◈",
  },
];

export default function GystPage() {
  return (
    <>
      {/* Header badge */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            background: `${ED_COLOR}15`,
            color: ED_COLOR,
            border: `1px solid ${ED_COLOR}30`,
            borderRadius: "var(--radius-pill)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: ED_COLOR }} />
          Personal Operations
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "8px 0 0", maxWidth: 560 }}>
          Work/life balance isn&apos;t separate from performance — it&apos;s the foundation of it.
          Property investments, fitness, learning, and personal planning.
        </p>
      </div>

      {/* Area cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {PERSONAL_AREAS.map((area) => (
          <div
            key={area.area}
            className="card"
            style={{ borderTop: `2px solid ${area.status === "live" ? ED_COLOR : "var(--card-border)"}` }}
          >
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16, color: area.status === "live" ? ED_COLOR : "var(--text-dim)" }}>
                  {area.icon}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-bright)" }}>
                  {area.area}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 0 12px" }}>
                {area.description}
              </p>
              {area.status === "live" && area.link && (
                <Link
                  href={area.link}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    background: `${ED_COLOR}20`,
                    border: `1px solid ${ED_COLOR}40`,
                    borderRadius: "var(--radius-sm)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: ED_COLOR,
                    textDecoration: "none",
                  }}
                >
                  Open →
                </Link>
              )}
              {area.status === "stub" && (
                <span style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  background: "var(--bg-3)",
                  borderRadius: "var(--radius-pill)",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                }}>
                  Coming soon
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
