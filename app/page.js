export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import DailyBrief from "@/components/DailyBrief";
import { getHeroStats, getAnniversariesThisMonth } from "@/lib/data/heroes";
import { getSopsDueToday, getSops } from "@/lib/data/sops";
import { getVolunteers } from "@/lib/data/volunteers";
import { getSessionUser } from "@/lib/auth";
import { getMonthName, getCurrentMonth } from "@/lib/dates";

export default async function DashboardPage() {
  const user = await getSessionUser();

  const [heroStats, thisMonthHeroes, sopsDueToday, allSops, volunteers] =
    await Promise.all([
      getHeroStats(),
      getAnniversariesThisMonth(),
      getSopsDueToday(),
      getSops(),
      getVolunteers(),
    ]);

  // Try to load optional data (may fail if SF not connected)
  // Get today's completed tasks from SF
  let todayCompletedSops = [];
  try {
    if (process.env.SF_LIVE === "true") {
      const { sfQuery } = await import("@/lib/salesforce");
      const today = new Date().toISOString().split("T")[0];
      const runs = await sfQuery(
        `SELECT Task_Reference__c FROM Task_Log__c WHERE Task_Type__c = 'SOP Run' AND DAY_ONLY(Completed_At__c) = ${today}`
      );
      todayCompletedSops = runs.map((r) => {
        const match = r.Task_Reference__c?.match(/^(SOP[^:]+)/);
        return match ? match[1].trim() : "";
      }).filter(Boolean);
    }
  } catch {}

  let donationStats = null;
  let recentDonations = [];
  let designStats = null;
  let designQueue = [];
  let orderStats = null;
  let orderItems = [];

  try {
    const { getDonationStats, getDonations } = await import("@/lib/data/donations");
    donationStats = await getDonationStats();
    const allDonations = await getDonations();
    recentDonations = allDonations
      .filter((d) => {
        const daysAgo = (Date.now() - new Date(d.donationDate).getTime()) / 86400000;
        return daysAgo <= 7;
      })
      .slice(0, 20);
  } catch {}

  try {
    const { getDesignStats, getDesignQueue } = await import("@/lib/data/designs");
    designStats = await getDesignStats();
    designQueue = await getDesignQueue();
  } catch {}

  try {
    const { getOrderStats, getActiveOrderItems } = await import("@/lib/data/orders");
    orderStats = await getOrderStats();
    orderItems = await getActiveOrderItems();
  } catch {}

  const monthName = getMonthName(getCurrentMonth());

  return (
    <PageShell
      title={user ? `Daily Brief` : "Operations Dashboard"}
      subtitle={`${monthName} ${new Date().getDate()}, ${new Date().getFullYear()}`}
    >
      <DailyBrief
        user={user}
        heroStats={heroStats}
        thisMonthHeroes={thisMonthHeroes}
        sopsDueToday={sopsDueToday}
        allSops={allSops}
        volunteers={volunteers}
        donationStats={donationStats}
        recentDonations={recentDonations}
        designStats={designStats}
        designQueue={designQueue}
        orderStats={orderStats}
        orderItems={orderItems}
        todayCompletedSops={todayCompletedSops}
        monthName={monthName}
      />
    </PageShell>
  );
}
