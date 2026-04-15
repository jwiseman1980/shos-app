import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import MonthPicker from "@/components/MonthPicker";
import BoardReportActions from "@/components/BoardReportActions";
import { assembleMonthlyReport } from "@/lib/data/monthly-report";
import { getDonationStats } from "@/lib/data/donations";
import { getCurrentMonth, getCurrentYear, getMonthName } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function BoardReportPage({ searchParams }) {
  const params = await searchParams;
  const currentMonth = getCurrentMonth();
  const currentYear = getCurrentYear();
  const defaultMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const defaultYear  = currentMonth === 1 ? currentYear - 1 : currentYear;
  const month = Number(params?.month) || defaultMonth;
  const year  = Number(params?.year)  || defaultYear;

  let report       = null;
  let donationStats = null;
  try {
    [report, donationStats] = await Promise.all([
      assembleMonthlyReport(month, year),
      getDonationStats(),
    ]);
  } catch (err) {
    console.error("Board report error:", err.message);
  }

  const s = report?.summary;
  const monthName = getMonthName(month);
  const generatedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const fmtMoney = (v) =>
    `$${Math.round(v || 0).toLocaleString()}`;

  const fmtMoneyFull = (v) =>
    `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  // Compliance upcoming filing dates (static reference)
  const complianceItems = [
    { label: "IRS Form 990",       due: `May 15, ${year + 1}`,   status: "upcoming" },
    { label: "Virginia COIA",      due: `Jun 15, ${year + 1}`,   status: "upcoming" },
    { label: "NC Solicitation",    due: `Oct 31, ${year}`,       status: "upcoming" },
    { label: "PA Registration",    due: `Oct 31, ${year}`,       status: "upcoming" },
    { label: "Annual Report (VA)", due: `Sep 30, ${year}`,       status: "upcoming" },
  ];

  return (
    <PageShell
      title="Board Report"
      subtitle={`${monthName} ${year} - Generated ${generatedDate}`}
      action={<BoardReportActions year={year} />}
    >
      {/* Month picker */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
          Steel Hearts Foundation &middot; EIN: 47-2511085 &middot; 501(c)(3)
        </div>
        <MonthPicker month={month} year={year} basePath="/reports" />
      </div>

      {/* ── Executive Summary ── */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--gold)",
            marginBottom: 12,
          }}
        >
          Executive Summary
        </div>
        <div className="stat-grid">
          <StatBlock
            label="Money In"
            value={s ? fmtMoney(s.moneyIn.total) : "--"}
            note={
              s
                ? `Sales: ${fmtMoney(s.moneyIn.braceletSales)} + Donations: ${fmtMoney(s.moneyIn.donationsReceived)}`
                : "No data"
            }
            accent="var(--status-green)"
          />
          <StatBlock
            label="Money Out"
            value={s ? fmtMoney(s.moneyOut.total) : "--"}
            note="Disbursements + Costs + Expenses"
            accent="var(--status-red)"
          />
          <StatBlock
            label="Net"
            value={
              s
                ? `${s.net >= 0 ? "+" : ""}${fmtMoney(s.net)}`
                : "--"
            }
            note={s ? (s.net >= 0 ? "Surplus" : "Deficit") : ""}
            accent={s ? (s.net >= 0 ? "var(--status-green)" : "var(--status-red)") : "var(--text-dim)"}
          />
          <StatBlock
            label="Obligation Balance"
            value={s ? fmtMoney(s.obligations.closingBalance) : "--"}
            note={
              s
                ? `New: ${fmtMoney(s.obligations.newThisMonth)} | Fulfilled: ${fmtMoney(s.obligations.fulfilledThisMonth)}`
                : ""
            }
            accent="var(--gold)"
          />
          <StatBlock
            label="Total Raised (All Time)"
            value={donationStats ? fmtMoney(donationStats.totalAmount) : "--"}
            note={donationStats ? `${donationStats.total} total donations` : ""}
            accent="var(--status-blue)"
          />
          <StatBlock
            label="Bracelets Sold"
            value={s ? String(s.keyMetrics.braceletsSold) : "--"}
            note={s ? `${s.keyMetrics.braceletsDonated} donated this month` : ""}
            accent="var(--status-purple)"
          />
        </div>
      </div>

      {/* ── Financial Summary ── */}
      <DataCard title={`Financial Summary - ${monthName} ${year}`}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Category</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th style={{ textAlign: "left", paddingLeft: 16 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {/* Income */}
              <tr>
                <td colSpan={3} style={{ paddingTop: 12, paddingBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--status-green)",
                    }}
                  >
                    Income
                  </span>
                </td>
              </tr>
              <tr>
                <td>Bracelet Sales</td>
                <td style={{ textAlign: "right", fontWeight: 600, color: "var(--status-green)" }}>
                  {s ? fmtMoneyFull(s.moneyIn.braceletSales) : "--"}
                </td>
                <td style={{ paddingLeft: 16, color: "var(--text-dim)", fontSize: 12 }}>
                  {s ? `${s.keyMetrics.braceletsSold} units sold` : ""}
                </td>
              </tr>
              <tr>
                <td>Donations Received</td>
                <td style={{ textAlign: "right", fontWeight: 600, color: "var(--status-green)" }}>
                  {s ? fmtMoneyFull(s.moneyIn.donationsReceived) : "--"}
                </td>
                <td style={{ paddingLeft: 16, color: "var(--text-dim)", fontSize: 12 }}>
                  {report ? `${report.donationsReceived.length} gifts` : ""}
                </td>
              </tr>
              <tr style={{ borderTop: "1px solid var(--card-border)" }}>
                <td style={{ fontWeight: 700 }}>Total Income</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: "var(--status-green)" }}>
                  {s ? fmtMoneyFull(s.moneyIn.total) : "--"}
                </td>
                <td />
              </tr>

              {/* Expenses */}
              <tr>
                <td colSpan={3} style={{ paddingTop: 16, paddingBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--status-red)",
                    }}
                  >
                    Expenses
                  </span>
                </td>
              </tr>
              <tr>
                <td>Charitable Disbursements</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>
                  {s ? fmtMoneyFull(s.moneyOut.disbursements) : "--"}
                </td>
                <td style={{ paddingLeft: 16, color: "var(--text-dim)", fontSize: 12 }}>
                  {report ? `${report.disbursements.length} payments to partner orgs` : ""}
                </td>
              </tr>
              <tr>
                <td>Donated Bracelet Costs</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>
                  {s ? fmtMoneyFull(s.moneyOut.donatedBraceletCosts) : "--"}
                </td>
                <td style={{ paddingLeft: 16, color: "var(--text-dim)", fontSize: 12 }}>
                  {s ? `${s.keyMetrics.braceletsDonated} bracelets to Gold Star families` : ""}
                </td>
              </tr>
              <tr>
                <td>Operational Expenses</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>
                  {s ? fmtMoneyFull(s.moneyOut.operationalExpenses) : "--"}
                </td>
                <td style={{ paddingLeft: 16, color: "var(--text-dim)", fontSize: 12 }}>
                  {report ? `${report.expenses.length} transactions` : ""}
                </td>
              </tr>
              <tr style={{ borderTop: "1px solid var(--card-border)" }}>
                <td style={{ fontWeight: 700 }}>Total Expenses</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: "var(--status-red)" }}>
                  {s ? fmtMoneyFull(s.moneyOut.total) : "--"}
                </td>
                <td />
              </tr>

              {/* Net */}
              <tr
                style={{
                  borderTop: "2px solid var(--card-border)",
                  background: s
                    ? s.net >= 0
                      ? "rgba(39,174,96,0.06)"
                      : "rgba(231,76,60,0.06)"
                    : undefined,
                }}
              >
                <td style={{ fontWeight: 700, fontSize: 15 }}>Net</td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    fontSize: 15,
                    color: s
                      ? s.net >= 0
                        ? "var(--status-green)"
                        : "var(--status-red)"
                      : "var(--text-dim)",
                  }}
                >
                  {s ? `${s.net >= 0 ? "+" : ""}${fmtMoneyFull(s.net)}` : "--"}
                </td>
                <td style={{ paddingLeft: 16, fontSize: 12, color: "var(--text-dim)" }}>
                  {s ? (s.net >= 0 ? "Surplus" : "Deficit") : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </DataCard>

      {/* ── Operations ── */}
      <DataCard title="Operations">
        {!s ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "12px 0" }}>
            No operations data available for this period.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {[
                { label: "Bracelets Sold",       value: s.keyMetrics.braceletsSold,      color: "var(--status-green)" },
                { label: "Bracelets Donated",    value: s.keyMetrics.braceletsDonated,   color: "var(--gold)" },
                { label: "Orgs Supported",        value: s.keyMetrics.orgsSupported,      color: "var(--status-blue)" },
                { label: "Obligation Generating", value: s.keyMetrics.obligationBracelets, color: "var(--status-purple)" },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    flex: "1 1 130px",
                    padding: "12px 16px",
                    background: "var(--bg)",
                    border: "1px solid var(--card-border)",
                    borderTop: `2px solid ${color}`,
                    borderRadius: "var(--radius-md)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-dim)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginTop: 4,
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* Expense breakdown by category */}
            {report?.expensesByCategory && Object.keys(report.expensesByCategory).length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 10 }}>
                  Expense Breakdown
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(report.expensesByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, amt]) => {
                      const total = s.moneyOut.operationalExpenses || 1;
                      const pct = Math.round((amt / total) * 100);
                      return (
                        <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 180, fontSize: 12, color: "var(--text-dim)", flexShrink: 0 }}>{cat}</div>
                          <div
                            style={{
                              flex: 1,
                              height: 5,
                              background: "var(--bg)",
                              borderRadius: 3,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: "var(--gold)",
                                borderRadius: 3,
                              }}
                            />
                          </div>
                          <div style={{ width: 80, textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>
                            {fmtMoneyFull(amt)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </>
        )}
      </DataCard>

      {/* ── Family Impact ── */}
      <DataCard title="Family Impact">
        {!s ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "12px 0" }}>
            No data available for this period.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                padding: "14px 18px",
                background: "rgba(196,162,55,0.06)",
                border: "1px solid rgba(196,162,55,0.2)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                color: "var(--text)",
                lineHeight: 1.7,
              }}
            >
              Steel Hearts donated{" "}
              <strong style={{ color: "var(--gold)" }}>
                {s.keyMetrics.braceletsDonated} memorial bracelet{s.keyMetrics.braceletsDonated !== 1 ? "s" : ""}
              </strong>{" "}
              to Gold Star families and partner organizations this period. Each bracelet honors a fallen service member by name and is provided at no cost.
            </div>

            {report?.donatedBracelets && report.donatedBracelets.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Hero Honored</th>
                      <th>Recipient</th>
                      <th style={{ textAlign: "center" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.donatedBracelets.map((d, i) => (
                      <tr key={d.id || i}>
                        <td style={{ color: "var(--text-dim)", fontSize: 11 }}>
                          {d.orderDate?.slice(0, 10) || "--"}
                        </td>
                        <td style={{ fontWeight: 500 }}>{d.heroName}</td>
                        <td style={{ color: "var(--text-dim)" }}>{d.recipient || "--"}</td>
                        <td style={{ textAlign: "center" }}>{d.quantity}</td>
                        <td style={{ textAlign: "right", color: "var(--text-dim)" }}>
                          {fmtMoneyFull(d.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div
                style={{
                  flex: "1 1 160px",
                  padding: "10px 14px",
                  background: "var(--bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-md)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--status-blue)" }}>
                  {s.keyMetrics.orgsSupported}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase" }}>
                  Partner Orgs Supported
                </div>
              </div>
              <div
                style={{
                  flex: "1 1 160px",
                  padding: "10px 14px",
                  background: "var(--bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-md)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)" }}>
                  {fmtMoney(s.keyMetrics.shFundDonations)}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase" }}>
                  SH Fund (D-Variant)
                </div>
              </div>
              <div
                style={{
                  flex: "1 1 160px",
                  padding: "10px 14px",
                  background: "var(--bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-md)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--status-orange)" }}>
                  {fmtMoney(s.obligations.closingBalance)}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase" }}>
                  Pending Obligations
                </div>
              </div>
            </div>
          </div>
        )}
      </DataCard>

      {/* ── Fundraising ── */}
      <DataCard title="Fundraising">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div
            style={{
              flex: "1 1 260px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 10 }}>
              Donations This Period
            </div>
            {report?.donationsReceived && report.donationsReceived.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Donor</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.donationsReceived.map((d, i) => (
                      <tr key={d.sfId || i}>
                        <td style={{ fontWeight: 500 }}>
                          {d.donorName || "Anonymous"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "var(--status-green)" }}>
                          {fmtMoneyFull(d.amount)}
                        </td>
                        <td style={{ color: "var(--text-dim)", fontSize: 11 }}>
                          {d.source || "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "var(--text-dim)", fontSize: 12 }}>
                No donations recorded this period.{" "}
                <a href="/finance/donations" style={{ color: "var(--gold)" }}>
                  Enter donations &rarr;
                </a>
              </p>
            )}
          </div>

          <div style={{ flex: "0 0 200px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 10 }}>
              All-Time Totals
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Total Raised",       value: donationStats ? fmtMoney(donationStats.totalAmount)   : "--", color: "var(--status-green)" },
                { label: "This Month",         value: donationStats ? fmtMoney(donationStats.thisMonthTotal) : "--", color: "var(--status-blue)" },
                { label: "Avg Donation",       value: donationStats ? fmtMoney(donationStats.avgAmount)     : "--", color: "var(--gold)" },
                { label: "Unique Donors",      value: donationStats ? String(donationStats.withEmail)       : "--", color: "var(--status-purple)" },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "var(--bg)",
                    border: "1px solid var(--card-border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DataCard>

      {/* ── Disbursements ── */}
      {report?.disbursements && report.disbursements.length > 0 && (
        <DataCard title={`Charitable Disbursements - ${report.disbursements.length} payments`}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Method</th>
                  <th style={{ textAlign: "center" }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {report.disbursements.map((d, i) => (
                  <tr key={d.sfId || i}>
                    <td style={{ fontWeight: 500 }}>{d.organizationName || "--"}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--status-green)" }}>
                      {fmtMoneyFull(d.amount)}
                    </td>
                    <td style={{ color: "var(--text-dim)" }}>{d.paymentMethod || "--"}</td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={d.receiptCaptured ? "badge badge-green" : "badge badge-red"}
                        style={{ fontSize: 9 }}
                      >
                        {d.receiptCaptured ? "Yes" : "Missing"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-dim)" }}>
            Total disbursed:{" "}
            <strong style={{ color: "var(--text-bright)" }}>
              {fmtMoneyFull(s?.moneyOut.disbursements || 0)}
            </strong>
          </div>
        </DataCard>
      )}

      {/* ── Compliance & Governance ── */}
      <DataCard title="Compliance & Governance">
        <div style={{ marginBottom: 12, fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
          Steel Hearts Foundation is a Virginia-registered 501(c)(3) nonprofit. EIN: 47-2511085.
          Registered for charitable solicitation in VA, NC, PA, and other states.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {complianceItems.map(({ label, due, status }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "var(--bg)",
                border: "1px solid var(--card-border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-bright)" }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Due: {due}</span>
                <span
                  className="badge"
                  style={{
                    fontSize: 9,
                    background: "rgba(52,152,219,0.12)",
                    color: "var(--status-blue)",
                    border: "1px solid rgba(52,152,219,0.25)",
                    borderRadius: "var(--radius-pill)",
                    padding: "2px 8px",
                  }}
                >
                  Upcoming
                </span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
          For full compliance details, visit{" "}
          <a href="/compliance" style={{ color: "var(--gold)" }}>
            Compliance Dashboard &rarr;
          </a>
        </div>
      </DataCard>

      {/* ── Data Issues ── */}
      {report?.dataIssues && report.dataIssues.length > 0 && (
        <DataCard title={`Data Issues - ${report.dataIssues.length} items`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {report.dataIssues.map((issue, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  background: "var(--bg)",
                  borderRadius: "var(--radius-sm)",
                  borderLeft: `3px solid ${
                    issue.severity === "warning" ? "var(--status-orange)" : "var(--status-blue)"
                  }`,
                }}
              >
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
        </DataCard>
      )}

      {/* ── Print Styles ── */}
      <style>{`
        @media print {
          .sidebar, .page-header .month-picker { display: none !important; }
          .page-shell { padding: 0 !important; }
          .card { break-inside: avoid; }
        }
      `}</style>
    </PageShell>
  );
}
