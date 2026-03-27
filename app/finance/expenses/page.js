import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import ExpenseUploader from "@/components/ExpenseUploader";
import MonthPicker from "@/components/MonthPicker";
import { getExpensesByMonth, getExpenseStats, EXPENSE_CATEGORIES } from "@/lib/data/expenses";
import { getCurrentMonth, getCurrentYear, getMonthName } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }) {
  const params = await searchParams;
  const month = Number(params?.month) || getCurrentMonth();
  const year = Number(params?.year) || getCurrentYear();

  let expenses = [];
  let stats = { total: 0, count: 0, excludedCount: 0, byCategory: {} };
  let sfAvailable = true;

  try {
    [expenses, stats] = await Promise.all([
      getExpensesByMonth(month, year),
      getExpenseStats(month, year),
    ]);
  } catch {
    sfAvailable = false;
  }

  const activeExpenses = expenses.filter((e) => !e.isExcluded);

  return (
    <>
      {/* Month selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)" }}>
          {getMonthName(month)} {year}
        </div>
        <MonthPicker month={month} year={year} basePath="/finance/expenses" />
      </div>

      {/* KPI Stats */}
      {stats.count > 0 && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <StatBlock
            label="Total Expenses"
            value={`$${stats.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            note={`${stats.count} transactions`}
            accent="var(--status-red)"
          />
          {Object.entries(stats.byCategory)
            .filter(([, amount]) => amount > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cat, amount]) => (
              <StatBlock
                key={cat}
                label={cat}
                value={`$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                note={`${activeExpenses.filter((e) => e.category === cat).length} transactions`}
                accent="var(--text-dim)"
              />
            ))}
        </div>
      )}

      {/* Upload Section */}
      <DataCard title="Upload Chase Statement">
        <ExpenseUploader month={month} year={year} />
      </DataCard>

      {/* Expense List */}
      <div style={{ marginTop: 20 }}>
        <DataCard title={`Recorded Expenses — ${getMonthName(month)} ${year}`}>
          {!sfAvailable ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "16px 0" }}>
              Expense data requires Salesforce connection and Expense__c object.
              <br />
              <span style={{ fontSize: 11 }}>
                Create Expense__c in Salesforce Setup, then expenses saved here will persist.
              </span>
            </p>
          ) : activeExpenses.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "16px 0" }}>
              No expenses recorded for {getMonthName(month)} {year}. Upload a Chase CSV above to get started.
            </p>
          ) : (
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Date</th>
                    <th style={{ textAlign: "left" }}>Description</th>
                    <th style={{ textAlign: "left" }}>Category</th>
                    <th style={{ textAlign: "left" }}>Vendor</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th style={{ textAlign: "left" }}>Account</th>
                  </tr>
                </thead>
                <tbody>
                  {activeExpenses.map((e) => (
                    <tr key={e.sfId}>
                      <td style={{ whiteSpace: "nowrap", color: "var(--text-dim)" }}>
                        {e.transactionDate}
                      </td>
                      <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {e.description}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: "var(--radius-pill)",
                          background: "var(--bg)",
                          color: "var(--text-dim)",
                        }}>
                          {e.category}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{e.vendor || "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "var(--text-bright)" }}>
                        ${e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ fontSize: 10, color: "var(--text-dim)" }}>{e.bankAccount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>
      </div>

      {/* Category Breakdown */}
      {stats.count > 0 && (
        <div style={{ marginTop: 20 }}>
          <DataCard title="Expense Breakdown by Category">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0" }}>
              {EXPENSE_CATEGORIES.map((cat) => {
                const amount = stats.byCategory[cat] || 0;
                const pct = stats.total > 0 ? Math.round((amount / stats.total) * 100) : 0;
                return (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 160, fontSize: 12, color: "var(--text-dim)", flexShrink: 0 }}>{cat}</div>
                    <div style={{ flex: 1, height: 6, background: "var(--bg)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: amount > 0 ? "var(--gold)" : "transparent",
                        borderRadius: 3,
                        transition: "width 0.3s",
                      }} />
                    </div>
                    <div style={{ width: 80, textAlign: "right", fontSize: 12, fontWeight: 600, color: amount > 0 ? "var(--text-bright)" : "var(--text-dim)" }}>
                      ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ width: 30, textAlign: "right", fontSize: 10, color: "var(--text-dim)" }}>
                      {pct}%
                    </div>
                  </div>
                );
              })}
            </div>
          </DataCard>
        </div>
      )}
    </>
  );
}
