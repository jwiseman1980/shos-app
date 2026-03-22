"use client";
import { useState } from "react";

const STAGES = [
  "Intake",
  "Family Outreach",
  "Charity Designation",
  "Design",
  "Production",
  "Donated Fulfillment",
  "Website Listing",
  "Active",
];

const STAGE_COLORS = {
  Intake: "#6b7280",
  "Family Outreach": "#8b5cf6",
  "Charity Designation": "#3b82f6",
  Design: "#f59e0b",
  Production: "#f97316",
  "Donated Fulfillment": "#10b981",
  "Website Listing": "#06b6d4",
  Active: "#22c55e",
};

const STAGE_ICONS = {
  Intake: "\u2709",
  "Family Outreach": "\u260E",
  "Charity Designation": "\u2665",
  Design: "\u270E",
  Production: "\u2699",
  "Donated Fulfillment": "\u2706",
  "Website Listing": "\u2601",
  Active: "\u2713",
};

export default function PipelineTracker({ heroes, inProgress, stageCounts, stats }) {
  const [filter, setFilter] = useState("all"); // all, or a stage name
  const [search, setSearch] = useState("");

  const filtered = (filter === "all" ? inProgress : heroes.filter((h) => h.stage === filter))
    .filter((h) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        h.name.toLowerCase().includes(q) ||
        h.sku.toLowerCase().includes(q) ||
        h.branch.toLowerCase().includes(q)
      );
    });

  return (
    <div>
      {/* Stage Summary Bar */}
      <div
        style={{
          display: "flex",
          height: 40,
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          marginBottom: 16,
          background: "var(--card-border)",
        }}
      >
        {STAGES.map((stage) => {
          const count = stageCounts[stage] || 0;
          const total = heroes.length || 1;
          const pct = (count / total) * 100;
          if (count === 0) return null;
          return (
            <div
              key={stage}
              onClick={() => setFilter(filter === stage ? "all" : stage)}
              title={`${stage}: ${count}`}
              style={{
                width: `${pct}%`,
                background: STAGE_COLORS[stage],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer",
                opacity: filter === "all" || filter === stage ? 1 : 0.4,
                transition: "opacity 0.2s, width 0.3s",
                minWidth: pct > 3 ? "auto" : 0,
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {pct > 6 ? `${count}` : ""}
            </div>
          );
        })}
      </div>

      {/* Stage Legend */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        {STAGES.map((stage) => (
          <button
            key={stage}
            onClick={() => setFilter(filter === stage ? "all" : stage)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 4,
              border:
                filter === stage
                  ? `2px solid ${STAGE_COLORS[stage]}`
                  : "1px solid var(--card-border)",
              background:
                filter === stage ? `${STAGE_COLORS[stage]}22` : "transparent",
              cursor: "pointer",
              fontSize: 11,
              color: filter === stage ? STAGE_COLORS[stage] : "var(--text-dim)",
              fontWeight: filter === stage ? 600 : 400,
            }}
          >
            <span>{STAGE_ICONS[stage]}</span>
            {stage}
            <span style={{ fontWeight: 700 }}>{stageCounts[stage] || 0}</span>
          </button>
        ))}
        {filter !== "all" && (
          <button
            onClick={() => setFilter("all")}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--card-border)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 11,
              color: "var(--text-dim)",
            }}
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by name, SKU, or branch..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--card-border)",
            background: "var(--card-bg)",
            color: "var(--text)",
            fontSize: 13,
          }}
        />
      </div>

      {/* Results count */}
      <div
        style={{
          fontSize: 12,
          color: "var(--text-dim)",
          marginBottom: 8,
        }}
      >
        {filter === "all"
          ? `${filtered.length} heroes in pipeline (not yet Active)`
          : `${filtered.length} heroes in "${filter}" stage`}
      </div>

      {/* Pipeline Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--card-border)",
                textAlign: "left",
              }}
            >
              <th style={thStyle}>Hero</th>
              <th style={thStyle}>SKU</th>
              <th style={thStyle}>Stage</th>
              <th style={thStyle}>Family</th>
              <th style={thStyle}>Design</th>
              <th style={thStyle}>Bio Page</th>
              <th style={thStyle}>Inventory</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => (
              <tr
                key={h.id}
                style={{ borderBottom: "1px solid var(--card-border)" }}
              >
                <td style={tdStyle}>
                  <div
                    style={{
                      fontWeight: 500,
                      color: "var(--text-bright)",
                    }}
                  >
                    {h.rank ? `${h.rank} ` : ""}
                    {h.lastName || h.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-dim)",
                    }}
                  >
                    {h.branch || h.incident || ""}
                  </div>
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "var(--text-dim)",
                    }}
                  >
                    {h.sku || "\u2014"}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${STAGE_COLORS[h.stage]}22`,
                      color: STAGE_COLORS[h.stage],
                      border: `1px solid ${STAGE_COLORS[h.stage]}44`,
                    }}
                  >
                    {STAGE_ICONS[h.stage]} {h.stage}
                  </span>
                </td>
                <td style={tdStyle}>
                  {h.hasFamilyContact ? (
                    <span style={{ color: "var(--status-green)" }}>{"\u2713"}</span>
                  ) : (
                    <span style={{ color: "var(--status-red)" }}>{"\u2717"}</span>
                  )}
                </td>
                <td style={tdStyle}>
                  {h.hasDesign ? (
                    <span style={{ color: "var(--status-green)" }}>{"\u2713"}</span>
                  ) : h.designStatus ? (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--status-orange)",
                      }}
                    >
                      {h.designStatus}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-dim)" }}>Needed</span>
                  )}
                </td>
                <td style={tdStyle}>
                  {h.bioPage ? (
                    <a
                      href={h.bioPage}
                      target="_blank"
                      rel="noopener"
                      style={{
                        color: "var(--status-green)",
                        fontSize: 11,
                      }}
                    >
                      {"\u2713"} Live
                    </a>
                  ) : (
                    <span style={{ color: "var(--text-dim)" }}>Needed</span>
                  )}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        h.totalOnHand === 0
                          ? "var(--text-dim)"
                          : h.totalOnHand <= 5
                          ? "var(--status-orange)"
                          : "var(--text-bright)",
                    }}
                  >
                    {h.totalOnHand || 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "var(--text-dim)",
            fontSize: 13,
          }}
        >
          {search
            ? "No heroes match your search."
            : filter === "all"
            ? "All heroes are in Active stage."
            : `No heroes in "${filter}" stage.`}
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const tdStyle = {
  padding: "8px 12px",
  color: "var(--text)",
};
