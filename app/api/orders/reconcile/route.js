import { NextResponse } from "next/server";
import { reconcileWithShipStation } from "@/lib/data/orders";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/reconcile — Sync SF order statuses with ShipStation.
 * Finds items not yet marked "Shipped" in SF that ShipStation shows as shipped,
 * and updates them. Call this on a schedule or manually to keep the two in sync.
 */
// GET for Vercel cron, POST for manual calls
export async function GET(request) { return handler(request); }
export async function POST(request) { return handler(request); }

async function handler(request) {
  // Auth: Vercel CRON_SECRET or SHOS_API_KEY
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const providedKey = request.headers.get("x-api-key");

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isApiKey = apiKey && providedKey === apiKey;

  if (!isVercelCron && !isApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileWithShipStation();

    return NextResponse.json({
      success: true,
      ...result,
      message: `Reconciliation complete: ${result.updated} items synced to Shipped, ${result.remaining} remaining`,
    });
  } catch (error) {
    console.error("Reconcile error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
