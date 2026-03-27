import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import { getReconMatrix } from "@/lib/data/recon-matrix";

export const dynamic = "force-dynamic";

const STATUS_CONFIG = {
  "receipts-unmatched": { label: "Receipts → No SF Record", color: "var(--status-red)", priority: true },
  partial:              { label: "Partially Matched",       color: "var(--gold)",       priority: true },
  "sf-only":            { label: "SF Record → No Receipt",  color: "#7b8ab8",           priority: false },
  reconciled:           { label: "Reconciled",              color: "var(--status-green)", priority: false },
  "no-activity":        { label: "No Activity",             color: "var(--text-dim)",   priority: false },
};

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function ReconPage({ searchParams }) {
  const params = await searchParams;
  const filter = params?.filter || "needs-work";

  let data = { rows: [], summary: {} };
  let error = null;
  try {
    data = await getReconMatrix();
  } catch (err) {
    error = err.message;
  }

  const { rows, summary } = data;

  const displayRows = filter === "all" ? rows
    : rows.filter((r) => r.status === "receipts-unmatched" || r.status === "partial");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)" }}>
            Org Reconciliation Matrix
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
            Gmail receipts × Salesforce records × Hero obligations — one row per partner org
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/finance/recon?filter=needs-work"
            style={{ fontSize: 12, padding: "5px 12px", borderRadius: 4, textDecoration: "none",
              background: filter !== "all" ? "var(--accent)" : "var(--surface-3)",
              color: filter !== "all" ? "#fff" : "var(--text-dim)" }}>
            Needs Work ({(summary.receiptsUnmatched || 0) + (summary.partial || 0)})
          </a>
          <a href="/finance/recon?filter=all"
            style={{ fontSize: 12, padding: "5px 12px", borderRadius: 4, textDecoration: "none",
              background: filter === "all" ? "var(--accent)" : "var(--surface-3)",
              color: filter === "all" ? "#fff" : "var(--text-dim)" }}>
            All Orgs ({summary.totalOrgs || 0})
          </a>
        </div>
      </div>

      {error && (
        <DataCard title="Error">
          <p style={{ color: "var(--status-red)", fontSize: 13, padding: "16px 0" }}>{error}</p>
        </DataCard>
      )}

      {/* Summary stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatBlock label="Need Attention"
          value={(summary.receiptsUnmatched || 0) + (summary.partial || 0)}
          note={`${summary.receiptsUnmatched || 0} unmatched · ${summary.partial || 0} partial`}
          accent="var(--status-red)" />
        <StatBlock label="Reconciled"
          value={summary.reconciled || 0}
          note={`of ${summary.totalOrgs || 0} total orgs`}
          accent="var(--status-green)" />
        <StatBlock label="Obligations Generated"
          value={`$${(summary.totalObligationGenerated || 0).toLocaleString()}`}
          note="Sum of hero Funds_Donated__c"
          accent="var(--gold)" />
        <StatBlock label="Total Disbursed (SF)"
          value={`$${(summary.totalDisbursed || 0).toLocaleString()}`}
          note={`${summary.totalReceipts || 0} Gmail receipts found`}
          accent="var(--text-dim)" />
      </div>

      {/* Main matrix */}
      <DataCard title={filter === "all" ? "All Partner Orgs" : "Orgs Needing Reconciliation"}>
        {displayRows.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "16px 0" }}>
            {filter === "all" ? "No data loaded." : "Nothing needs work — all orgs reconciled!"}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-dim)" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 500, minWidth: 200 }}>Organization</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 500 }}>Heroes</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 500 }}>Obligations</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 500 }}>Gmail Receipts</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 500 }}>Amounts Known</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 500 }}>SF Records</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 500 }}>SF Total</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 500 }}>Status</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 500 }}>Receipt Dates</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => {
                  const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG["no-activity"];
                  const receiptDates = [...new Set(
                    row.receipts.map((r) => r.date?.slice(0, 7)).filter(Boolean)
                  )].sort();
                  const gap = row.receiptCount - row.disbursements.length;

                  return (
                    <tr key={row.orgId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "10px 10px", color: "var(--text-bright)", fontWeight: 500 }}>
                        {row.orgName}
                      </td>
                      <td style={{ padding: "10px 10px", color: "var(--text-dim)", fontSize: 11 }}>
                        {row.heroes.slice(0, 2).map((h) =>
                          `${h.rank || ""} ${h.name}`.trim()
                        ).join(", ")}
                        {row.heroes.length > 2 && ` +${row.heroes.length - 2}`}
                        <div style={{ marginTop: 2 }}>
                          {[...new Set(row.heroes.map((h) => h.memorialMonth).filter(Boolean))]
                            .sort((a, b) => a - b)
                            .map((m) => MONTH_NAMES[m])
                            .join(", ")} anniversaries
                        </div>
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--gold)", fontWeight: 600 }}>
                        ${row.obligationGenerated.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "center" }}>
                        <span style={{
                          fontWeight: 700, fontSize: 14,
                          color: row.receiptCount > 0 ? "var(--text-bright)" : "var(--text-dim)"
                        }}>
                          {row.receiptCount}
                        </span>
                        {row.receiptTotalKnown < row.receiptCount && row.receiptCount > 0 && (
                          <div style={{ fontSize: 10, color: "var(--status-red)" }}>
                            {row.receiptCount - row.receiptTotalKnown} amt unknown
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--text-dim)" }}>
                        {row.receiptTotalKnown > 0
                          ? `$${row.receiptTotal.toLocaleString()}`
                          : row.receiptCount > 0 ? "—" : ""}
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "center" }}>
                        <span style={{
                          fontWeight: 700, fontSize: 14,
                          color: row.disbursements.length > 0 ? "var(--status-green)" : "var(--text-dim)"
                        }}>
                          {row.disbursements.length}
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "right", color: "var(--status-green)" }}>
                        {row.totalDisbursed > 0 ? `$${row.totalDisbursed.toLocaleString()}` : "—"}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                          background: "var(--surface-3)", color: cfg.color,
                          whiteSpace: "nowrap",
                        }}>
                          {cfg.label}
                        </span>
                        {gap > 0 && (
                          <div style={{ fontSize: 10, color: "var(--status-red)", marginTop: 3 }}>
                            {gap} receipt{gap !== 1 ? "s" : ""} need SF records
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 10px", color: "var(--text-dim)", fontSize: 11 }}>
                        {receiptDates.join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      {/* Orgs in Gmail not in SF at all */}
      {summary.unmatchedReceiptOrgs?.length > 0 && (
        <DataCard title={`Gmail Orgs Not Found in Salesforce (${summary.unmatchedReceiptOrgs.length})`}
          style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            These orgs appear in Gmail receipts but have no matching Account linked to a hero in SF.
            May need a new Account record, a hero org linkage update, or a name normalization fix.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-dim)" }}>
                <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 500 }}>Org Name (from Gmail)</th>
                <th style={{ padding: "6px 10px", textAlign: "center", fontWeight: 500 }}>Receipts</th>
                <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 500 }}>Dates</th>
              </tr>
            </thead>
            <tbody>
              {summary.unmatchedReceiptOrgs.map((o) => (
                <tr key={o.orgName} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "8px 10px", color: "var(--text-bright)" }}>{o.orgName}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{o.receiptCount}</td>
                  <td style={{ padding: "8px 10px", color: "var(--text-dim)" }}>
                    {[...new Set(o.receipts.map((r) => r.date?.slice(0, 7)).filter(Boolean))].sort().join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataCard>
      )}
    </>
  );
}
