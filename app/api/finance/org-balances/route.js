import { NextResponse } from "next/server";
import { getOrgBalances } from "@/lib/data/obligations";

/**
 * GET /api/finance/org-balances
 * Returns per-organization accrued obligations vs disbursements.
 */
export async function GET() {
  try {
    const balances = await getOrgBalances();

    const totalAccrued = balances.reduce((s, b) => s + b.accrued, 0);
    const totalDisbursed = balances.reduce((s, b) => s + b.disbursed, 0);
    const totalOutstanding = balances.reduce((s, b) => s + b.outstanding, 0);

    return NextResponse.json({
      success: true,
      count: balances.length,
      totalAccrued,
      totalDisbursed,
      totalOutstanding,
      organizations: balances,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
