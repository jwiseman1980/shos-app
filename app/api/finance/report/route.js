import { NextResponse } from "next/server";
import { assembleMonthlyReport } from "@/lib/data/monthly-report";
import { getCurrentMonth, getCurrentYear } from "@/lib/dates";

/**
 * GET /api/finance/report?month=2&year=2026
 * Returns the full assembled monthly financial report.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const currentMonth = getCurrentMonth();
    const currentYear = getCurrentYear();
    const defaultMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const defaultYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const month = Number(searchParams.get("month")) || defaultMonth;
    const year = Number(searchParams.get("year")) || defaultYear;

    const report = await assembleMonthlyReport(month, year);

    return NextResponse.json({
      success: true,
      ...report,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
