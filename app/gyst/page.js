import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";

export const dynamic = "force-dynamic";

const ED_COLOR = "#c4a237";

// Personal section — separate from org work but equally important.
// A good ED takes care of themselves. This block is for Joseph, not Steel Hearts.

const PERSONAL_AREAS = [
  {
    area: "Fitness",
    description: "Workout log and weekly movement tracking.",
    status: "stub",
    tasks: [
      "Log today's workout",
      "Weekly movement check-in",
      "Rest and recovery tracking",
    ],
  },
  {
    area: "Professional Development",
    description: "Books, certifications, and learning queue.",
    status: "stub",
    tasks: [
      "Reading list — current + queue",
      "Certifications in progress",
      "Learning sessions scheduled",
      "Articles and resources to review",
    ],
  },
  {
    area: "Personal Planning",
    description: "Weekly personal priorities and time blocking.",
    status: "stub",
    tasks: [
      "Weekly personal priority review",
      "Work/life balance check-in",
      "Personal goals tracking",
      "Time blocking for non-org priorities",
    ],
  },
  {
    area: "GYST Dashboard",
    description: "Personal finance — budgets, accounts, spending.",
    status: "live",
    link: "http://localhost:3001",
    tasks: [
      "Monthly budget review",
      "Account balance check",
      "Spending category review",
      "Savings and investment check",
    ],
  },
];

export default function GystPage() {
  return (
    <PageShell
      title="Personal"
      subtitle="The ED takes care of himself too"
    >
      {/* Header */}
      <div className="role-overview-header">
        <div>
          <div
            className="role-badge"
            style={{
              background: `${ED_COLOR}15`,
              color: ED_COLOR,
              border: `1px solid ${ED_COLOR}30`,
              marginBottom: 10,
            }}
          >
            <span className="role-badge-dot" style={{ background: ED_COLOR }} />
            Executive Director — Personal
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, margin: 0, maxWidth: 560 }}>
            Work/life balance isn&apos;t separate from performance — it&apos;s the foundation of it.
            Fitness, learning, personal finance, and intentional time. This block is for you,
            not the org. Book it on the calendar like any other role block.
          </p>
        </div>
      </div>

      {/* Personal areas */}
      <div className="gyst-grid">
        {PERSONAL_AREAS.map((area) => (
          <DataCard
            key={area.area}
            title={area.area}
            style={{ borderTopColor: area.status === "live" ? ED_COLOR : "var(--border)" }}
          >
            <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
              {area.description}
            </p>

            {area.status === "live" && area.link && (
              <a
                href={area.link}
                target="_blank"
                rel="noopener noreferrer"
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
                  marginBottom: 12,
                }}
              >
                Open GYST Dashboard →
              </a>
            )}

            {area.status === "stub" && (
              <div style={{
                display: "inline-block",
                padding: "3px 10px",
                background: "var(--bg-3)",
                borderRadius: "var(--radius-pill)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: 12,
              }}>
                Coming soon
              </div>
            )}

            <ul className="role-task-list">
              {area.tasks.map((task) => (
                <li key={task} style={{ color: area.status === "stub" ? "var(--text-dim)" : "var(--text)" }}>
                  {task}
                </li>
              ))}
            </ul>
          </DataCard>
        ))}
      </div>

      {/* Note */}
      <div style={{
        marginTop: 24,
        padding: "12px 16px",
        background: "var(--bg-3)",
        borderRadius: "var(--radius-md)",
        fontSize: 12,
        color: "var(--text-dim)",
        fontStyle: "italic",
      }}>
        This section grows as it gets used. Fitness logging, reading list management, and
        personal planning will be built out in a dedicated Personal block session. For now,
        GYST (personal finance dashboard) is the only live integration here.
      </div>
    </PageShell>
  );
}
