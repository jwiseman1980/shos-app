import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import MonthPicker from "@/components/MonthPicker";
import DisbursementSendForm from "@/components/DisbursementSendForm";
import { getDisbursementsDue } from "@/lib/data/disbursements";
import { getCurrentMonth, getCurrentYear, getMonthName } from "@/lib/dates";

export const dynamic = "force-dynamic";

const STATUS_COLOR = {
  due: "var(--status-red)",
  partial: "var(--gold)",
  complete: "var(--status-green)",
  "zero-balance": "var(--text-dim)",
};

const STATUS_LABEL = {
  due: "Due",
  partial: "Partial",
  complete: "Complete",
  "zero-balance": "No Balance",
};

export default async function DisbursementsPage({ searchParams }) {
  const params = await searchParams;
  const month = Number(params?.month) || getCurrentMonth();
  const year = Number(params?.year) || getCurrentYear();

  const anniversaryMonth = month === 1 ? 12 : month - 1;
  const anniversaryYear = month === 1 ? year - 1 : year;

  let due = [];
  let error = null;
  try {
    due = await getDisbursementsDue(month, year);
  } catch (err) {
    error = err.message;
  }

  const totalDue = due.reduce((s, o) => s + o.amountDue, 0);
  const totalSent = due.reduce((s, o) => s + o.amountSent, 0);
  const totalOutstanding = due.reduce((s, o) => s + o.outstandingBalance, 0);
  const completedCount = due.filter((o) => o.status === "complete").length;
  const dueCount = due.filter((o) => o.status === "due" || o.status === "partial").length;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)" }}>
            {getMonthName(month)} {year} Disbursements
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
            Triggered by {getMonthName(anniversaryMonth)} {anniversaryYear} anniversaries
          </div>
        </div>
        <MonthPicker month={month} year={year} basePath="/finance/disbursements" />
      </div>

      {error && (
        <DataCard title="Error">
          <p style={{ color: "var(--status-red)", fontSize: 13, padding: "16px 0" }}>{error}</p>
        </DataCard>
      )}

      {/* Summary stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatBlock
          label="Still Due"
          value={`$${totalDue.toLocaleString()}`}
          note={`${dueCount} org${dueCount !== 1 ? "s" : ""} pending`}
          accent="var(--status-red)"
        />
        <StatBlock
          label="Sent This Cycle"
          value={`$${totalSent.toLocaleString()}`}
          note={`${completedCount} of ${due.length} complete`}
          accent="var(--status-green)"
        />
        <StatBlock
          label="Total Outstanding"
          value={`$${totalOutstanding.toLocaleString()}`}
          note="Cumulative across all orgs"
          accent="var(--gold)"
        />
      </div>

      {/* Disbursements due */}
      {due.length === 0 && !error ? (
        <DataCard title={`${getMonthName(anniversaryMonth)} Anniversaries`}>
          <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "16px 0" }}>
            No heroes with {getMonthName(anniversaryMonth)} anniversaries found, or no outstanding balances.
          </p>
        </DataCard>
      ) : (
        <DataCard title={`Disbursements Due — ${getMonthName(anniversaryMonth)} Anniversaries`}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-dim)" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>Organization</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>Heroes</th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>New Obligation</th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>Outstanding</th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>Sent</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>Contact</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 500 }}>Status</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 500 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {due.map((org) => (
                <tr
                  key={org.orgId}
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    opacity: org.status === "zero-balance" ? 0.5 : 1,
                  }}
                >
                  <td style={{ padding: "10px 12px", color: "var(--text-bright)", fontWeight: 500 }}>
                    {org.orgName}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-dim)", fontSize: 12 }}>
                    {org.heroes.slice(0, 3).join(", ")}
                    {org.heroes.length > 3 && ` +${org.heroes.length - 3} more`}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-dim)" }}>
                    ${org.newObligations.toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--gold)", fontWeight: 600 }}>
                    ${org.outstandingBalance.toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--status-green)" }}>
                    {org.amountSent > 0 ? `$${org.amountSent.toLocaleString()}` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-dim)" }}>
                    {org.email && <div>{org.email}</div>}
                    {org.phone && <div>{org.phone}</div>}
                    {org.website && (
                      <a href={org.website} target="_blank" rel="noopener noreferrer"
                        style={{ color: "var(--accent)" }}>
                        {org.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    )}
                    {!org.email && !org.phone && !org.website && (
                      <span style={{ color: "var(--status-red)", fontSize: 11 }}>No contact info</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                      background: "var(--surface-3)",
                      color: STATUS_COLOR[org.status] || "var(--text-dim)",
                    }}>
                      {STATUS_LABEL[org.status] || org.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {org.status !== "zero-balance" && (
                      <DisbursementSendForm
                        org={org}
                        cycleMonth={month}
                        cycleYear={year}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataCard>
      )}

      {/* Sent records detail */}
      {due.some((o) => o.sentRecords.length > 0) && (
        <DataCard title="Sent This Cycle — Detail" style={{ marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-dim)" }}>
                <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 500 }}>Organization</th>
                <th style={{ padding: "6px 12px", textAlign: "right", fontWeight: 500 }}>Amount</th>
                <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 500 }}>Date</th>
                <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 500 }}>Method</th>
                <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 500 }}>Confirmation</th>
                <th style={{ padding: "6px 12px", textAlign: "center", fontWeight: 500 }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {due.flatMap((o) =>
                o.sentRecords.map((d) => (
                  <tr key={d.sfId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "8px 12px", color: "var(--text-bright)" }}>{o.orgName}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--status-green)", fontWeight: 600 }}>
                      ${d.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text-dim)" }}>
                      {d.disbursementDate || "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text-dim)" }}>
                      {d.paymentMethod || "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text-dim)", fontSize: 11 }}>
                      {d.confirmationNumber || "—"}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      {d.receiptCaptured
                        ? <span style={{ color: "var(--status-green)" }}>Yes</span>
                        : <span style={{ color: "var(--text-dim)" }}>No</span>
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataCard>
      )}
    </>
  );
}
