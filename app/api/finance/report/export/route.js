import { NextResponse } from "next/server";
import { buildMonthlyReportWorkbook } from "@/lib/data/monthly-report-workbook";
import { getCurrentMonth, getCurrentYear } from "@/lib/dates";

/**
 * GET /api/finance/report/export?month=2&year=2026
 * Generates and returns the 8-sheet monthly financial report as .xlsx.
 * Defaults to the previous month.
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

    const { buffer, filename } = await buildMonthlyReportWorkbook(month, year);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
