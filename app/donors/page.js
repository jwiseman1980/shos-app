import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import DonorTracker from "@/components/DonorTracker";
import { getDonations, getDonationStats } from "@/lib/data/donations";
import { getVolunteers } from "@/lib/data/volunteers";
import { getCurrentYear, getMonthName, getCurrentMonth } from "@/lib/dates";

export default async function DonorEngagementPage() {
  const donations = await getDonations();
  const stats = await getDonationStats();
  const volunteers = await getVolunteers();
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
      };
    }
    donorTotals[key].total += d.amount;
    donorTotals[key].count += 1;
    if (d.donationDate > donorTotals[key].lastDate) {
      donorTotals[key].lastDate = d.donationDate;
    }
  }
  const topDonors = Object.values(donorTotals)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Repeat donors
  const repeatDonors = Object.values(donorTotals).filter((d) => d.count > 1);

  return (
    <PageShell
      title="Donor Engagement"
      subtitle={`${monthName} ${year} — ${stats.total} total donations · $${Math.round(stats.totalAmount).toLocaleString()} raised`}
    >
      {/* KPI Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Total Raised"
          value={stats.totalAmount > 0 ? `$${Math.round(stats.totalAmount).toLocaleString()}` : "--"}
          note={`${stats.total} donations all time`}
          accent="var(--gold)"
        />
        <StatBlock
          label="This Month"
          value={stats.thisMonthTotal > 0 ? `$${Math.round(stats.thisMonthTotal).toLocaleString()}` : "--"}
          note={`${stats.thisMonthCount} donations in ${monthName}`}
          accent="var(--status-green)"
        />
        <StatBlock
          label="Last 30 Days"
          value={stats.recentTotal > 0 ? `$${Math.round(stats.recentTotal).toLocaleString()}` : "--"}
          note={`${stats.recentCount} donations`}
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Avg Donation"
          value={stats.avgAmount > 0 ? `$${Math.round(stats.avgAmount).toLocaleString()}` : "--"}
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
                  (donor.email ? donor.email.split("@")[0].replace(/[._]/g, " ") : "Anonymous");
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
                        <div className="list-item-title">{displayName}</div>
                        <div className="list-item-sub">
                          {donor.count} donation{donor.count !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--status-green)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ${donor.total.toLocaleString()}
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
                    (donor.email ? donor.email.split("@")[0].replace(/[._]/g, " ") : "Anonymous");
                  return (
                    <div key={donor.email || i} className="list-item">
                      <div>
                        <div className="list-item-title">{displayName}</div>
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
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--status-green)",
                          }}
                        >
                          {donor.count}x
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          ${donor.total.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </DataCard>
      </div>

      {/* Donor Engagement Tracker */}
      <DataCard title={`Donation Log — ${donations.length} total`}>
        <DonorTracker donations={donations} stats={stats} volunteers={volunteers} />
      </DataCard>

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
          Click &quot;compose email&quot; on any donor row to open a pre-filled
          email in your default mail client with this template.
        </div>
      </DataCard>
    </PageShell>
  );
}
