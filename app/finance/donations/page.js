import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import DonationReceivedForm from "@/components/DonationReceivedForm";
import MonthPicker from "@/components/MonthPicker";
import { getDonationsByMonth } from "@/lib/data/donations";
import { getCurrentMonth, getCurrentYear, getMonthName, formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DonationsReceivedPage({ searchParams }) {
  const params = await searchParams;
  const month = Number(params?.month) || getCurrentMonth();
  const year = Number(params?.year) || getCurrentYear();

  let donations = [];
  try {
    donations = await getDonationsByMonth(month, year);
  } catch {
    // SF may not be connected
  }

  const monthTotal = donations.reduce((s, d) => s + d.amount, 0);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)" }}>
          {getMonthName(month)} {year} Donations
        </div>
        <MonthPicker month={month} year={year} basePath="/finance/donations" />
      </div>

      {donations.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <StatBlock
            label="Donations This Month"
            value={`$${monthTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            note={`${donations.length} donation${donations.length !== 1 ? "s" : ""}`}
            accent="var(--status-green)"
          />
        </div>
      )}

      {/* TODO: Stripe webhook auto-sync — replaces this page entirely once new website is live */}
      <DataCard title={`Donations Received — ${getMonthName(month)} ${year}`}>
        {donations.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "16px 0" }}>
            No donations recorded for {getMonthName(month)} {year}.
          </p>
        ) : (
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Date</th>
                  <th style={{ textAlign: "left" }}>Donor</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "left" }}>Source</th>
                  <th style={{ textAlign: "left" }}>Method</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.sfId}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--text-dim)" }}>
                      {formatDate(d.donationDate)}
                    </td>
                    <td>
                      {d.donorName || "Anonymous"}
                      {d.donorEmail && (
                        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{d.donorEmail}</div>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--status-green)" }}>
                      ${d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ color: "var(--text-dim)" }}>{d.source || "—"}</td>
                    <td style={{ color: "var(--text-dim)" }}>{d.paymentMethod || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <div style={{ marginTop: 20 }}>
        <DataCard title="Manual Entry — Check / Cash / Other">
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            For donations not yet auto-synced. Once Stripe webhook is live, this becomes the exception only.
          </p>
          <DonationReceivedForm />
        </DataCard>
      </div>
    </>
  );
}
