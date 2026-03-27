import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import { getHeroes } from "@/lib/data/heroes";
import { getVolunteers } from "@/lib/data/volunteers";
import { getDisbursements, getDisbursementStats } from "@/lib/data/disbursements";
import { getOrgBalances, getAnniversaryObligations, getDVariantDonors } from "@/lib/data/obligations";
import { getCurrentYear, getCurrentMonth, getMonthName, getNextMonth, getNextMonthYear, formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function FinanceOverviewPage() {
  const year = getCurrentYear();
  const month = getCurrentMonth();
  const nextMo = getNextMonth(month);
  const nextMoYear = getNextMonthYear(month, year);

  const [
    heroes,
    volunteers,
    orgBalances,
    disbursementStats,
    recentDisbursements,
    upcomingObligations,
    dVariantDonors,
  ] = await Promise.all([
    getHeroes(),
    getVolunteers(),
    getOrgBalances(),
    getDisbursementStats(),
    getDisbursements(),
    getAnniversaryObligations(nextMo, nextMoYear),
    getDVariantDonors(year),
  ]);

  const recent10 = recentDisbursements.slice(0, 10);
  const hasOrgData = orgBalances.length > 0;
  const hasDisbursementData = disbursementStats.totalCount > 0;

  // Aggregate from org balances
  const totalAccrued = orgBalances.reduce((s, o) => s + o.accrued, 0);
  const totalDisbursed = orgBalances.reduce((s, o) => s + o.disbursed, 0);
  const totalOutstanding = orgBalances.reduce((s, o) => s + o.outstanding, 0);

  // D-variant totals
  const dVariantTotal = dVariantDonors.reduce((s, d) => s + d.totalContribution, 0);
  const dVariantCount = dVariantDonors.length;

  // Legacy hero-level stats (keep for branch breakdown)
  const hasDonationData = heroes.some((h) => h.totalDonations > 0);
  const branchDonations = {};
  for (const h of heroes) {
    if ((h.totalDonations || 0) > 0) {
      const code = h.serviceCode || "Unknown";
      if (!branchDonations[code]) branchDonations[code] = { total: 0, count: 0 };
      branchDonations[code].total += h.totalDonations || 0;
      branchDonations[code].count += 1;
    }
  }

  // Finance team
  const financeTeam = volunteers.filter(
    (v) => v.domains?.includes("Finance") || v.domains?.includes("All")
  );

  return (
    <>
      {/* KPI Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Total Obligations Accrued"
          value={hasOrgData ? `$${totalAccrued.toLocaleString()}` : "\u2014"}
          note={hasOrgData ? `Across ${orgBalances.length} organizations` : "Connect Salesforce for live data"}
          accent="var(--gold)"
        />
        <StatBlock
          label="Total Disbursed"
          value={hasOrgData ? `$${totalDisbursed.toLocaleString()}` : "\u2014"}
          note={hasDisbursementData ? `${disbursementStats.totalCount} disbursements recorded` : "No disbursements yet"}
          accent="var(--status-green)"
        />
        <StatBlock
          label="Outstanding Balance"
          value={hasOrgData ? `$${totalOutstanding.toLocaleString()}` : "\u2014"}
          note={totalOutstanding > 0 ? "Owed to charity partners" : "All caught up"}
          accent={totalOutstanding > 0 ? "var(--status-red)" : "var(--status-green)"}
        />
        <StatBlock
          label="Receipt Compliance"
          value={hasDisbursementData ? `${disbursementStats.receiptComplianceRate}%` : "\u2014"}
          note={hasDisbursementData ? `${disbursementStats.receiptCount} of ${disbursementStats.totalCount} have receipts` : "No disbursements yet"}
          accent="var(--status-blue)"
        />
      </div>

      {/* Org Balances + Upcoming Payouts */}
      <div className="grid-2">
        <DataCard title="Organization Balances">
          {!hasOrgData ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "16px 0" }}>
              Organization data requires Salesforce connection (SF_LIVE=true)
            </p>
          ) : (
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Organization</th>
                    <th style={{ textAlign: "right" }}>Accrued</th>
                    <th style={{ textAlign: "right" }}>Disbursed</th>
                    <th style={{ textAlign: "right" }}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {orgBalances
                    .filter((o) => o.accrued > 0 || o.outstanding > 0)
                    .slice(0, 30)
                    .map((org) => (
                      <tr key={org.orgId}>
                        <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {org.orgName}
                        </td>
                        <td style={{ textAlign: "right", color: "var(--text-dim)" }}>
                          ${org.accrued.toLocaleString()}
                        </td>
                        <td style={{ textAlign: "right", color: "var(--status-green)" }}>
                          ${org.disbursed.toLocaleString()}
                        </td>
                        <td style={{
                          textAlign: "right",
                          fontWeight: org.outstanding > 0 ? 600 : 400,
                          color: org.outstanding > 0 ? "var(--status-red)" : "var(--text-dim)",
                        }}>
                          ${org.outstanding.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {orgBalances.filter((o) => o.accrued > 0 || o.outstanding > 0).length > 30 && (
                <div style={{ fontSize: 11, color: "var(--text-dim)", padding: "8px 0", textAlign: "center" }}>
                  Showing top 30 of {orgBalances.filter((o) => o.accrued > 0 || o.outstanding > 0).length} organizations
                </div>
              )}
            </div>
          )}
        </DataCard>

        <DataCard title={`Upcoming Payouts — ${getMonthName(nextMo)} ${nextMoYear} Anniversaries`}>
          {upcomingObligations.heroes.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "16px 0" }}>
              {upcomingObligations.error
                ? "Could not load upcoming obligations"
                : `No heroes with ${getMonthName(nextMo)} anniversaries`}
            </p>
          ) : (
            <>
              <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  Estimated for {getMonthName(nextMo)}
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  <div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>
                      {upcomingObligations.totals.heroCount}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 4 }}>heroes</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>
                      {upcomingObligations.totals.totalUnits}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 4 }}>units</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--status-green)" }}>
                      ${upcomingObligations.totals.totalCharityObligation.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 4 }}>due</span>
                  </div>
                </div>
              </div>
              <div style={{ maxHeight: 350, overflowY: "auto" }}>
                {upcomingObligations.heroes
                  .filter((h) => h.totalUnits > 0)
                  .sort((a, b) => b.charityObligation - a.charityObligation)
                  .map((hero) => (
                    <div key={hero.sfId} className="list-item">
                      <div>
                        <div className="list-item-title">{hero.fullName || hero.name}</div>
                        <div className="list-item-sub">
                          {hero.totalUnits} units
                          {hero.dVariantUnits > 0 && ` (${hero.dVariantUnits} D-variant)`}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-green)", whiteSpace: "nowrap" }}>
                        ${hero.charityObligation.toLocaleString()}
                      </div>
                    </div>
                  ))}
                {upcomingObligations.heroes.filter((h) => h.totalUnits === 0).length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", padding: "8px 0", textAlign: "center" }}>
                    {upcomingObligations.heroes.filter((h) => h.totalUnits === 0).length} heroes with zero sales
                  </div>
                )}
              </div>
            </>
          )}
        </DataCard>
      </div>

      {/* Recent Disbursements */}
      <DataCard title="Recent Disbursements">
        {recent10.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "16px 0" }}>
            No disbursement records yet. Disbursements are logged in Donation_Disbursement__c.
          </p>
        ) : (
          <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Record</th>
                <th style={{ textAlign: "left" }}>Organization</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th style={{ textAlign: "center" }}>Cycle</th>
                <th style={{ textAlign: "left" }}>Method</th>
                <th style={{ textAlign: "center" }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {recent10.map((d) => (
                <tr key={d.sfId}>
                  <td style={{ color: "var(--text-dim)" }}>{d.name}</td>
                  <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.organizationName || "—"}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--status-green)" }}>
                    ${d.amount.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "center", color: "var(--text-dim)" }}>
                    {d.cycleMonth && d.cycleYear ? `${getMonthName(d.cycleMonth).slice(0, 3)} ${d.cycleYear}` : "—"}
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>{d.paymentMethod || "—"}</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-pill)",
                      fontSize: 10,
                      fontWeight: 600,
                      background: d.receiptCaptured ? "rgba(39,174,96,0.15)" : "rgba(231,76,60,0.15)",
                      color: d.receiptCaptured ? "var(--status-green)" : "var(--status-red)",
                    }}>
                      {d.receiptCaptured ? "Captured" : "Missing"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataCard>

      {/* D-Variant Summary + Branch Breakdown */}
      <div className="grid-2">
        <DataCard title={`D-Variant Donations — ${year}`}>
          <div style={{ padding: "8px 0" }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>
                  ${dVariantTotal.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>
                  Additional SH Fund Revenue
                </div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-bright)" }}>
                  {dVariantCount}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>
                  D-Variant Donors
                </div>
              </div>
            </div>
            {dVariantDonors.length > 0 ? (
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {dVariantDonors.slice(0, 10).map((d, i) => (
                  <div key={d.email || i} className="list-item" style={{ padding: "6px 0" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-bright)" }}>{d.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                        {d.purchases} purchase{d.purchases !== 1 ? "s" : ""} &middot; Last: {formatDate(d.lastDate)}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>
                      +${d.totalContribution}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
                No D-variant purchases detected in {year}
              </p>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)" }}>
              D-variants are $45 bracelets where the extra $10 goes directly to Steel Hearts Fund.
              <a href="/donors" style={{ color: "var(--gold)", marginLeft: 4 }}>View in Donor Engagement &rarr;</a>
            </div>
          </div>
        </DataCard>

        <DataCard title="Donations by Service Branch">
          {Object.keys(branchDonations).length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "16px 0" }}>
              Branch breakdown requires live Salesforce data.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", padding: "12px 0" }}>
              {Object.entries(branchDonations)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([code, data]) => (
                  <div key={code} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--status-green)" }}>
                      ${data.total.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {code}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                      {data.count} heroes
                    </div>
                  </div>
                ))}
            </div>
          )}
        </DataCard>
      </div>

      {/* Monthly Disbursement Trend */}
      {hasDisbursementData && Object.keys(disbursementStats.byMonth).length > 0 && (
        <DataCard title={`${year} Disbursement Trend`}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "8px 0" }}>
            {Array.from({ length: 12 }, (_, i) => {
              const mo = i + 1;
              const key = `${year}-${String(mo).padStart(2, "0")}`;
              const amount = disbursementStats.byMonth[key] || 0;
              const isPast = mo <= month;
              return (
                <div key={mo} style={{ textAlign: "center", minWidth: 60 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: amount > 0 ? 700 : 400,
                    color: amount > 0 ? "var(--status-green)" : isPast ? "var(--text-dim)" : "var(--card-border)",
                  }}>
                    {amount > 0 ? `$${amount.toLocaleString()}` : isPast ? "$0" : "—"}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: mo === month ? "var(--gold)" : "var(--text-dim)",
                    fontWeight: mo === month ? 600 : 400,
                    textTransform: "uppercase",
                  }}>
                    {getMonthName(mo).slice(0, 3)}
                  </div>
                </div>
              );
            })}
          </div>
        </DataCard>
      )}

      {/* Finance Team & QuickBooks */}
      <div className="grid-2">
        <DataCard title="Finance Team">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {financeTeam.map((v) => (
              <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: v.color || "var(--text-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {v.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-bright)" }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    {v.role}
                    {v.isExternal && " (External)"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title="QuickBooks Integration">
          <div style={{ padding: "12px 0" }}>
            <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 8 }}>
              Financial records are managed in QuickBooks Online.
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
              <div style={{ marginBottom: 4 }}><strong>Chart of accounts:</strong> Managed by Sara Curran</div>
              <div style={{ marginBottom: 4 }}><strong>Bank reconciliation:</strong> Monthly</div>
              <div style={{ marginBottom: 4 }}><strong>Relevant SOPs:</strong> SOP-FIN-001 v2.2</div>
            </div>
            <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", fontSize: 11, color: "var(--text-dim)" }}>
              Disbursements are now tracked in Salesforce (Donation_Disbursement__c). QuickBooks remains the accounting system of record.
            </div>
          </div>
        </DataCard>
      </div>
    </>
  );
}
