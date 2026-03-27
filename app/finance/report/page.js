import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import ReportSheet from "@/components/ReportSheet";
import MonthPicker from "@/components/MonthPicker";
import { assembleMonthlyReport } from "@/lib/data/monthly-report";
import { getCurrentMonth, getCurrentYear, getMonthName, formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function MonthlyReportPage({ searchParams }) {
  const params = await searchParams;
  // Default to previous month (the report is always for the prior month)
  const currentMonth = getCurrentMonth();
  const currentYear = getCurrentYear();
  const defaultMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const defaultYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const month = Number(params?.month) || defaultMonth;
  const year = Number(params?.year) || defaultYear;

  let report = null;
  let error = null;
  try {
    report = await assembleMonthlyReport(month, year);
  } catch (err) {
    error = err.message;
  }

  if (error || !report) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)" }}>
            {getMonthName(month)} {year} Report
          </div>
          <MonthPicker month={month} year={year} basePath="/finance/report" />
        </div>
        <DataCard title="Error">
          <p style={{ color: "var(--status-red)", fontSize: 13, padding: "16px 0" }}>
            {error || "Could not load report data. Ensure Salesforce is connected."}
          </p>
        </DataCard>
      </>
    );
  }

  const s = report.summary;

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)" }}>
          {getMonthName(month)} {year} Report
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <MonthPicker month={month} year={year} basePath="/finance/report" />
          <a
            href={`/api/finance/report/export?month=${month}&year=${year}`}
            className="btn btn-primary"
            style={{ fontSize: 12, padding: "6px 14px" }}
          >
            Export Excel
          </a>
        </div>
      </div>

      {/* Sheet 1: Summary Dashboard */}
      <ReportSheet number={1} title="Summary Dashboard" badge="Auto" badgeColor="green">
        <div className="stat-grid">
          <StatBlock
            label="Money In"
            value={`$${s.moneyIn.total.toLocaleString()}`}
            note={`Sales: $${s.moneyIn.braceletSales.toLocaleString()} + Donations: $${s.moneyIn.donationsReceived.toLocaleString()}`}
            accent="var(--status-green)"
          />
          <StatBlock
            label="Money Out"
            value={`$${s.moneyOut.total.toLocaleString()}`}
            note={`Disbursements + Donated + Expenses`}
            accent="var(--status-red)"
          />
          <StatBlock
            label="Net"
            value={`${s.net >= 0 ? "+" : ""}$${s.net.toLocaleString()}`}
            note={s.net >= 0 ? "Surplus" : "Deficit"}
            accent={s.net >= 0 ? "var(--status-green)" : "var(--status-red)"}
          />
          <StatBlock
            label="Obligation Balance"
            value={`$${s.obligations.closingBalance.toLocaleString()}`}
            note={`New: $${s.obligations.newThisMonth.toLocaleString()} | Fulfilled: $${s.obligations.fulfilledThisMonth.toLocaleString()}`}
            accent="var(--gold)"
          />
        </div>
        <div style={{ display: "flex", gap: 24, padding: "8px 0", fontSize: 12, color: "var(--text-dim)" }}>
          <div>Bracelets Sold: <strong style={{ color: "var(--text-bright)" }}>{s.keyMetrics.braceletsSold}</strong>{s.keyMetrics.obligationBracelets !== s.keyMetrics.braceletsSold && <span style={{ color: "var(--text-dim)" }}> ({s.keyMetrics.obligationBracelets} obligation-gen)</span>}</div>
          <div>Bracelets Donated: <strong style={{ color: "var(--text-bright)" }}>{s.keyMetrics.braceletsDonated}</strong></div>
          <div>Orgs Supported: <strong style={{ color: "var(--text-bright)" }}>{s.keyMetrics.orgsSupported}</strong></div>
          <div>SH Fund (D-variant): <strong style={{ color: "var(--gold)" }}>+${s.keyMetrics.shFundDonations.toLocaleString()}</strong></div>
        </div>
      </ReportSheet>

      {/* Sheet 2: Bracelet Sales */}
      <ReportSheet number={2} title="Bracelet Sales" badge={`${report.braceletSales.length} items`} badgeColor="green">
        {report.braceletSales.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 12 }}>No bracelet sales data for this period.</p>
        ) : (
          <div style={{ maxHeight: 350, overflowY: "auto" }}>
            <table className="data-table" style={{ width: "100%", fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order</th>
                  <th>SKU</th>
                  <th>Hero</th>
                  <th style={{ textAlign: "center" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Price</th>
                  <th style={{ textAlign: "right" }}>Revenue</th>
                  <th>Org</th>
                  <th style={{ textAlign: "right" }}>$10 Oblig.</th>
                </tr>
              </thead>
              <tbody>
                {report.braceletSales.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--text-dim)", fontSize: 10 }}>{r.orderDate?.slice(0, 10)}</td>
                    <td style={{ color: "var(--text-dim)", fontSize: 10 }}>{r.orderNumber}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                      {r.sku}
                      {r.isDVariant && <span style={{ color: "var(--gold)", marginLeft: 4 }}>D</span>}
                    </td>
                    <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.heroName}</td>
                    <td style={{ textAlign: "center" }}>{r.quantity}</td>
                    <td style={{ textAlign: "right", color: "var(--text-dim)" }}>${r.unitPrice}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>${r.lineTotal}</td>
                    <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-dim)", fontSize: 10 }}>
                      {r.designatedOrg || "—"}
                    </td>
                    <td style={{ textAlign: "right", color: r.obligationAmount > 0 ? "var(--status-green)" : "var(--text-dim)" }}>
                      {r.obligationAmount > 0 ? `$${r.obligationAmount}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)", display: "flex", gap: 16 }}>
          <span>Total Revenue: <strong style={{ color: "var(--text-bright)" }}>${s.moneyIn.braceletSales.toLocaleString()}</strong></span>
          <span>Bracelet Units: <strong>{s.keyMetrics.braceletsSold}</strong></span>
          <span>Obligations Generated: <strong style={{ color: "var(--status-green)" }}>${s.obligations.newThisMonth.toLocaleString()}</strong></span>
        </div>
      </ReportSheet>

      {/* Sheet 3: Donations Received */}
      <ReportSheet number={3} title="Donations Received" badge={report.donationsReceived.length > 0 ? `${report.donationsReceived.length} donations` : "Manual"} badgeColor={report.donationsReceived.length > 0 ? "green" : "orange"}>
        {report.donationsReceived.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 12 }}>
            No donations recorded for this period.{" "}
            <a href="/finance/donations" style={{ color: "var(--gold)" }}>Enter donations &rarr;</a>
          </p>
        ) : (
          <table className="data-table" style={{ width: "100%", fontSize: 11 }}>
            <thead><tr><th>Date</th><th>Donor</th><th style={{ textAlign: "right" }}>Amount</th><th>Source</th><th>Method</th></tr></thead>
            <tbody>
              {report.donationsReceived.map((d) => (
                <tr key={d.sfId}>
                  <td style={{ color: "var(--text-dim)", fontSize: 10 }}>{formatDate(d.donationDate)}</td>
                  <td>{d.donorName || "Anonymous"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--status-green)" }}>${d.amount.toLocaleString()}</td>
                  <td style={{ color: "var(--text-dim)" }}>{d.source || "—"}</td>
                  <td style={{ color: "var(--text-dim)" }}>{d.paymentMethod || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportSheet>

      {/* Sheet 4: Disbursements */}
      <ReportSheet number={4} title="Disbursements" badge={`${report.disbursements.length} payments`} badgeColor="green">
        {report.disbursements.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 12 }}>No disbursements for this cycle.</p>
        ) : (
          <table className="data-table" style={{ width: "100%", fontSize: 11 }}>
            <thead><tr><th>Record</th><th>Organization</th><th style={{ textAlign: "right" }}>Amount</th><th>Method</th><th style={{ textAlign: "center" }}>Receipt</th></tr></thead>
            <tbody>
              {report.disbursements.map((d) => (
                <tr key={d.sfId}>
                  <td style={{ color: "var(--text-dim)" }}>{d.name}</td>
                  <td>{d.organizationName || "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--status-green)" }}>${d.amount.toLocaleString()}</td>
                  <td style={{ color: "var(--text-dim)" }}>{d.paymentMethod || "—"}</td>
                  <td style={{ textAlign: "center" }}>
                    <span className={d.receiptCaptured ? "badge badge-green" : "badge badge-red"} style={{ fontSize: 9 }}>
                      {d.receiptCaptured ? "Yes" : "Missing"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportSheet>

      {/* Sheet 5: Donated Bracelets */}
      <ReportSheet number={5} title="Donated Bracelets" badge={`${report.donatedBracelets.length} records`} badgeColor="green">
        {report.donatedBracelets.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 12 }}>No donated bracelets this period.</p>
        ) : (
          <table className="data-table" style={{ width: "100%", fontSize: 11 }}>
            <thead><tr><th>Date</th><th>Hero</th><th>Recipient</th><th style={{ textAlign: "center" }}>Qty</th><th style={{ textAlign: "right" }}>Unit Cost</th><th style={{ textAlign: "right" }}>Total Cost</th></tr></thead>
            <tbody>
              {report.donatedBracelets.map((d) => (
                <tr key={d.id}>
                  <td style={{ color: "var(--text-dim)", fontSize: 10 }}>{d.orderDate?.slice(0, 10)}</td>
                  <td>{d.heroName}</td>
                  <td style={{ color: "var(--text-dim)" }}>{d.recipient || "—"}</td>
                  <td style={{ textAlign: "center" }}>{d.quantity}</td>
                  <td style={{ textAlign: "right", color: "var(--text-dim)" }}>${d.unitCost.toFixed(2)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>${d.totalCost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportSheet>

      {/* Sheet 6: Other Expenses */}
      <ReportSheet number={6} title="Other Expenses" badge={report.expenses.length > 0 ? `${report.expenses.length} items` : "Manual"} badgeColor={report.expenses.length > 0 ? "green" : "orange"}>
        {report.expenses.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 12 }}>
            No expenses recorded.{" "}
            <a href="/finance/expenses" style={{ color: "var(--gold)" }}>Upload Chase CSVs &rarr;</a>
          </p>
        ) : (
          <>
            <table className="data-table" style={{ width: "100%", fontSize: 11 }}>
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
              <tbody>
                {report.expenses.slice(0, 30).map((e) => (
                  <tr key={e.sfId}>
                    <td style={{ color: "var(--text-dim)", fontSize: 10 }}>{e.transactionDate}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description}</td>
                    <td style={{ fontSize: 10, color: "var(--text-dim)" }}>{e.category}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>${e.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.expenses.length > 30 && (
              <div style={{ fontSize: 10, color: "var(--text-dim)", padding: "8px 0", textAlign: "center" }}>
                Showing 30 of {report.expenses.length} expenses
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)" }}>
              Total: <strong style={{ color: "var(--text-bright)" }}>${expensesTotal(report.expenses).toFixed(2)}</strong>
            </div>
          </>
        )}
      </ReportSheet>

      {/* Sheet 7: Obligation Tracker */}
      <ReportSheet number={7} title="Obligation Tracker" badge="Auto" badgeColor="green">
        {report.obligationTracker.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 12 }}>No obligation data available.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12, color: "var(--text-dim)" }}>
              <span>Opening: <strong style={{ color: "var(--text-bright)" }}>${report.obligationTotals.openingBalance.toLocaleString()}</strong></span>
              <span>+ New: <strong style={{ color: "var(--status-green)" }}>${report.obligationTotals.newObligations.toLocaleString()}</strong></span>
              <span>- Disbursed: <strong style={{ color: "var(--status-blue)" }}>${report.obligationTotals.disbursements.toLocaleString()}</strong></span>
              <span>= Closing: <strong style={{ color: "var(--gold)" }}>${report.obligationTotals.closingBalance.toLocaleString()}</strong></span>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              <table className="data-table" style={{ width: "100%", fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th style={{ textAlign: "right" }}>Opening</th>
                    <th style={{ textAlign: "right" }}>+ New</th>
                    <th style={{ textAlign: "right" }}>- Disbursed</th>
                    <th style={{ textAlign: "right" }}>Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {report.obligationTracker.slice(0, 30).map((o) => (
                    <tr key={o.orgId}>
                      <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.orgName}</td>
                      <td style={{ textAlign: "right", color: "var(--text-dim)" }}>${o.openingBalance.toLocaleString()}</td>
                      <td style={{ textAlign: "right", color: o.newObligations > 0 ? "var(--status-green)" : "var(--text-dim)" }}>
                        {o.newObligations > 0 ? `+$${o.newObligations.toLocaleString()}` : "—"}
                      </td>
                      <td style={{ textAlign: "right", color: o.disbursements > 0 ? "var(--status-blue)" : "var(--text-dim)" }}>
                        {o.disbursements > 0 ? `-$${o.disbursements.toLocaleString()}` : "—"}
                      </td>
                      <td style={{
                        textAlign: "right",
                        fontWeight: 600,
                        color: o.closingBalance > 0 ? "var(--status-red)" : "var(--status-green)",
                      }}>
                        ${o.closingBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ReportSheet>

      {/* Sheet 8: Data Issues */}
      <ReportSheet number={8} title="Data Issues" badge={report.dataIssues.length > 0 ? `${report.dataIssues.length} issues` : "Clean"} badgeColor={report.dataIssues.length > 0 ? "orange" : "green"}>
        {report.dataIssues.length === 0 ? (
          <p style={{ color: "var(--status-green)", fontSize: 12 }}>No data issues detected.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {report.dataIssues.map((issue, i) => (
              <div key={i} style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", borderLeft: `3px solid ${issue.severity === "warning" ? "var(--status-orange)" : "var(--status-blue)"}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 4 }}>
                  {issue.description}
                </div>
                {issue.details?.length > 0 && (
                  <div style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.5 }}>
                    {issue.details.join(" | ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ReportSheet>
    </>
  );
}

function expensesTotal(expenses) {
  return expenses.reduce((s, e) => s + e.amount, 0);
}
