import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

const COS_COLOR = "#b0b8c4";

const TASKS = {
  daily: [
    "Morning briefing review and cross-role flag routing",
    "Email triage — categorize, route, or draft replies",
    "Approve or flag role outputs that landed in queue",
  ],
  weekly: [
    "SOP maintenance — review and update any changed processes",
    "Calendar audit — confirm next week's sessions are context-loaded",
    "Decision log entry — record any significant decisions made",
  ],
  monthly: [
    "Compliance calendar review — registrations, renewals, 990 deadlines",
    "Board governance check — minutes current, filings in order",
    "State registration status review (VA + any active states)",
    "SHOS_STATE.md review — is the master document current?",
  ],
  onDemand: [
    "Meeting prep (board, external partners, Sara/Tracy calls)",
    "New SOP creation when a repeated process isn't documented",
    "Volunteer onboarding coordination",
    "External partner communication drafts",
  ],
};

const QUICKLINKS = [
  { href: "/sops", label: "SOP Runner" },
  { href: "/email", label: "Email Composer" },
  { href: "/org", label: "Org Chart" },
  { href: "/settings", label: "Settings" },
];

export default function CosPage() {
  return (
    <PageShell
      title="Chief of Staff"
      subtitle="System governance and ED effectiveness"
    >
      {/* Role header */}
      <div className="role-overview-header">
        <div>
          <div
            className="role-badge"
            style={{
              background: `${COS_COLOR}15`,
              color: COS_COLOR,
              border: `1px solid ${COS_COLOR}30`,
              marginBottom: 10,
            }}
          >
            <span className="role-badge-dot" style={{ background: COS_COLOR }} />
            Chief of Staff
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, margin: 0, maxWidth: 560 }}>
            The COS owns the machine that makes the ED effective. Governance, compliance,
            SOPs, email, calendar, and decision log. When you&apos;re in this block you&apos;re
            maintaining the system, not running it.
          </p>
        </div>
        <button
          className="talk-to-role-btn"
          style={{ background: COS_COLOR, color: "#0a0a0e", flexShrink: 0 }}
          disabled
          title="Coming in next build — requires Claude API integration"
        >
          Talk to COS →
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
      <DataCard title="Knowledge File — COS_CONTEXT.md">
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
          Knowledge file initialized. Open a COS session, work the tasks above,
          then run <code style={{ background: "var(--bg-3)", padding: "2px 6px", borderRadius: 3, fontSize: 12 }}>closeout COS</code> to
          update this file and write your session to SHOS_STATE.md.
        </p>
      </DataCard>
    </PageShell>
  );
}
