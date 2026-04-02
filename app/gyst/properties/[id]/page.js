import { notFound } from "next/navigation";
import Link from "next/link";
import { getPropertyById, getPropertySummary } from "@/lib/data/properties";

export const dynamic = "force-dynamic";

function fmt(n) {
  return n != null ? `$${Number(n).toLocaleString()}` : "—";
}

const STATUS_COLORS = {
  active: "var(--status-green)",
  turnover: "var(--gold)",
  vacant: "var(--status-red)",
  sold: "var(--text-dim)",
};

export default async function PropertyDetailPage({ params }) {
  const { id } = await params;
  let property;

  try {
    property = await getPropertyById(id);
  } catch {
    notFound();
  }

  if (!property) notFound();

  const costs = property.gyst_property_costs || [];
  const summary = getPropertySummary(property, costs);

  const oneTimeCosts = costs.filter((c) => !c.is_recurring);
  const monthlyCosts = costs.filter((c) => c.is_recurring && c.recurring_period === "monthly");
  const annualCosts = costs.filter((c) => c.is_recurring && c.recurring_period === "annual");

  // Group one-time by category
  const grouped = {};
  for (const c of oneTimeCosts) {
    const cat = c.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(c);
  }

  const statusColor = STATUS_COLORS[(property.role || "rental")] || "var(--text-dim)";

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/gyst/properties" style={{ fontSize: 12, color: "var(--text-dim)", textDecoration: "none" }}>
          Properties
        </Link>
        <span style={{ fontSize: 12, color: "var(--text-dim)", margin: "0 6px" }}>/</span>
        <span style={{ fontSize: 12, color: "var(--text-bright)" }}>{property.address}</span>
      </div>

      {/* Property Info Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-bright)", margin: 0 }}>
                {property.address}
              </h2>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
                {property.address}, {property.city}, {property.state} {property.zip}
              </div>
            </div>
            <span style={{
              padding: "3px 12px",
              borderRadius: "var(--radius-pill)",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              background: `${statusColor}20`,
              color: statusColor,
              border: `1px solid ${statusColor}40`,
            }}>
              {(property.role || "rental")}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px 20px" }}>
            <MetricCell label="Mortgage Balance" value={fmt(property.mortgage_balance)} />
            <MetricCell label="Estimated Value" value={fmt(property.estimated_value)} />
            <MetricCell label="Equity" value={fmt(summary.equity)} accent={summary.equity > 0 ? "var(--status-green)" : "var(--status-red)"} />
            <MetricCell label="Mortgage Rate" value={property.mortgage_rate ? `${Number(property.mortgage_rate).toFixed(2)}%` : "—"} />
            <MetricCell label="Lease Rate" value={`${fmt(property.rental_income)}/mo`} />
            <MetricCell label="Lease Term" value={`${summary.leaseTermMonths || "—"} months`} />
            <MetricCell label="Lease End" value={property.lease_end || "—"} />
            <MetricCell label="Tenant" value={property.tenant_name || "Vacant"} />
            <MetricCell label="Mortgage Payment" value={property.mortgage_payment ? fmt(property.mortgage_payment) + "/mo" : "—"} />
            <MetricCell label="Property Tax" value={property.property_tax_annual ? fmt(property.property_tax_annual) + "/yr" : "—"} />
          </div>
        </div>
      </div>

      {/* 2-Year P&L Summary */}
      <div className="card" style={{ marginBottom: 16, borderTop: "2px solid var(--status-green)" }}>
        <div style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-bright)", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            2-Year Investment P&L
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
            <BigStat label="Gross Rent" value={fmt(summary.grossRevenue)} accent="var(--status-green)" sub={`${fmt(property.rental_income)}/mo x ${summary.leaseTermMonths} months`} />
            <BigStat label="One-Time Investment" value={fmt(summary.totalOneTime)} accent="var(--status-red)" />
            <BigStat label="Recurring (2yr)" value={fmt(Math.round(summary.totalRecurring2yr))} accent="var(--status-red)" sub={`${fmt(summary.monthlyUtilities)}/mo util + ${fmt(summary.annualMaintenance)}/yr maint`} />
            <BigStat label="Net Profit" value={fmt(Math.round(summary.netProfit))} accent={summary.netProfit >= 0 ? "var(--status-green)" : "var(--status-red)"} />
            <BigStat label="Payback Period" value={summary.paybackMonths ? `${summary.paybackMonths} months` : "N/A"} accent="var(--gold)" />
          </div>
        </div>
      </div>

      {/* Investment Costs — One-Time */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-bright)", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            One-Time Investment Costs
          </h3>

          {Object.entries(grouped).map(([category, items]) => {
            const catTotal = items.reduce((s, c) => s + (c.high_estimate || 0), 0);
            return (
              <div key={category} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid var(--card-border)" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {category}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>
                    {fmt(catTotal)}
                  </span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {items.map((c) => (
                      <tr key={c.id}>
                        <td style={{ padding: "4px 0", fontSize: 13, color: "var(--text)" }}>{c.item}</td>
                        <td style={{ padding: "4px 8px", fontSize: 12, color: "var(--text-dim)", textAlign: "right", whiteSpace: "nowrap" }}>
                          {c.timing || ""}
                        </td>
                        <td style={{ padding: "4px 8px", fontSize: 12, color: "var(--text-dim)", textAlign: "right", whiteSpace: "nowrap" }}>
                          {c.financing_method || ""}
                        </td>
                        <td style={{ padding: "4px 0", fontSize: 13, fontWeight: 600, color: "var(--text-bright)", textAlign: "right", whiteSpace: "nowrap" }}>
                          {fmt(c.high_estimate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Grand total */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "2px solid var(--card-border)" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-bright)" }}>
              TOTAL ONE-TIME
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--status-red)" }}>
              {fmt(summary.totalOneTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Recurring Costs */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-bright)", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Recurring Costs
          </h3>

          {/* Monthly utilities */}
          {monthlyCosts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid var(--card-border)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Monthly Utilities
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>
                  {fmt(summary.monthlyUtilities)}/mo
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {monthlyCosts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ padding: "4px 0", fontSize: 13, color: "var(--text)" }}>{c.item}</td>
                      <td style={{ padding: "4px 0", fontSize: 13, fontWeight: 600, color: "var(--text-bright)", textAlign: "right" }}>
                        {fmt(c.high_estimate)}/mo
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Annual maintenance */}
          {annualCosts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid var(--card-border)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Annual Maintenance
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>
                  {fmt(summary.annualMaintenance)}/yr
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {annualCosts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ padding: "4px 0", fontSize: 13, color: "var(--text)" }}>{c.item}</td>
                      <td style={{ padding: "4px 0", fontSize: 13, fontWeight: 600, color: "var(--text-bright)", textAlign: "right" }}>
                        {fmt(c.high_estimate)}/yr
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 2-year total */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "2px solid var(--card-border)" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-bright)" }}>
              TOTAL RECURRING ({summary.leaseTermMonths / 12}yr)
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--status-red)" }}>
              {fmt(Math.round(summary.totalRecurring2yr))}
            </span>
          </div>
        </div>
      </div>

      {/* Financing Summary */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-bright)", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Financing Breakdown
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {Object.entries(summary.financing).map(([source, amount]) => (
                <tr key={source}>
                  <td style={{ padding: "6px 0", fontSize: 13, color: "var(--text)" }}>{source}</td>
                  <td style={{ padding: "6px 0", fontSize: 14, fontWeight: 600, color: "var(--text-bright)", textAlign: "right" }}>
                    {fmt(amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "1px solid var(--card-border)", marginTop: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-bright)" }}>TOTAL</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-bright)" }}>
              {fmt(summary.totalOneTime)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function MetricCell({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: accent || "var(--text-bright)" }}>
        {value}
      </div>
    </div>
  );
}

function BigStat({ label, value, accent, sub }) {
  return (
    <div style={{ padding: 12, background: "var(--bg-3)", borderRadius: "var(--radius-md)" }}>
      <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || "var(--text-bright)" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
