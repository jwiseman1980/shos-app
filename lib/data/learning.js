/**
 * Learning Engine
 *
 * Queries execution_log to compute:
 * - Recency-weighted time estimates by item type (feeds priority engine)
 * - Estimation accuracy (how well estimates match reality)
 * - Completion velocity trends (getting faster or slower?)
 * - Domain patterns (where does time actually go vs plan?)
 *
 * This is the "system that learns" — every completed task trains
 * better estimates, surfaces friction, and reveals patterns.
 */

import { getServerClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Recency-weighted historical averages
// More recent completions matter more than old ones.
// Uses exponential decay: weight = e^(-age_in_days / halflife)
// ---------------------------------------------------------------------------
const HALFLIFE_DAYS = 14; // Recent 2 weeks weigh most

export async function getHistoricalAverages() {
  const sb = getServerClient();

  const { data, error } = await sb
    .from("execution_log")
    .select("item_type, duration_minutes, estimated_minutes, completed_at, domain")
    .not("duration_minutes", "is", null)
    .order("completed_at", { ascending: false })
    .limit(500);

  if (error || !data?.length) return { averages: {}, accuracy: {}, domainVelocity: {} };

  const now = Date.now();
  const byType = {};
  const byDomain = {};

  for (const row of data) {
    const ageDays = (now - new Date(row.completed_at).getTime()) / 86400000;
    const weight = Math.exp(-ageDays / HALFLIFE_DAYS);

    // --- By item type ---
    if (!byType[row.item_type]) {
      byType[row.item_type] = {
        weightedSum: 0,
        weightTotal: 0,
        count: 0,
        estimatedSum: 0,
        estimatedCount: 0,
        accuracyErrors: [],
      };
    }
    const t = byType[row.item_type];
    t.weightedSum += row.duration_minutes * weight;
    t.weightTotal += weight;
    t.count++;

    if (row.estimated_minutes && row.estimated_minutes > 0) {
      t.estimatedSum += row.estimated_minutes;
      t.estimatedCount++;
      // Accuracy: ratio of actual/estimated. 1.0 = perfect, >1 = took longer
      t.accuracyErrors.push({
        ratio: row.duration_minutes / row.estimated_minutes,
        age: ageDays,
        weight,
      });
    }

    // --- By domain ---
    const domain = row.domain || "general";
    if (!byDomain[domain]) {
      byDomain[domain] = { totalMinutes: 0, count: 0, recentMinutes: 0, recentCount: 0 };
    }
    byDomain[domain].totalMinutes += row.duration_minutes;
    byDomain[domain].count++;
    if (ageDays <= 7) {
      byDomain[domain].recentMinutes += row.duration_minutes;
      byDomain[domain].recentCount++;
    }
  }

  // --- Compute weighted averages ---
  const averages = {};
  const accuracy = {};

  for (const [type, t] of Object.entries(byType)) {
    averages[type] = t.weightTotal > 0
      ? Math.round(t.weightedSum / t.weightTotal)
      : null;

    if (t.accuracyErrors.length >= 3) {
      // Weighted mean accuracy ratio
      let wSum = 0, wTotal = 0;
      for (const e of t.accuracyErrors) {
        wSum += e.ratio * e.weight;
        wTotal += e.weight;
      }
      const meanRatio = wSum / wTotal;

      // Trend: compare recent (last 7 days) vs older accuracy
      const recent = t.accuracyErrors.filter((e) => e.age <= 7);
      const older = t.accuracyErrors.filter((e) => e.age > 7);
      let trend = "stable";
      if (recent.length >= 2 && older.length >= 2) {
        const recentAvg = recent.reduce((s, e) => s + e.ratio, 0) / recent.length;
        const olderAvg = older.reduce((s, e) => s + e.ratio, 0) / older.length;
        if (recentAvg < olderAvg - 0.1) trend = "improving";
        else if (recentAvg > olderAvg + 0.1) trend = "declining";
      }

      accuracy[type] = {
        meanRatio: Math.round(meanRatio * 100) / 100,
        sampleSize: t.accuracyErrors.length,
        trend,
        // Human-readable: "estimates are 20% too low" or "estimates are accurate"
        summary: meanRatio > 1.15
          ? `Takes ${Math.round((meanRatio - 1) * 100)}% longer than estimated`
          : meanRatio < 0.85
            ? `Finishes ${Math.round((1 - meanRatio) * 100)}% faster than estimated`
            : "Estimates are accurate",
      };
    }
  }

  // --- Domain velocity ---
  const domainVelocity = {};
  for (const [domain, d] of Object.entries(byDomain)) {
    domainVelocity[domain] = {
      totalMinutes: d.totalMinutes,
      totalTasks: d.count,
      avgMinutes: Math.round(d.totalMinutes / d.count),
      recentMinutesPerDay: d.recentCount > 0
        ? Math.round(d.recentMinutes / 7)
        : 0,
    };
  }

  return { averages, accuracy, domainVelocity };
}

// ---------------------------------------------------------------------------
// Learning metrics for the scoreboard / insights panel
// ---------------------------------------------------------------------------
export async function getLearningMetrics() {
  const sb = getServerClient();

  // Get last 30 days of executions
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data, error } = await sb
    .from("execution_log")
    .select("item_type, duration_minutes, estimated_minutes, completed_at, domain, outcome")
    .gte("completed_at", thirtyDaysAgo)
    .order("completed_at", { ascending: false });

  if (error || !data?.length) {
    return {
      estimationAccuracy: null,
      velocityTrend: "unknown",
      completionsPerDay: 0,
      topDomain: null,
      neglectedDomain: null,
      streakInsight: null,
    };
  }

  // --- Overall estimation accuracy ---
  const withEstimates = data.filter((r) => r.estimated_minutes > 0 && r.duration_minutes > 0);
  let estimationAccuracy = null;
  if (withEstimates.length >= 3) {
    const totalEstimated = withEstimates.reduce((s, r) => s + r.estimated_minutes, 0);
    const totalActual = withEstimates.reduce((s, r) => s + r.duration_minutes, 0);
    estimationAccuracy = Math.round((totalActual / totalEstimated) * 100);
  }

  // --- Velocity trend (first 15 days vs last 15 days) ---
  const midpoint = new Date(Date.now() - 15 * 86400000);
  const firstHalf = data.filter((r) => new Date(r.completed_at) < midpoint);
  const secondHalf = data.filter((r) => new Date(r.completed_at) >= midpoint);
  let velocityTrend = "stable";
  if (firstHalf.length >= 3 && secondHalf.length >= 3) {
    const firstRate = firstHalf.length / 15;
    const secondRate = secondHalf.length / 15;
    if (secondRate > firstRate * 1.2) velocityTrend = "accelerating";
    else if (secondRate < firstRate * 0.8) velocityTrend = "slowing";
  }

  // --- Completions per day ---
  const completionsPerDay = Math.round((data.length / 30) * 10) / 10;

  // --- Domain distribution ---
  const domainCounts = {};
  for (const r of data) {
    const d = r.domain || "general";
    domainCounts[d] = (domainCounts[d] || 0) + 1;
  }
  const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
  const topDomain = sorted[0] ? { name: sorted[0][0], count: sorted[0][1] } : null;

  // Neglected: domains that exist in system but have 0 or very few completions
  const allDomains = ["family", "finance", "operations", "comms", "development", "governance"];
  const neglected = allDomains
    .filter((d) => (domainCounts[d] || 0) < 2)
    .map((d) => d);

  return {
    estimationAccuracy, // e.g. 120 means tasks take 20% longer than estimated
    velocityTrend,
    completionsPerDay,
    topDomain,
    neglectedDomains: neglected,
    totalCompletions: data.length,
  };
}
