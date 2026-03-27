import { NextResponse } from "next/server";
import { reconcileWithShipStation } from "@/lib/data/orders";

/**
 * POST /api/orders/reconcile — Sync SF order statuses with ShipStation.
 * Finds items not yet marked "Shipped" in SF that ShipStation shows as shipped,
 * and updates them. Call this on a schedule or manually to keep the two in sync.
 */
// GET for Vercel cron, POST for manual calls
export async function GET() { return handler(); }
export async function POST() { return handler(); }

async function handler() {
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
