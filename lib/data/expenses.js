import { categorizeTransaction, EXPENSE_CATEGORIES } from "./expense-rules";
import { getServerClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Data source: expenses table in Supabase + Chase CSV parsing
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Chase CSV Parser
// ---------------------------------------------------------------------------

/**
 * Parse a Chase CSV export. Handles both checking and CC formats.
 *
 * Chase Checking: Transaction Date, Post Date, Description, Amount, Type, Balance
 * Chase CC: Transaction Date, Post Date, Description, Category, Type, Amount, Memo
 *
 * Amount sign convention:
 *   - Checking: negative = debit (money out), positive = credit (money in)
 *   - CC: positive = charge (money out), negative = credit/refund
 *
 * @param {string} csvText -- raw CSV content
 * @param {string} bankAccount -- "Checking-2352" or "CC-3418"
 * @returns {{ rows: object[], errors: string[] }}
 */
export function parseChaseCSV(csvText, bankAccount) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return { rows: [], errors: ["CSV is empty or has no data rows"] };

  const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const errors = [];

  const isCC = bankAccount.startsWith("CC") || header.includes("memo");
  const dateIdx = header.indexOf("transaction date");
  const descIdx = header.indexOf("description");
  const amountIdx = header.indexOf("amount");

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    return { rows: [], errors: ["Could not find required columns: Transaction Date, Description, Amount"] };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const rawDate = cols[dateIdx]?.trim();
    const description = cols[descIdx]?.trim();
    const rawAmount = cols[amountIdx]?.trim();

    if (!rawDate || !description) continue;

    const amount = parseFloat(rawAmount);
    if (isNaN(amount)) {
      errors.push(`Row ${i + 1}: could not parse amount "${rawAmount}"`);
      continue;
    }

    const expenseAmount = isCC ? amount : -amount;

    // Parse date (MM/DD/YYYY -> YYYY-MM-DD)
    const dateParts = rawDate.split("/");
    let isoDate = rawDate;
    if (dateParts.length === 3) {
      isoDate = `${dateParts[2]}-${dateParts[0].padStart(2, "0")}-${dateParts[1].padStart(2, "0")}`;
    }

    const { category, vendor, exclude, reason } = categorizeTransaction(description);

    rows.push({
      transactionDate: isoDate,
      description,
      amount: Math.round(expenseAmount * 100) / 100,
      category,
      vendor,
      bankAccount,
      isExcluded: exclude,
      excludeReason: reason,
      isCredit: expenseAmount < 0,
    });
  }

  return { rows, errors };
}

/**
 * Simple CSV line parser that handles quoted fields with commas.
 */
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// Supabase CRUD
// ---------------------------------------------------------------------------

async function fetchExpensesFromSupabase(month, year) {
  const sb = getServerClient();

  let query = sb
    .from("expenses")
    .select("*")
    .order("transaction_date", { ascending: true });

  if (month && year) {
    query = query.eq("month", month).eq("year", year);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Supabase expenses query failed: ${error.message}`);

  return (data || []).map((r) => ({
    sfId: r.sf_id || r.id,
    id: r.id,
    name: r.name,
    transactionDate: r.transaction_date,
    description: r.description,
    amount: r.amount || 0,
    category: r.category,
    bankAccount: r.bank_account,
    vendor: r.vendor,
    month: r.month,
    year: r.year,
    isExcluded: r.is_excluded || false,
    notes: r.notes,
    createdDate: r.created_at,
  }));
}

/** Save categorized expense rows to Supabase */
export async function saveExpensesToSF(rows, month, year) {
  try {
    const sb = getServerClient();
    const insertRows = rows.map((row) => ({
      transaction_date: row.transactionDate,
      description: (row.description || "").slice(0, 255),
      amount: row.amount,
      category: row.category || "Other / Miscellaneous",
      bank_account: row.bankAccount,
      vendor: (row.vendor || "").slice(0, 100),
      month,
      year,
      is_excluded: row.isExcluded || false,
      notes: row.notes || null,
    }));

    const { data, error } = await sb
      .from("expenses")
      .insert(insertRows)
      .select("id");

    if (error) throw error;
    return { success: true, count: (data || []).length };
  } catch (err) {
    console.error("Save expenses error:", err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get expenses for a specific month/year */
export async function getExpensesByMonth(month, year) {
  try {
    return await fetchExpensesFromSupabase(month, year);
  } catch (err) {
    console.error("Expense query failed:", err.message);
    return [];
  }
}

/** Get all expenses */
export async function getExpenses() {
  try {
    return await fetchExpensesFromSupabase();
  } catch (err) {
    console.error("Expense query failed:", err.message);
    return [];
  }
}

/** Get expense stats for a month/year */
export async function getExpenseStats(month, year) {
  const expenses = await getExpensesByMonth(month, year);
  const active = expenses.filter((e) => !e.isExcluded);

  const byCategory = {};
  for (const cat of EXPENSE_CATEGORIES) {
    byCategory[cat] = 0;
  }
  for (const e of active) {
    const cat = e.category || "Other / Miscellaneous";
    byCategory[cat] = (byCategory[cat] || 0) + e.amount;
  }

  return {
    total: active.reduce((s, e) => s + e.amount, 0),
    count: active.length,
    excludedCount: expenses.length - active.length,
    byCategory,
  };
}

export { EXPENSE_CATEGORIES };
