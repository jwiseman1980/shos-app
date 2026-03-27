import { NextResponse } from "next/server";
import { parseChaseCSV } from "@/lib/data/expenses";

/**
 * POST /api/finance/expenses/upload
 * Accepts a Chase CSV file via FormData, parses and categorizes it.
 * Returns preview data — does NOT save to SF. Client must POST to /api/finance/expenses to save.
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const bankAccount = formData.get("bankAccount") || "Checking-2352";
    const month = Number(formData.get("month"));
    const year = Number(formData.get("year"));

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const { rows, errors } = parseChaseCSV(csvText, bankAccount);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: errors.length > 0 ? errors[0] : "No rows parsed from CSV" },
        { status: 400 }
      );
    }

    // Filter to the requested month if provided
    let filteredRows = rows;
    if (month && year) {
      const monthStr = String(month).padStart(2, "0");
      const yearStr = String(year);
      filteredRows = rows.filter((r) => {
        return r.transactionDate.startsWith(`${yearStr}-${monthStr}`);
      });
    }

    // Summary stats
    const active = filteredRows.filter((r) => !r.isExcluded && !r.isCredit);
    const totalExpenses = active.reduce((s, r) => s + r.amount, 0);

    return NextResponse.json({
      success: true,
      rows: filteredRows,
      errors,
      summary: {
        totalRows: filteredRows.length,
        expenseRows: active.length,
        excludedRows: filteredRows.filter((r) => r.isExcluded).length,
        creditRows: filteredRows.filter((r) => r.isCredit && !r.isExcluded).length,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        bankAccount,
        month,
        year,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
