export const dynamic = "force-dynamic";

import { readFileSync } from "fs";
import { join } from "path";
import PageShell from "@/components/PageShell";
import DailyBrief from "@/components/DailyBrief";
import { getHeroStats, getAnniversariesThisMonth } from "@/lib/data/heroes";
import { getSopsDueToday, getSops } from "@/lib/data/sops";
import { getVolunteers } from "@/lib/data/volunteers";
import { getSessionUser } from "@/lib/auth";
import { getMonthName, getCurrentMonth } from "@/lib/dates";

// Role command panel config — colors and nav targets match Sidebar.js
const ROLES = [
  { role: "cos",    label: "Chief of Staff",  href: "/cos",     color: "#b0b8c4", abbr: "COS" },
  { role: "cfo",    label: "CFO",             href: "/finance", color: "#27ae60", abbr: "CFO" },
  { role: "coo",    label: "COO",             href: "/coo",     color: "#e67e22", abbr: "COO" },
  { role: "comms",  label: "Communications",  href: "/comms",   color: "#8e44ad", abbr: "CMO" },
  { role: "dev",    label: "Development",     href: "/dev",     color: "#3498db", abbr: "DEV" },
  { role: "family", label: "Family",          href: "/family",  color: "#e74c3c", abbr: "FAM" },
];

// Read last session date from a knowledge file (best-effort)
function getLastSession(filename) {
  try {
    const content = readFileSync(join(process.cwd(), filename), "utf8");
    const match = content.match(/\|\s*(202\d-\d{2}-\d{2})\s*\|/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Read open flag count from a knowledge file (count unchecked items in active todos)
function getOpenFlagCount(filename) {
  try {
    const content = readFileSync(join(process.cwd(), filename), "utf8");
    const matches = content.match(/^- \[ \]/gm);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

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

  // Role command data — read from knowledge files
  const CONTEXT_FILES = {
    cos:    "COS_CONTEXT.md",
    cfo:    "CFO_CONTEXT.md",
    coo:    "COO_CONTEXT.md",
    comms:  "CMO_CONTEXT.md",
    dev:    "DEV_CONTEXT.md",
    family: "FAMREL_CONTEXT.md",
  };

  const roleData = ROLES.map((r) => {
    const file = CONTEXT_FILES[r.role];
    const lastSession = getLastSession(file);
    const openTodos = getOpenFlagCount(file);
    const staleDays = daysSince(lastSession);
    const isStale = staleDays === null || staleDays > 14;
    const hasFlags = openTodos > 0;
    return { ...r, lastSession, openTodos, staleDays, isStale, hasFlags };
  });

  // Optional data
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
  const today = new Date();

  return (
    <PageShell
      title="Command"
      subtitle={`${monthName} ${today.getDate()}, ${today.getFullYear()}`}
    >
      {/* Role Command Panel */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)" }}>
            Role Status
          </div>
          <a href="/gyst" style={{ fontSize: 11, color: "var(--gold)", textDecoration: "none" }}>
            Personal →
          </a>
        </div>
        <div className="role-command-panel">
          {roleData.map((r) => (
            <a
              key={r.role}
              href={r.href}
              className="role-command-card"
              style={{ "--role-accent": r.color }}
            >
              <div className="role-command-name">{r.abbr}</div>
              <div className="role-command-status">
                {r.openTodos > 0
                  ? `${r.openTodos} open todo${r.openTodos !== 1 ? "s" : ""}`
                  : "No open todos"}
              </div>
              <div className="role-command-meta">
                {r.lastSession
                  ? r.staleDays === 0
                    ? "Session today"
                    : r.staleDays === 1
                    ? "Yesterday"
                    : `${r.staleDays}d ago`
                  : "No sessions yet"}
                {r.isStale && r.staleDays !== null && r.staleDays > 14 && (
                  <span style={{ color: "var(--status-orange)", marginLeft: 4 }}>· stale</span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Existing daily brief */}
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
