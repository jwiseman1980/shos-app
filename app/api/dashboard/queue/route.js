import { NextResponse } from "next/server";
import { isAuthenticated, getSessionUser } from "@/lib/auth";
import { loadQueueItems, loadRecentDomains, mergeCalendarAndQueue } from "@/lib/data/dashboard";
import { buildQueue } from "@/lib/priority-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/queue
 * Returns the current user's merged task queue (no calendar events — fast refresh).
 * Called by ConsoleLayout after Operator updates/creates tasks.
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await getSessionUser();
    const [{ items, historicalAverages }, recentDomains] = await Promise.all([
      loadQueueItems(user).catch(() => ({ items: [], historicalAverages: {} })),
      loadRecentDomains().catch(() => []),
    ]);
    const queue = buildQueue(items, recentDomains, historicalAverages);
    // Merge with empty calendar array — calendar events don't change on Operator actions
    const tasks = mergeCalendarAndQueue([], queue);
    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("[dashboard/queue] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
