"use client";

import { useState } from "react";
import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import RoleChat from "@/components/RoleChat";
import Link from "next/link";

const DEV_COLOR = "#3498db";

const TASKS = {
  weekly: [
    "Donor inbox check — any new donors to acknowledge?",
    "Active stewardship — any open conversations to advance?",
  ],
  monthly: [
    "Donor segment review — cultivation, active, lapsed, high-value",
    "Impact update emails — send to cultivation + active segments",
    "Grant calendar check — upcoming deadlines, LOI windows",
    "Campaign performance review (when active)",
  ],
  quarterly: [
    "Year-end or mid-year donor report",
    "Grant research session — new foundations matching mission",
    "Corporate partnership outreach",
    "Fundraising campaign planning",
    "Stripe donation page review (when live)",
  ],
  onDemand: [
    "New donor acknowledgment + cultivation entry",
    "Grant application drafting",
    "Major donor meeting prep",
    "Re-engagement outreach for lapsed donors",
    "Impact story development for campaigns",
  ],
};

const QUICKLINKS = [
  { href: "/donors", label: "Donors" },
];

export default function DevPage() {
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <PageShell
      title="Development"
      subtitle="Money coming in beyond bracelet sales"
    >
      {/* Role header */}
      <div className="role-overview-header">
        <div>
          <div
            className="role-badge"
            style={{
              background: `${DEV_COLOR}15`,
              color: DEV_COLOR,
              border: `1px solid ${DEV_COLOR}30`,
              marginBottom: 10,
            }}
          >
            <span className="role-badge-dot" style={{ background: DEV_COLOR }} />
            Director of Development
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, margin: 0, maxWidth: 560 }}>
            The Director of Development owns every dollar that comes in beyond bracelet sales.
            Individual donors, grants, corporate partners, campaigns. This is the highest-value
            role to build next — currently the least developed. The mission needs this engine.
          </p>
        </div>
        <button
          className="talk-to-role-btn"
          style={{ background: DEV_COLOR, color: "#fff", flexShrink: 0 }}
          onClick={() => setChatOpen(true)}
        >
          Talk to Dev →
        </button>
        {chatOpen && <RoleChat role="dev" onClose={() => setChatOpen(false)} />}
      </div>

      {/* Build status callout */}
      <div style={{
        background: `${DEV_COLOR}10`,
        border: `1px solid ${DEV_COLOR}30`,
        borderRadius: "var(--radius-md)",
        padding: "12px 16px",
        marginBottom: 24,
        fontSize: 13,
        color: "var(--text-dim)",
      }}>
        <strong style={{ color: DEV_COLOR }}>Build status:</strong> Donors page is live.
        Campaigns, grants, and Stripe integration are queued. Development is the highest-value
        unbuilt role — schedule a Dev block to start building it out.
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
          <span className="role-quicklink" style={{ opacity: 0.4, cursor: "default" }} title="Not yet built">Campaigns</span>
          <span className="role-quicklink" style={{ opacity: 0.4, cursor: "default" }} title="Not yet built">Grants</span>
          <span className="role-quicklink" style={{ opacity: 0.4, cursor: "default" }} title="Not yet built — activates with new website">Stripe Donations</span>
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
      <DataCard title="Knowledge File — DEV_CONTEXT.md">
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
          Knowledge file initialized. Open a Development session, work the tasks above,
          then run <code style={{ background: "var(--bg-3)", padding: "2px 6px", borderRadius: 3, fontSize: 12 }}>closeout DEV</code> to
          update this file and write your session to SHOS_STATE.md.
        </p>
      </DataCard>
    </PageShell>
  );
}
