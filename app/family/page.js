import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

const FAMILY_COLOR = "#e74c3c";

const TASKS = {
  daily: [
    "Monitor for inbound family messages or requests",
  ],
  weekly: [
    "Outreach queue — run anniversary outreach for upcoming dates",
    "Supporter message queue — package and deliver pending messages",
    "Check re-engagement list — any families gone quiet 6+ months",
  ],
  monthly: [
    "Anniversary preview — map next 30 days of anniversaries",
    "Volunteer coordination — assignments current, follow-up done",
    "Family contact database audit — records clean and current",
    "New family onboarding — any heroes added needing family contact",
  ],
  onDemand: [
    "Anniversary remembrance email (coordinate with Comms for post)",
    "Supporter message packet creation and delivery (FM-OPS-002)",
    "New family intake and onboarding",
    "Re-engagement outreach for quiet families",
    "Hero intake from family-originated requests",
    "Volunteer assignment for family outreach tasks",
  ],
};

const QUICKLINKS = [
  { href: "/messages", label: "Messages" },
  { href: "/families", label: "Families" },
  { href: "/volunteers", label: "Volunteers" },
  { href: "/anniversaries", label: "Anniversaries" },
];

export default function FamilyPage() {
  return (
    <PageShell
      title="Family Relations"
      subtitle="Every Gold Star family interaction"
    >
      {/* Role header */}
      <div className="role-overview-header">
        <div>
          <div
            className="role-badge"
            style={{
              background: `${FAMILY_COLOR}15`,
              color: FAMILY_COLOR,
              border: `1px solid ${FAMILY_COLOR}30`,
              marginBottom: 10,
            }}
          >
            <span className="role-badge-dot" style={{ background: FAMILY_COLOR }} />
            Director of Family Relations
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, margin: 0, maxWidth: 560 }}>
            The Director of Family Relations owns every interaction with a Gold Star family.
            Anniversary outreach, supporter messages, new family onboarding, re-engagement.
            This is the most human role. Automation supports compassion. It never replaces it.
          </p>
        </div>
        <button
          className="talk-to-role-btn"
          style={{ background: FAMILY_COLOR, color: "#fff", flexShrink: 0 }}
          disabled
          title="Coming in next build — requires Claude API integration"
        >
          Talk to Family →
        </button>
      </div>

      {/* Quick links */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 10 }}>
          Quick Access
        </div>
        <div className="role-quicklinks">
          {QUICKLINKS.map((link) => (
            <Link key={link.href} href={link.href} className="role-quicklink">
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Task list by cadence */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 12 }}>
          Task Inventory
        </div>
      </div>
      <div className="role-task-grid">
        {Object.entries(TASKS).map(([cadence, tasks]) => (
          <div key={cadence} className="role-task-card">
            <div className="role-task-cadence">{cadence.replace(/([A-Z])/g, " $1").trim()}</div>
            <ul className="role-task-list">
              {tasks.map((task) => (
                <li key={task}>{task}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Knowledge file status */}
      <DataCard title="Knowledge File — FAMREL_CONTEXT.md">
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
          Knowledge file initialized. Open a Family Relations session, work the tasks above,
          then run <code style={{ background: "var(--bg-3)", padding: "2px 6px", borderRadius: 3, fontSize: 12 }}>closeout FAMILY</code> to
          update this file and write your session to SHOS_STATE.md.
        </p>
      </DataCard>
    </PageShell>
  );
}
