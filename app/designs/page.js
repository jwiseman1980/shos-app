export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import { getDesignQueue, getNeedsDesign, getDesignStats } from "@/lib/data/designs";
import DesignUploader from "@/components/DesignUploader";

const tdStyle = { padding: "8px 12px", fontSize: 13, verticalAlign: "top" };
const thStyle = {
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-dim)",
  textAlign: "left",
};

const statusColors = {
  Queued: { bg: "#6b728022", text: "#6b7280" },
  "In Progress": { bg: "#3b82f622", text: "#3b82f6" },
  Submitted: { bg: "#f59e0b22", text: "#f59e0b" },
  Complete: { bg: "#22c55e22", text: "#22c55e" },
  "Not requested": { bg: "#6b728022", text: "#6b7280" },
};

const priorityColors = {
  Urgent: { bg: "#ef444422", text: "#ef4444" },
  High: { bg: "#f59e0b22", text: "#f59e0b" },
  Normal: { bg: "#6b728022", text: "#6b7280" },
  Low: { bg: "#6b728022", text: "#52525b" },
};

function StatusBadge({ status }) {
  const c = statusColors[status] || statusColors["Not requested"];
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 12,
      fontSize: 11, fontWeight: 600, background: c.bg, color: c.text,
    }}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const c = priorityColors[priority] || priorityColors["Normal"];
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 12,
      fontSize: 11, fontWeight: 600, background: c.bg, color: c.text,
    }}>
      {priority}
    </span>
  );
}

function DesignTable({ items, showStatus = true, showPriority = true, showBrief = false }) {
  if (items.length === 0) {
    return (
      <div style={{ padding: "16px 0", color: "var(--text-dim)", fontSize: 13 }}>
        No items.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
            <th style={thStyle}>Hero</th>
            <th style={thStyle}>SKU</th>
            <th style={thStyle}>Branch</th>
            {showStatus && <th style={thStyle}>Status</th>}
            {showPriority && <th style={thStyle}>Priority</th>}
            {showBrief && <th style={thStyle}>Brief</th>}
            <th style={thStyle}>Due</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 500, color: "var(--text-bright)" }}>
                  {item.name}
                </div>
                {item.incident && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    {item.incident}
                  </div>
                )}
              </td>
              <td style={tdStyle}>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                  {item.sku || "\u2014"}
                </span>
              </td>
              <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-dim)" }}>
                {item.branch || "\u2014"}
              </td>
              {showStatus && (
                <td style={tdStyle}>
                  <StatusBadge status={item.designStatus} />
                </td>
              )}
              {showPriority && (
                <td style={tdStyle}>
                  <PriorityBadge priority={item.designPriority} />
                </td>
              )}
              {showBrief && (
                <td style={{ ...tdStyle, maxWidth: 200, fontSize: 11, color: "var(--text-dim)" }}>
                  {item.designBrief
                    ? item.designBrief.substring(0, 80) + (item.designBrief.length > 80 ? "..." : "")
                    : "\u2014"}
                </td>
              )}
              <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-dim)" }}>
                {item.designDueDate
                  ? new Date(item.designDueDate).toLocaleDateString()
                  : "\u2014"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DesignsPage() {
  const [queue, needsDesign, stats] = await Promise.all([
    getDesignQueue(),
    getNeedsDesign(),
    getDesignStats(),
  ]);

  const totalActive = stats.queued + stats.inProgress + stats.submitted;

  return (
    <PageShell
      title="Graphic Design Queue"
      subtitle="Bracelet design requests for Ryan \u2014 live from Salesforce"
    >
      {/* KPIs */}
      <div className="stat-grid">
        <StatBlock
          label="Active Tasks"
          value={totalActive}
          note={`${stats.queued} queued \u00b7 ${stats.inProgress} in progress`}
          accent="var(--gold)"
        />
        <StatBlock
          label="Needs Design"
          value={stats.needsDesign}
          note="Not yet queued"
          accent="var(--status-orange)"
        />
        <StatBlock
          label="Submitted"
          value={stats.submitted}
          note="Awaiting review"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Completed"
          value={stats.complete}
          note="All time"
          accent="var(--status-green)"
        />
      </div>

      {/* Interactive Design Queue + Upload */}
      <div className="section">
        <DataCard title={`Design Tasks (${totalActive} active)`}>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            Drag & drop SVG files onto a task to upload. Click status buttons to advance the workflow.
          </div>
          <DesignUploader queue={queue} needsDesign={needsDesign} />
        </DataCard>
      </div>

      {/* How it works */}
      <div className="section">
        <DataCard title="Design Workflow">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              {
                step: "1. Queue",
                desc: "Hero needs a bracelet design. Set Design_Status to Queued in SF. Include brief with hero details, reference images, and similar designs.",
              },
              {
                step: "2. Assign",
                desc: "Ryan picks up the task. Status moves to In Progress. He creates the SVG layout based on the brief and reference bracelets.",
              },
              {
                step: "3. Submit",
                desc: "Ryan uploads the design file and sets status to Submitted. Joseph reviews for accuracy and approval.",
              },
              {
                step: "4. Complete",
                desc: "Design approved. Status set to Complete, Bracelet_Design_Created = true. Hero moves to Production stage in the pipeline.",
              },
            ].map((s) => (
              <div
                key={s.step}
                style={{
                  padding: "12px 16px",
                  background: "var(--bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-md)",
                  flex: "1 1 200px",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 4 }}>
                  {s.step}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
        </DataCard>
      </div>
    </PageShell>
  );
}
