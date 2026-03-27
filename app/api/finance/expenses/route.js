import { NextResponse } from "next/server";
import { getExpensesByMonth, getExpenseStats, saveExpensesToSF } from "@/lib/data/expenses";

/**
 * GET /api/finance/expenses?month=3&year=2026
 * Returns expenses for a given month/year.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));

    if (!month || !year) {
      return NextResponse.json(
        { success: false, error: "month and year are required" },
        { status: 400 }
      );
    }

    const [expenses, stats] = await Promise.all([
      getExpensesByMonth(month, year),
      getExpenseStats(month, year),
    ]);

    return NextResponse.json({
      success: true,
      month,
      year,
      count: expenses.length,
      stats,
      expenses,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/finance/expenses
 * Save categorized expense rows to Salesforce.
 * Body: { rows: [...], month: number, year: number }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { rows, month, year } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "rows array is required" },
        { status: 400 }
      );
    }
    if (!month || !year) {
      return NextResponse.json(
        { success: false, error: "month and year are required" },
        { status: 400 }
      );
    }

    const result = await saveExpensesToSF(rows, month, year);
    return NextResponse.json(result, { status: result.success ? 201 : 500 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
