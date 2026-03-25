import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import { getDonationsByEmail } from "@/lib/data/donations";

export const dynamic = "force-dynamic";

export default async function DonorProfilePage({ params }) {
  const { email } = await params;
  const decodedEmail = decodeURIComponent(email);
  const donations = await getDonationsByEmail(decodedEmail);

  if (donations.length === 0) {
    return (
      <PageShell title="Donor Profile" subtitle="Donor not found">
        <DataCard title="No Data">
          <p style={{ color: "var(--text-dim)", padding: "24px 0", textAlign: "center" }}>
            No donations found for {decodedEmail}
          </p>
        </DataCard>
      </PageShell>
    );
  }

  const donorName =
    donations[0].donorName ||
    decodedEmail.split("@")[0].replace(/[._]/g, " ");

  const totalAmount = donations.reduce((s, d) => s + d.amount, 0);
  const avgAmount = totalAmount / donations.length;
  const firstDate = donations[donations.length - 1]?.donationDate;
  const lastDate = donations[0]?.donationDate;
  const thankedCount = donations.filter((d) => d.thankYouSent).length;
  const segment = donations[0]?.donorSegment || "Unclassified";

  const formatDate = (d) => {
    if (!d) return "--";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatAmount = (a) =>
    `$${(a || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

  return (
    <PageShell
      title={donorName}
      subtitle={`${decodedEmail} \u00B7 ${donations.length} donation${donations.length !== 1 ? "s" : ""} \u00B7 ${formatAmount(totalAmount)} lifetime`}
    >
      {/* KPIs */}
      <div className="stat-grid">
        <StatBlock
          label="Lifetime Value"
          value={formatAmount(totalAmount)}
          note={`${donations.length} total donations`}
          accent="var(--gold)"
        />
        <StatBlock
          label="Average Gift"
          value={formatAmount(avgAmount)}
          note="Per donation"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="First Donation"
          value={formatDate(firstDate)}
          note="Start of relationship"
          accent="var(--text-dim)"
        />
        <StatBlock
          label="Last Donation"
          value={formatDate(lastDate)}
          note="Most recent gift"
          accent="var(--status-green)"
        />
      </div>

      <div className="grid-2">
        {/* Donor Details */}
        <DataCard title="Donor Details">
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                Name
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-bright)" }}>
                {donorName}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                Email
              </div>
              <div style={{ fontSize: 14, color: "var(--text-bright)" }}>
                {decodedEmail}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                Segment
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gold)" }}>
                {segment}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                Stewardship
              </div>
              <div style={{ fontSize: 14, color: "var(--text-bright)" }}>
                {thankedCount} of {donations.length} thanked
                {thankedCount === donations.length && (
                  <span style={{ marginLeft: 6, color: "var(--status-green)", fontSize: 12 }}>
                    All caught up
                  </span>
                )}
              </div>
            </div>
            {donations[0]?.donorContactId && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                  Salesforce Contact
                </div>
                <div style={{ fontSize: 14, color: "var(--status-blue)" }}>
                  Linked
                </div>
              </div>
            )}
          </div>
        </DataCard>

        {/* Stewardship Timeline */}
        <DataCard title="Stewardship Status">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
            {donations.map((d) => (
              <div
                key={d.sfId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: d.thankYouSent
                    ? "rgba(34, 197, 94, 0.06)"
                    : "rgba(212, 175, 55, 0.06)",
                  border: `1px solid ${
                    d.thankYouSent ? "rgba(34, 197, 94, 0.2)" : "rgba(212, 175, 55, 0.2)"
                  }`,
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-bright)" }}>
                    {formatAmount(d.amount)}
                    <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>
                      {formatDate(d.donationDate)}
                    </span>
                  </div>
                  {d.source && (
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      via {d.source}
                      {d.campaign && ` \u00B7 ${d.campaign}`}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  {d.thankYouSent ? (
                    <div style={{ fontSize: 11, color: "var(--status-green)", fontWeight: 600 }}>
                      Thanked
                      {d.thankYouBy && (
                        <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 400 }}>
                          by {d.thankYouBy}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>
                      Needs Thanks
                    </div>
                  )}
                  {d.impactUpdateSent && (
                    <div style={{ fontSize: 10, color: "var(--status-blue)" }}>
                      Impact sent {formatDate(d.impactUpdateDate)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DataCard>
      </div>

      {/* Donation History Table */}
      <DataCard title={`Donation History \u2014 ${donations.length} total`}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Source</th>
                <th>Campaign</th>
                <th>Thank You</th>
                <th>Impact Update</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.sfId}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                    {formatDate(d.donationDate)}
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--status-green)" }}>
                    {formatAmount(d.amount)}
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    {d.source || "--"}
                  </td>
                  <td style={{ fontSize: 11, color: "var(--status-blue)" }}>
                    {d.campaign || "--"}
                  </td>
                  <td>
                    {d.thankYouSent ? (
                      <span style={{ fontSize: 11, color: "var(--status-green)", fontWeight: 600 }}>
                        {formatDate(d.thankYouDate)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--gold)" }}>Pending</span>
                    )}
                  </td>
                  <td>
                    {d.impactUpdateSent ? (
                      <span style={{ fontSize: 11, color: "var(--status-blue)", fontWeight: 600 }}>
                        {formatDate(d.impactUpdateDate)}
                      </span>
                    ) : d.thankYouSent ? (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Pending</span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>

      {/* Back link */}
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <a
          href="/donors"
          style={{
            fontSize: 12,
            color: "var(--gold)",
            textDecoration: "none",
            borderBottom: "1px dashed var(--gold)",
          }}
        >
          Back to Donor Engagement
        </a>
      </div>
    </PageShell>
  );
}
