"use client";

import { useState } from "react";
import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import RoleChat from "@/components/RoleChat";
import Link from "next/link";

const COMMS_COLOR = "#8e44ad";

const TASKS = {
  daily: [
    "Social engagement — reply to comments, DMs, reactions (Meta API)",
    "Monitor for memorial-related tags or mentions",
  ],
  weekly: [
    "Weekly amplification run (SOP-002, SOP-014, SOP-015)",
    "Anniversary memorial posts — upcoming anniversaries this week",
    "Content queue check — posts scheduled and ready?",
  ],
  monthly: [
    "Monthly content calendar planning — themes, anniversaries, campaigns",
    "Social KPI review — reach, engagement, follower growth",
    "Memorial page audit — all active heroes have current pages",
    "Brand standards check — consistency across all public content",
  ],
  onDemand: [
    "New hero memorial post (coordinate with Family Relations)",
    "Campaign content creation",
    "Memorial page creation or update",
    "Press or media response drafting",
    "New website content (when new site is live)",
  ],
};

const QUICKLINKS = [
  { href: "/content", label: "Content Generator" },
  { href: "/memorials", label: "Memorial Pages" },
  { href: "/anniversaries", label: "Anniversaries" },
];

export default function CommsPage() {
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <PageShell
      title="Communications"
      subtitle="Everything the world sees"
    >
      {/* Role header */}
      <div className="role-overview-header">
        <div>
          <div
            className="role-badge"
            style={{
              background: `${COMMS_COLOR}15`,
              color: COMMS_COLOR,
              border: `1px solid ${COMMS_COLOR}30`,
              marginBottom: 10,
            }}
          >
            <span className="role-badge-dot" style={{ background: COMMS_COLOR }} />
            Director of Communications
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, margin: 0, maxWidth: 560 }}>
            The Director of Communications owns every word, post, page, and image that
            Steel Hearts puts in front of the world. Social media, memorial pages, content
            calendar, brand standards. When you&apos;re in this block, you&apos;re the public voice.
          </p>
        </div>
        <button
          className="talk-to-role-btn"
          style={{ background: COMMS_COLOR, color: "#fff", flexShrink: 0 }}
          onClick={() => setChatOpen(true)}
        >
          Talk to Comms →
        </button>
        {chatOpen && <RoleChat role="comms" onClose={() => setChatOpen(false)} />}
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
          <span
            className="role-quicklink"
            style={{ opacity: 0.4, cursor: "default" }}
            title="Not yet built"
          >
            Social Dashboard
          </span>
          <span
            className="role-quicklink"
            style={{ opacity: 0.4, cursor: "default" }}
            title="Not yet built"
          >
            Content Calendar
          </span>
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
      <DataCard title="Knowledge File — CMO_CONTEXT.md">
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
          Knowledge file initialized. Open a Communications session, work the tasks above,
          then run <code style={{ background: "var(--bg-3)", padding: "2px 6px", borderRadius: 3, fontSize: 12 }}>closeout COMMS</code> to
          update this file and write your session to SHOS_STATE.md.
        </p>
      </DataCard>
    </PageShell>
  );
}
