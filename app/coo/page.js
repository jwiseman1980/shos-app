"use client";

import { useState } from "react";
import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import RoleChat from "@/components/RoleChat";
import Link from "next/link";

const COO_COLOR = "#e67e22";

const TASKS = {
  daily: [
    "Triage new orders — route to design or laser queue",
    "Check shipping queue — anything overdue or stuck",
    "Review hero pipeline for any intake items needing action",
  ],
  weekly: [
    "Pipeline review — all 4 active intake heroes, stage status",
    "Design queue audit — SVG files current, Drive organized",
    "Laser batch planning — what runs next, settings confirmed",
    "Inventory burnout check — reorder triggers hit?",
  ],
  monthly: [
    "Donated bracelet program review — stock available, requests pending",
    "Squarespace listing audit — active heroes all listed correctly",
    "Google Drive design file organization",
    "Quality control review — any fit/engraving issues reported",
  ],
  onDemand: [
    "New hero intake (request → design → listing → active)",
    "Laser production run (batch engraving session)",
    "ShipStation fulfillment for completed orders",
    "Design file creation for new hero",
    "Squarespace product listing update",
  ],
};

const QUICKLINKS = [
  { href: "/bracelets", label: "Pipeline" },
  { href: "/orders", label: "Orders" },
  { href: "/designs", label: "Designs" },
  { href: "/laser", label: "Laser" },
  { href: "/shipping", label: "Shipping" },
  { href: "/inventory", label: "Inventory" },
];

export default function CooPage() {
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <PageShell
      title="COO"
      subtitle="Bracelet production and fulfillment"
    >
      {/* Role header */}
      <div className="role-overview-header">
        <div>
          <div
            className="role-badge"
            style={{
              background: `${COO_COLOR}15`,
              color: COO_COLOR,
              border: `1px solid ${COO_COLOR}30`,
              marginBottom: 10,
            }}
          >
            <span className="role-badge-dot" style={{ background: COO_COLOR }} />
            Chief Operating Officer
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, margin: 0, maxWidth: 560 }}>
            The COO owns everything from hero intake request to bracelet on a family&apos;s wrist.
            Design files, laser production, ShipStation, inventory — the full physical product
            lifecycle. When you&apos;re in this block you&apos;re making things.
          </p>
        </div>
        <button
          className="talk-to-role-btn"
          style={{ background: COO_COLOR, color: "#0a0a0e", flexShrink: 0 }}
          onClick={() => setChatOpen(true)}
        >
          Talk to COO →
        </button>
        {chatOpen && <RoleChat role="coo" onClose={() => setChatOpen(false)} />}
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
      <DataCard title="Knowledge File — COO_CONTEXT.md">
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
          Knowledge file initialized. Open a COO session, work the tasks above,
          then run <code style={{ background: "var(--bg-3)", padding: "2px 6px", borderRadius: 3, fontSize: 12 }}>closeout COO</code> to
          update this file and write your session to SHOS_STATE.md.
        </p>
      </DataCard>
    </PageShell>
  );
}
