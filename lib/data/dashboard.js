/**
 * Dashboard Data Loader
 *
 * Pulls from all data sources and normalizes everything into a universal
 * queue of actionable items for the priority engine.
 */

import { getServerClient } from "@/lib/supabase";
import { getAnniversariesThisMonth, getHeroStats } from "@/lib/data/heroes";
import { getSopsDueToday } from "@/lib/data/sops";

// ---------------------------------------------------------------------------
// Load all queue items for a user
// ---------------------------------------------------------------------------
export async function loadQueueItems(user) {
  const sb = getServerClient();
  const isAdmin = user?.domains?.includes("All") || user?.isFounder;
  const items = [];

  // Run all queries in parallel
  const [
    tasksResult,
    anniversariesResult,
    sopsResult,
    donationsResult,
    executionLogResult,
  ] = await Promise.all([
    // Tasks assigned to this user (or all if admin)
    sb.from("tasks")
      .select("*")
      .in("status", ["backlog", "todo", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(200),

    // This month's anniversaries
    getAnniversariesThisMonth().catch(() => []),

    // SOPs due today
    getSopsDueToday().catch(() => []),

    // Unthanked donations (last 30 days)
    sb.from("donations")
      .select("id, donation_amount, donor_name, donor_email, donation_date")
      .eq("thank_you_sent", false)
      .gte("donation_date", new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0])
      .order("donation_date", { ascending: false })
      .limit(50),

    // Recent execution log for historical averages
    sb.from("execution_log")
      .select("item_type, duration_minutes")
      .not("duration_minutes", "is", null)
      .order("completed_at", { ascending: false })
      .limit(200),
  ]);

  // --- Historical averages for time estimates ---
  const historicalAverages = {};
  if (executionLogResult.data) {
    const byType = {};
    for (const row of executionLogResult.data) {
      if (!byType[row.item_type]) byType[row.item_type] = [];
      byType[row.item_type].push(row.duration_minutes);
    }
    for (const [type, durations] of Object.entries(byType)) {
      historicalAverages[type] = durations.reduce((a, b) => a + b, 0) / durations.length;
    }
  }

  // --- Tasks & Ideas ---
  if (tasksResult.data) {
    for (const task of tasksResult.data) {
      // Filter: non-admin users only see their own tasks
      if (!isAdmin && task.assigned_to) {
        // Need to match by user name since assigned_to is UUID
        // For now, include all tasks — filter in the component by user
      }

      items.push({
        id: task.id,
        sourceType: "task",
        itemType: task.item_type || "task",
        title: task.title,
        description: task.description,
        domain: task.domain || "general",
        priority: task.priority,
        status: task.status,
        dueDate: task.due_date,
        createdAt: task.created_at,
        lastTouchedAt: task.last_touched_at || task.updated_at,
        estimatedMinutes: task.estimated_minutes,
        deepLink: task.deep_link,
        assignedTo: task.assigned_to,
        heroId: task.hero_id,
        tags: task.tags || [],
      });
    }
  }

  // --- Anniversary emails ---
  const myAnniversaries = anniversariesResult.filter((h) => {
    const status = (h.anniversaryStatus || "").toLowerCase().replace(/\s+/g, "_");
    return !["email_sent", "sent", "complete", "skipped"].includes(status);
  });

  for (const hero of myAnniversaries) {
    // If not admin, only show assigned to this user
    if (!isAdmin && hero.anniversaryAssignedTo !== user?.name) continue;

    const needsResearch = !hero.familyContactId;
    items.push({
      id: `anniversary-${hero.sfId}`,
      sourceType: "anniversary",
      itemType: needsResearch ? "explore" : "outreach",
      title: needsResearch
        ? `Research family contact — ${hero.name}`
        : `Send anniversary email — ${hero.name}`,
      description: `${hero.branch} · Memorial date: ${hero.memorialDate || "unknown"}`,
      domain: "family",
      dueDate: hero.memorialDate, // Anniversary date is the natural deadline
      createdAt: null,
      lastTouchedAt: null,
      assignedTo: hero.anniversaryAssignedTo,
      deepLink: "/anniversaries",
      heroSfId: hero.sfId,
    });
  }

  // --- SOPs due today ---
  for (const sop of sopsResult) {
    items.push({
      id: `sop-${sop.id}`,
      sourceType: "sop",
      itemType: "recurring",
      title: `${sop.id} — ${sop.title}`,
      description: `${sop.cadence} · ${sop.timeBox || "15-20 min"}`,
      domain: sop.domain || "comms",
      dueDate: new Date().toISOString().split("T")[0], // Due today
      createdAt: null,
      lastTouchedAt: null,
      estimatedMinutes: parseInt(sop.timeBox) || 15,
      deepLink: sop.id === "SOP-001" ? "/comms/social" : `/sops/${sop.id}`,
      sopId: sop.id,
    });
  }

  // --- Unthanked donors ---
  if (donationsResult.data && isAdmin) {
    for (const d of donationsResult.data) {
      items.push({
        id: `donor-${d.id}`,
        sourceType: "donation",
        itemType: "donor",
        title: `Thank ${d.donor_name || d.donor_email}`,
        description: `$${d.donation_amount || 0} on ${d.donation_date}`,
        domain: "development",
        dueDate: null, // No hard deadline but decay will push it up
        createdAt: d.donation_date,
        lastTouchedAt: d.donation_date,
        deepLink: "/donors",
        donationId: d.id,
      });
    }
  }

  return { items, historicalAverages };
}

// ---------------------------------------------------------------------------
// Load recent domain activity for rotation scoring
// ---------------------------------------------------------------------------
export async function loadRecentDomains() {
  const sb = getServerClient();
  const { data } = await sb
    .from("execution_log")
    .select("domain, completed_at")
    .not("domain", "is", null)
    .order("completed_at", { ascending: false })
    .limit(50);

  const recentDomains = {};
  if (data) {
    for (const row of data) {
      if (!recentDomains[row.domain]) {
        recentDomains[row.domain] = row.completed_at;
      }
    }
  }
  return recentDomains;
}

// ---------------------------------------------------------------------------
// Load scoreboard stats
// ---------------------------------------------------------------------------
export async function loadScoreboardStats(user) {
  const sb = getServerClient();
  const isAdmin = user?.domains?.includes("All") || user?.isFounder;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStr = monthStart.toISOString();

  const [
    executionsThisMonth,
    heroStats,
    anniversariesThisMonth,
  ] = await Promise.all([
    sb.from("execution_log")
      .select("id, domain, duration_minutes, completed_at, impact_metric")
      .gte("completed_at", monthStr)
      .order("completed_at", { ascending: false }),

    getHeroStats().catch(() => ({ total: 0, active: 0 })),

    getAnniversariesThisMonth().catch(() => []),
  ]);

  const executions = executionsThisMonth.data || [];
  const totalMinutes = executions.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const completedCount = executions.length;

  // Domain breakdown
  const domainMinutes = {};
  for (const e of executions) {
    const d = e.domain || "general";
    domainMinutes[d] = (domainMinutes[d] || 0) + (e.duration_minutes || 0);
  }

  // Anniversary stats
  const myAnniversaries = isAdmin
    ? anniversariesThisMonth
    : anniversariesThisMonth.filter((h) => h.anniversaryAssignedTo === user?.name);
  const annCompleted = myAnniversaries.filter((h) => {
    const s = (h.anniversaryStatus || "").toLowerCase().replace(/\s+/g, "_");
    return ["email_sent", "sent", "complete"].includes(s);
  }).length;

  // Streak (consecutive days with completions)
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const hasCompletion = executions.some(
      (e) => e.completed_at && e.completed_at.startsWith(dateStr)
    );
    if (hasCompletion) streak++;
    else if (i > 0) break; // Allow today to have no completions yet
  }

  return {
    completedThisMonth: completedCount,
    totalMinutesThisMonth: totalMinutes,
    hoursThisMonth: Math.round(totalMinutes / 60 * 10) / 10,
    domainMinutes,
    heroesHonored: heroStats.active || 0,
    anniversariesTotal: myAnniversaries.length,
    anniversariesCompleted: annCompleted,
    streak,
  };
}

// ---------------------------------------------------------------------------
// Load recent accomplishments
// ---------------------------------------------------------------------------
export async function loadAccomplishments(user, limit = 15) {
  const sb = getServerClient();
  const { data } = await sb
    .from("execution_log")
    .select("*")
    .order("completed_at", { ascending: false })
    .limit(limit);

  return data || [];
}
