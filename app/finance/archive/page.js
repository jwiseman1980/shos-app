import DataCard from "@/components/DataCard";
import { getDisbursementStats } from "@/lib/data/disbursements";
import { getCurrentYear, getMonthName } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ReportArchivePage() {
  const year = getCurrentYear();
  let stats = { byMonth: {} };

  try {
    stats = await getDisbursementStats();
  } catch {
    // SF may not be connected
  }

  // Build a list of months that have any financial activity
  // For now, derive from disbursement data (has data = report was generated)
  const months = [];
  for (let y = year; y >= year - 1; y--) {
    for (let m = 12; m >= 1; m--) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const disbursementAmount = stats.byMonth[key] || 0;
      // Only show months up to current
      if (y === year && m > new Date().getMonth() + 1) continue;
      if (y < year && m < 1) continue;

      months.push({
        month: m,
        year: y,
        key,
        period: `${getMonthName(m)} ${y}`,
        hasDisbursements: disbursementAmount > 0,
        disbursementAmount,
        // Status is derived — if disbursements exist, report was likely generated
        status: disbursementAmount > 0 ? "Complete" : "Pending",
      });
    }
  }

  return (
    <>
      <DataCard title="Monthly Financial Reports">
        <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>
          Report history derived from Salesforce disbursement data. Months with disbursement records indicate a completed close cycle.
        </p>

        <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Period</th>
              <th style={{ textAlign: "center" }}>Status</th>
              <th style={{ textAlign: "right" }}>Disbursements</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key}>
                <td style={{ fontWeight: 500 }}>{m.period}</td>
                <td style={{ textAlign: "center" }}>
                  <span
                    className={m.hasDisbursements ? "badge badge-green" : "badge badge-gray"}
                    style={{ fontSize: 10 }}
                  >
                    {m.status}
                  </span>
                </td>
                <td style={{ textAlign: "right", color: m.hasDisbursements ? "var(--status-green)" : "var(--text-dim)" }}>
                  {m.hasDisbursements ? `$${m.disbursementAmount.toLocaleString()}` : "—"}
                </td>
                <td style={{ textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <a
                      href={`/finance/report?month=${m.month}&year=${m.year}`}
                      style={{ fontSize: 11, color: "var(--gold)" }}
                    >
                      View
                    </a>
                    <a
                      href={`/api/finance/report/export?month=${m.month}&year=${m.year}`}
                      style={{ fontSize: 11, color: "var(--text-dim)" }}
                    >
                      Excel
                    </a>
                    <a
                      href={`/finance/close?month=${m.month}&year=${m.year}`}
                      style={{ fontSize: 11, color: "var(--text-dim)" }}
                    >
                      Close
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataCard>
    </>
  );
}
