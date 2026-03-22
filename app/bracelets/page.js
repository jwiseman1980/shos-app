import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import StatusBadge from "@/components/StatusBadge";
import PipelineTracker from "@/components/PipelineTracker";
import {
  getBraceletStats,
  getBraceletsByDesignStage,
  getLowStockBracelets,
  getInventoryOverview,
} from "@/lib/data/bracelets";
import { getPipelineHeroes } from "@/lib/data/pipeline";

const STAGE_ORDER = ["Draft", "Review", "Approved", "In Production", "Complete"];
const STAGE_COLORS = {
  Draft: "var(--text-dim)",
  Review: "var(--status-purple)",
  Approved: "var(--status-blue)",
  "In Production": "var(--status-orange)",
  Complete: "var(--status-green)",
  Blocked: "var(--status-red)",
  Unknown: "var(--text-dim)",
};

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

export default async function BraceletPipelinePage() {
  const stats = await getBraceletStats();
  const stageGroups = await getBraceletsByDesignStage();
  const lowStock = await getLowStockBracelets();
  const inventory = await getInventoryOverview();
  const pipeline = await getPipelineHeroes();

  // Pipeline bar widths (percentage of total)
  const pipelineStages = STAGE_ORDER.map((stage) => ({
    name: stage,
    count: stageGroups[stage]?.length || 0,
    color: STAGE_COLORS[stage],
    pct: stats.total > 0 ? ((stageGroups[stage]?.length || 0) / stats.total) * 100 : 0,
  }));

  return (
    <PageShell
      title="Bracelet Pipeline"
      subtitle="Commission tracking, inventory, and fulfillment"
    >
      {/* KPI Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Total Bracelets"
          value={stats.total}
          note={`${stats.active} with active listings`}
          accent="var(--gold)"
        />
        <StatBlock
          label="Total Inventory"
          value={stats.hasSFData ? stats.totalInventory.toLocaleString() : "\u2014"}
          note={
            stats.hasSFData
              ? `${stats.totalInventory7in} \u00d7 7in \u00b7 ${stats.totalInventory6in} \u00d7 6in`
              : "Connect Salesforce for live data"
          }
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Low Stock"
          value={stats.hasSFData ? stats.lowStock : "\u2014"}
          note={
            stats.hasSFData
              ? `${stats.outOfStock} out of stock`
              : "Requires live inventory"
          }
          accent="var(--status-orange)"
        />
        <StatBlock
          label="Total Donations"
          value={
            stats.hasSFData
              ? `$${stats.totalDonations.toLocaleString()}`
              : "\u2014"
          }
          note="Raised through bracelet sales"
          accent="var(--status-green)"
        />
      </div>

      {/* New Intake — active onboarding */}
      {pipeline.newIntake && pipeline.newIntake.length > 0 && (
        <div className="section">
          <DataCard title={`New Intake (${pipeline.stats.newIntakeCount || 0} heroes being onboarded)`}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>
              Active requests — someone is waiting on us. These need family contact,
              design, and listing before going live.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)", textAlign: "left" }}>
                    <th style={thStyle}>Hero</th>
                    <th style={thStyle}>SKU</th>
                    <th style={thStyle}>Branch</th>
                    <th style={thStyle}>Family Contact</th>
                    <th style={thStyle}>Next Step</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.newIntake.map((h) => (
                    <tr key={h.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 500, color: "var(--text-bright)" }}>
                          {h.name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          {h.incident || ""}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                          {h.sku || "\u2014"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          {h.branch || "\u2014"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {h.hasFamilyContact ? (
                          <span style={{ color: "var(--status-green)" }}>{"\u2713"} Connected</span>
                        ) : (
                          <span style={{ color: "var(--status-orange)" }}>Needed</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                          background: h.stage === "Intake" ? "#6b728022" :
                            h.stage === "Family Outreach" ? "#8b5cf622" :
                            h.stage === "Charity Designation" ? "#3b82f622" :
                            h.stage === "Design" ? "#f59e0b22" : "#6b728022",
                          color: h.stage === "Intake" ? "#6b7280" :
                            h.stage === "Family Outreach" ? "#8b5cf6" :
                            h.stage === "Charity Designation" ? "#3b82f6" :
                            h.stage === "Design" ? "#f59e0b" : "#6b7280",
                        }}>
                          {h.stage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataCard>
        </div>
      )}

      {/* Memorial Pipeline Tracker */}
      <div className="section">
        <DataCard title={`Full Pipeline (${pipeline.stats.inPipeline || 0} in progress)`}>
          {pipeline.heroes.length > 0 ? (
            <PipelineTracker
              heroes={pipeline.heroes}
              inProgress={pipeline.inProgress || []}
              stageCounts={pipeline.stageCounts || {}}
              stats={pipeline.stats || {}}
            />
          ) : (
            <div style={{ padding: "16px 0", color: "var(--text-dim)", fontSize: 13 }}>
              Connect Salesforce (SF_LIVE=true) for pipeline tracking.
            </div>
          )}
        </DataCard>
      </div>

      {/* Research Queue — Active heroes missing family contacts */}
      {pipeline.researchQueue && pipeline.researchQueue.length > 0 && (
        <div className="section">
          <DataCard
            title={`Family Contact Research (${pipeline.stats.needsResearch || 0} heroes)`}
          >
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>
              Legacy bracelets missing family contacts — grouped by anniversary month.
              Research to find families, confirm they exist, or recommend sunset.
              Goal: resolve all by end of 2026. No new bracelets added without family contact.
            </div>
            {Object.entries(pipeline.researchByMonth || {}).map(
              ([month, heroes]) => (
                <div key={month} style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-bright)",
                      marginBottom: 8,
                      paddingBottom: 4,
                      borderBottom: "1px solid var(--card-border)",
                    }}
                  >
                    {month} ({heroes.length})
                  </div>
                  {heroes.map((h) => (
                    <div
                      key={h.id}
                      className="list-item"
                      style={{ padding: "6px 0" }}
                    >
                      <div>
                        <div className="list-item-title">
                          {h.rank ? `${h.rank} ` : ""}
                          {h.name}
                        </div>
                        <div className="list-item-sub">
                          {h.sku || "\u2014"}
                          {h.incident ? ` \u00b7 ${h.incident}` : ""}
                          {h.memorialDate
                            ? ` \u00b7 ${h.memorialDate}`
                            : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {h.bioPage ? (
                          <span
                            style={{
                              fontSize: 10,
                              color: "var(--status-green)",
                            }}
                          >
                            Has bio page
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 10,
                              color: "var(--status-orange)",
                            }}
                          >
                            No bio page
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </DataCard>
        </div>
      )}

      {/* Design Pipeline Bar */}
      <div className="section">
        <DataCard title="Design Pipeline">
          {!stats.hasSFData ? (
            <div style={{ padding: "12px 0" }}>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 12 }}>
                Design pipeline data requires a live Salesforce connection.
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-bright)" }}>{stats.total}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Bracelets</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--status-green)" }}>{stats.active}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Active Listings</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  height: 32,
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                  marginBottom: 16,
                  background: "var(--card-border)",
                }}
              >
                {pipelineStages.map((stage) =>
                  stage.count > 0 ? (
                    <div
                      key={stage.name}
                      title={`${stage.name}: ${stage.count}`}
                      style={{
                        width: `${stage.pct}%`,
                        background: stage.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#fff",
                        minWidth: stage.pct > 4 ? "auto" : 0,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        transition: "width 0.3s ease",
                      }}
                    >
                      {stage.pct > 8 ? `${stage.count}` : ""}
                    </div>
                  ) : null
                )}
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                {pipelineStages.map((stage) => (
                  <div
                    key={stage.name}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: stage.color,
                      }}
                    />
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {stage.name}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>
                      {stage.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </DataCard>
      </div>

      <div className="grid-2">
        {/* Low Stock Alerts */}
        <DataCard title={`Low Stock Alerts${stats.hasSFData ? ` (${lowStock.length})` : ""}`}>
          {!stats.hasSFData ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              Connect Salesforce for live inventory tracking.
            </p>
          ) : lowStock.length === 0 ? (
            <p style={{ color: "var(--status-green)", fontSize: 13 }}>
              All active bracelets are well-stocked.
            </p>
          ) : (
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {lowStock.map((b) => (
                <div key={b.sfId} className="list-item">
                  <div>
                    <div className="list-item-title">
                      {b.rank} {b.lastName || b.fullName?.split(" ").pop()}
                    </div>
                    <div className="list-item-sub">
                      {b.serviceCode} &middot; SKU: {b.sku || "\u2014"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color:
                          (b.totalOnHand || 0) === 0
                            ? "var(--status-red)"
                            : "var(--status-orange)",
                      }}
                    >
                      {b.totalOnHand || 0}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                      on hand
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataCard>

        {/* Design Stage Breakdown */}
        <DataCard title="Design Stages">
          {!stats.hasSFData ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              Connect Salesforce for design status tracking.
            </p>
          ) : (
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {STAGE_ORDER.map((stage) => {
                const items = stageGroups[stage] || [];
                if (items.length === 0) return null;
                return (
                  <div key={stage} style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: STAGE_COLORS[stage],
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-dim)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {stage} ({items.length})
                      </span>
                    </div>
                    {items.slice(0, 5).map((b) => (
                      <div key={b.sfId} className="list-item">
                        <div>
                          <div className="list-item-title">
                            {b.rank}{" "}
                            {b.fullName
                              ? b.fullName.replace(/\s*\(.*?\)\s*/, "")
                              : b.name}
                          </div>
                          <div className="list-item-sub">{b.serviceCode}</div>
                        </div>
                        <StatusBadge status={stage} />
                      </div>
                    ))}
                    {items.length > 5 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-dim)",
                          paddingLeft: 16,
                          paddingTop: 4,
                        }}
                      >
                        + {items.length - 5} more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DataCard>
      </div>

      {/* Full Inventory Table */}
      <div className="section" style={{ marginTop: 24 }}>
        <DataCard title={`Active Inventory (${inventory.length} bracelets)`}>
          {!stats.hasSFData ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8, filter: "grayscale(1)" }}>
                &#x1F4E6;
              </div>
              <div style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 4 }}>
                Live inventory requires Salesforce connection
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Set SF_LIVE=true with a valid Connected App to see real-time stock levels
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)", textAlign: "left" }}>
                    <th style={thStyle}>Hero</th>
                    <th style={thStyle}>Branch</th>
                    <th style={thStyle}>SKU</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>7in</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>6in</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((b) => (
                    <tr key={b.sfId} style={{ borderBottom: "1px solid var(--card-border)" }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 500, color: "var(--text-bright)" }}>
                          {b.rank} {b.lastName || b.fullName?.split(" ").pop()}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{b.serviceCode}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                          {b.sku || "\u2014"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{b.onHand7in || 0}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{b.onHand6in || 0}</td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontWeight: 600,
                          color:
                            (b.totalOnHand || 0) === 0
                              ? "var(--status-red)"
                              : (b.totalOnHand || 0) <= 5
                              ? "var(--status-orange)"
                              : "var(--text-bright)",
                        }}
                      >
                        {b.totalOnHand || 0}
                      </td>
                      <td style={tdStyle}>
                        <StatusBadge status={b.designStatus || "Unknown"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>
      </div>

      {/* Branch Distribution for Active Listings */}
      <div className="section">
        <DataCard title="Active Listings by Branch">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {Object.entries(stats.activeBranchCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([code, count]) => (
                <div key={code} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-bright)" }}>
                    {count}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-dim)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {code}
                  </div>
                </div>
              ))}
          </div>
        </DataCard>
      </div>
    </PageShell>
  );
}
