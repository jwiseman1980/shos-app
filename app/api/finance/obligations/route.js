import { NextResponse } from "next/server";
import { getAnniversaryObligations } from "@/lib/data/obligations";
import { getCurrentMonth, getCurrentYear } from "@/lib/dates";

/**
 * GET /api/finance/obligations?month=2&year=2026
 * Returns obligation breakdown for heroes whose anniversary falls in the given month.
 * Defaults to current month/year if not specified.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = Number(searchParams.get("month")) || getCurrentMonth();
    const year = Number(searchParams.get("year")) || getCurrentYear();

    const obligations = await getAnniversaryObligations(month, year);

    return NextResponse.json({ success: true, ...obligations });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
