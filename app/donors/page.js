import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import DonorTracker from "@/components/DonorTracker";
import {
  getDonations,
  getDonationStats,
  getDonationsNeedingImpactUpdate,
  getDonorRetentionStats,
} from "@/lib/data/donations";
import { getDVariantDonors } from "@/lib/data/obligations";
import { getVolunteers } from "@/lib/data/volunteers";
import { getCurrentYear, getMonthName, getCurrentMonth, formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DonorEngagementPage() {
  const donations = await getDonations();
  const stats = await getDonationStats();
  const volunteers = await getVolunteers();
  const impactDue = await getDonationsNeedingImpactUpdate();
  const retention = await getDonorRetentionStats();
  const dVariantDonors = await getDVariantDonors(getCurrentYear());
  const year = getCurrentYear();
  const monthName = getMonthName(getCurrentMonth());

  // Top donors (all time)
  const donorTotals = {};
  for (const d of donations) {
    const key = d.donorEmail || d.sfId;
    if (!donorTotals[key]) {
      donorTotals[key] = {
        email: d.donorEmail,
        name: d.donorName,
        total: 0,
        count: 0,
        lastDate: d.donationDate,
        segment: d.donorSegment,
      };
    }
    donorTotals[key].total += d.amount;
    donorTotals[key].count += 1;
    if (d.donationDate > donorTotals[key].lastDate) {
      donorTotals[key].lastDate = d.donationDate;
    }
    if (d.donorSegment) donorTotals[key].segment = d.donorSegment;
  }
  const topDonors = Object.values(donorTotals)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Repeat donors
  const repeatDonors = Object.values(donorTotals).filter((d) => d.count > 1);

  // Segment breakdown
  const segmentCounts = {};
  const segmentTotals = {};
  for (const d of donations) {
    const seg = d.donorSegment || "Unclassified";
    segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
    segmentTotals[seg] = (segmentTotals[seg] || 0) + d.amount;
  }

  // Campaign breakdown
  const campaignData = {};
  for (const d of donations) {
    if (d.campaign) {
      if (!campaignData[d.campaign]) {
        campaignData[d.campaign] = { count: 0, total: 0 };
      }
      campaignData[d.campaign].count += 1;
      campaignData[d.campaign].total += d.amount;
    }
  }
  const campaigns = Object.entries(campaignData)
    .sort(([, a], [, b]) => b.total - a.total);

  const formatAmount = (a) =>
    `$${Math.round(a || 0).toLocaleString()}`;

  const SEGMENT_COLORS = {
    "Major ($500+)": "var(--gold)",
    Recurring: "var(--status-blue)",
    Regular: "var(--status-green)",
    "First-Time": "var(--text-dim)",
    Lapsed: "var(--status-red)",
    Unclassified: "var(--card-border)",
  };

  return (
    <PageShell
      title="Donor Engagement"
      subtitle={`${monthName} ${year} \u2014 ${stats.total} total donations \u00B7 ${formatAmount(stats.totalAmount)} raised`}
    >
      {/* KPI Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Total Raised"
          value={stats.totalAmount > 0 ? formatAmount(stats.totalAmount) : "--"}
          note={`${stats.total} donations all time`}
          accent="var(--gold)"
        />
        <StatBlock
          label="This Month"
          value={stats.thisMonthTotal > 0 ? formatAmount(stats.thisMonthTotal) : "--"}
          note={`${stats.thisMonthCount} donations in ${monthName}`}
          accent="var(--status-green)"
        />
        <StatBlock
          label="Last 30 Days"
          value={stats.recentTotal > 0 ? formatAmount(stats.recentTotal) : "--"}
          note={`${stats.recentCount} donations`}
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Avg Donation"
          value={stats.avgAmount > 0 ? formatAmount(stats.avgAmount) : "--"}
          note="Per donation"
          accent="var(--status-purple)"
        />
      </div>

      <div className="grid-2">
        {/* Top Donors */}
        <DataCard title="Top Donors (All Time)">
          {topDonors.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
                Connect Salesforce to see donor data
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: 350, overflowY: "auto" }}>
              {topDonors.map((donor, i) => {
                const displayName =
                  donor.name ||
                  (donor.email
                    ? donor.email.split("@")[0].replace(/[._]/g, " ")
                    : "Anonymous");
                return (
                  <div key={donor.email || i} className="list-item">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: i < 3 ? "var(--gold)" : "var(--card-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          color: i < 3 ? "#000" : "var(--text-dim)",
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div>
                        {donor.email ? (
                          <a
                            href={`/donors/${encodeURIComponent(donor.email)}`}
                            className="list-item-title"
                            style={{ textDecoration: "none", borderBottom: "1px dashed var(--card-border)" }}
                          >
                            {displayName}
                          </a>
                        ) : (
                          <div className="list-item-title">{displayName}</div>
                        )}
                        <div className="list-item-sub">
                          {donor.count} donation{donor.count !== 1 ? "s" : ""}
                          {donor.segment && (
                            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: SEGMENT_COLORS[donor.segment] || "var(--text-dim)" }}>
                              {donor.segment}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-green)", whiteSpace: "nowrap" }}>
                      {formatAmount(donor.total)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DataCard>

        {/* Repeat Donors */}
        <DataCard title="Repeat Donors">
          {repeatDonors.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
                {donations.length === 0
                  ? "Connect Salesforce to see donor data"
                  : "No repeat donors found yet"}
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: 350, overflowY: "auto" }}>
              {repeatDonors
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
                .map((donor, i) => {
                  const displayName =
                    donor.name ||
                    (donor.email
                      ? donor.email.split("@")[0].replace(/[._]/g, " ")
                      : "Anonymous");
                  return (
                    <div key={donor.email || i} className="list-item">
                      <div>
                        {donor.email ? (
                          <a
                            href={`/donors/${encodeURIComponent(donor.email)}`}
                            className="list-item-title"
                            style={{ textDecoration: "none", borderBottom: "1px dashed var(--card-border)" }}
                          >
                            {displayName}
                          </a>
                        ) : (
                          <div className="list-item-title">{displayName}</div>
                        )}
                        <div className="list-item-sub">
                          Last:{" "}
                          {donor.lastDate
                            ? new Date(donor.lastDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "--"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-green)" }}>
                          {donor.count}x
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          {formatAmount(donor.total)}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </DataCard>
      </div>

      {/* D-Variant Donors — extra $10 to Steel Hearts Fund */}
      {dVariantDonors.length > 0 && (
        <DataCard title={`D-Variant Donors \u2014 Extra $10 to Steel Hearts (${dVariantDonors.length})`}>
          <div style={{ padding: "4px 0 8px" }}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
              These supporters chose the $45 D-variant bracelet, adding an extra $10 donation to Steel Hearts Fund.
              They deserve a thank-you for the additional contribution.
            </div>
            <div style={{ maxHeight: 350, overflowY: "auto" }}>
              {dVariantDonors.slice(0, 15).map((donor, i) => {
                const displayName = donor.name || (donor.email ? donor.email.split("@")[0].replace(/[._]/g, " ") : "Unknown");
                return (
                  <div key={donor.email || i} className="list-item">
                    <div>
                      {donor.email ? (
                        <a
                          href={`/donors/${encodeURIComponent(donor.email)}`}
                          className="list-item-title"
                          style={{ textDecoration: "none", borderBottom: "1px dashed var(--card-border)" }}
                        >
                          {displayName}
                        </a>
                      ) : (
                        <div className="list-item-title">{displayName}</div>
                      )}
                      <div className="list-item-sub">
                        {donor.purchases} D-variant purchase{donor.purchases !== 1 ? "s" : ""}
                        {" \u00B7 "}
                        {donor.heroes.slice(0, 2).join(", ")}
                        {donor.heroes.length > 2 && ` +${donor.heroes.length - 2} more`}
                        {" \u00B7 Last: "}
                        {formatDate(donor.lastDate)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gold)" }}>
                        +${donor.totalContribution}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>to SH Fund</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {dVariantDonors.length > 15 && (
              <div style={{ fontSize: 11, color: "var(--text-dim)", padding: "8px 0", textAlign: "center" }}>
                Showing top 15 of {dVariantDonors.length} D-variant donors
              </div>
            )}
          </div>
        </DataCard>
      )}

      {/* Segment & Campaign Breakdown */}
      {(Object.keys(segmentCounts).length > 1 || campaigns.length > 0) && (
        <div className="grid-2">
          {/* Segment Breakdown */}
          {Object.keys(segmentCounts).length > 1 && (
            <DataCard title="Donor Segments">
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
                {Object.entries(segmentCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([seg, count]) => (
                    <div
                      key={seg}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "var(--bg)",
                        borderRadius: "var(--radius-sm)",
                        borderLeft: `3px solid ${SEGMENT_COLORS[seg] || "var(--card-border)"}`,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-bright)" }}>
                          {seg}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          {count} donation{count !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: SEGMENT_COLORS[seg] || "var(--text-dim)" }}>
                        {formatAmount(segmentTotals[seg])}
                      </div>
                    </div>
                  ))}
              </div>
            </DataCard>
          )}

          {/* Campaign Breakdown */}
          {campaigns.length > 0 && (
            <DataCard title="Campaign Attribution">
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
                {campaigns.map(([name, data]) => (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "var(--bg)",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: "3px solid var(--status-blue)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-bright)" }}>
                        {name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        {data.count} donation{data.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-blue)" }}>
                      {formatAmount(data.total)}
                    </div>
                  </div>
                ))}
              </div>
            </DataCard>
          )}
        </div>
      )}

      {/* Impact Updates Due */}
      {impactDue.length > 0 && (
        <DataCard title={`Impact Updates Due \u2014 ${impactDue.length} donors`}>
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 12,
              background: "rgba(251, 146, 60, 0.08)",
              border: "1px solid rgba(251, 146, 60, 0.2)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
              color: "var(--text)",
              lineHeight: 1.5,
            }}
          >
            These donors received their thank-you 25-45 days ago and are due for a Day 30 impact update (per SOP-DON-002).
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Donor</th>
                  <th>Amount</th>
                  <th>Donation Date</th>
                  <th>Days Ago</th>
                </tr>
              </thead>
              <tbody>
                {impactDue.map((d) => {
                  const days = Math.floor(
                    (new Date() - new Date(d.donationDate)) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr key={d.sfId}>
                      <td>
                        <div style={{ fontWeight: 500, color: "var(--text-bright)", fontSize: 13 }}>
                          {d.donorName || d.donorEmail?.split("@")[0]?.replace(/[._]/g, " ") || "Anonymous"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          {d.donorEmail}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--status-green)" }}>
                        {formatAmount(d.amount)}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {new Date(d.donationDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: days > 35 ? "var(--status-red)" : "var(--status-orange)",
                          }}
                        >
                          {days}d
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}

      {/* Donor Engagement Tracker */}
      <DataCard title={`Donation Log \u2014 ${donations.length} total`}>
        <DonorTracker donations={donations} stats={stats} volunteers={volunteers} />
      </DataCard>

      {/* Retention Dashboard */}
      <DataCard title="Donor Retention">
        <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div
            style={{
              flex: "1 1 140px",
              padding: "12px 16px",
              background: "var(--bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--status-blue)" }}>
              {retention.retentionRate !== null ? `${retention.retentionRate}%` : "--"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Retention Rate
            </div>
            <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
              {retention.retainedCount} of {retention.eligibleForRetention} eligible
            </div>
          </div>
          <div
            style={{
              flex: "1 1 140px",
              padding: "12px 16px",
              background: "var(--bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--status-green)" }}>
              {retention.newThisMonth}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              New This Month
            </div>
          </div>
          <div
            style={{
              flex: "1 1 140px",
              padding: "12px 16px",
              background: "var(--bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>
              {retention.totalUniqueDonors}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Unique Donors
            </div>
          </div>
          <div
            style={{
              flex: "1 1 140px",
              padding: "12px 16px",
              background: "var(--bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: retention.lapsedDonors.length > 0 ? "var(--status-red)" : "var(--text-dim)",
              }}
            >
              {retention.lapsedDonors.length}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Lapsed Donors
            </div>
          </div>
        </div>

        {/* Lapsed Donors List */}
        {retention.lapsedDonors.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 8 }}>
              Lapsed Donors (last gift &gt; 6 months ago)
            </div>
            <div style={{ maxHeight: 250, overflowY: "auto" }}>
              {retention.lapsedDonors.slice(0, 15).map((donor, i) => {
                const displayName = donor.name || donor.email?.split("@")[0]?.replace(/[._]/g, " ") || "Anonymous";
                return (
                  <div key={donor.email || i} className="list-item">
                    <div>
                      {donor.email ? (
                        <a
                          href={`/donors/${encodeURIComponent(donor.email)}`}
                          className="list-item-title"
                          style={{ textDecoration: "none", borderBottom: "1px dashed var(--card-border)" }}
                        >
                          {displayName}
                        </a>
                      ) : (
                        <div className="list-item-title">{displayName}</div>
                      )}
                      <div className="list-item-sub">
                        {donor.count} donations \u00B7 Last:{" "}
                        {new Date(donor.lastDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {" "}({donor.daysSinceLast}d ago)
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-red)", whiteSpace: "nowrap" }}>
                      {formatAmount(donor.totalAmount)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DataCard>

      {/* Year-End Stewardship (show in Oct-Jan) */}
      {(getCurrentMonth() >= 10 || getCurrentMonth() <= 1) && (
        <DataCard title={`Year-End Stewardship \u2014 ${year - 1}`}>
          <div
            style={{
              padding: "16px",
              background: "var(--bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
              color: "var(--text)",
              lineHeight: 1.7,
            }}
          >
            <p style={{ marginBottom: 8 }}>
              Generate year-end donation summaries for tax receipts and stewardship.
              Each summary includes total donated, number of gifts, and Steel Hearts EIN (84-3689498).
            </p>
            <p style={{ fontSize: 11, color: "var(--text-dim)" }}>
              Use the API endpoint: <code>GET /api/donors/year-end-report?year={year - 1}</code> to generate reports,
              then <code>POST /api/donors/draft-yearend-email</code> to create Gmail drafts for each donor.
            </p>
          </div>
        </DataCard>
      )}

      {/* Email Template Quick Reference */}
      <DataCard title="Thank-You Email Template">
        <div
          style={{
            padding: "16px",
            background: "var(--bg)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--card-border)",
            fontSize: 12,
            color: "var(--text)",
            lineHeight: 1.7,
            fontFamily: "Georgia, serif",
          }}
        >
          <p style={{ marginBottom: 8 }}>
            Dear <span style={{ color: "var(--gold)" }}>[Donor Name]</span>,
          </p>
          <p style={{ marginBottom: 8 }}>
            Thank you so much for your generous donation of{" "}
            <span style={{ color: "var(--gold)" }}>[Amount]</span> to Steel
            Hearts. Your support directly helps us honor our fallen heroes and
            provide memorial bracelets to Gold Star families and veteran
            organizations at no cost.
          </p>
          <p style={{ marginBottom: 8 }}>
            Every dollar raised goes toward designing, producing, and donating
            memorial bracelets that keep the memory of our fallen service members
            alive.
          </p>
          <p style={{ marginBottom: 8 }}>
            We are deeply grateful for your support.
          </p>
          <p style={{ marginBottom: 0 }}>
            Warm regards,
            <br />
            The Steel Hearts Team
            <br />
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              steel-hearts.org
            </span>
          </p>
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "var(--text-dim)",
            lineHeight: 1.5,
          }}
        >
          Click &quot;create draft&quot; on any donor row to place a pre-filled
          email in your @steel-hearts.org Gmail Drafts folder.
        </div>
      </DataCard>
    </PageShell>
  );
}
