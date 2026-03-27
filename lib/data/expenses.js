import { categorizeTransaction, EXPENSE_CATEGORIES } from "./expense-rules";

// ---------------------------------------------------------------------------
// Data source: Expense__c in Salesforce (when created) or CSV parsing only.
// ---------------------------------------------------------------------------

const SF_LIVE = process.env.SF_LIVE === "true";
const SF_OBJECT = "Expense__c";

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
 * @param {string} csvText — raw CSV content
 * @param {string} bankAccount — "Checking-2352" or "CC-3418"
 * @returns {{ rows: object[], errors: string[] }}
 */
export function parseChaseCSV(csvText, bankAccount) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return { rows: [], errors: ["CSV is empty or has no data rows"] };

  // Parse header
  const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const errors = [];

  // Detect format
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

    // Normalize to positive = money spent (expense).
    // Checking: debits are negative, so negate. Credits stay negative → will be excluded or noted.
    // CC: charges are positive already. Credits/refunds are negative.
    const expenseAmount = isCC ? amount : -amount;

    // Parse date (MM/DD/YYYY → YYYY-MM-DD)
    const dateParts = rawDate.split("/");
    let isoDate = rawDate;
    if (dateParts.length === 3) {
      isoDate = `${dateParts[2]}-${dateParts[0].padStart(2, "0")}-${dateParts[1].padStart(2, "0")}`;
    }

    // Auto-categorize
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
        i++; // skip escaped quote
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
// Salesforce CRUD (for when Expense__c object exists)
// ---------------------------------------------------------------------------

async function fetchExpensesFromSF(month, year) {
  const { sfQuery } = await import("@/lib/salesforce");

  let where = "";
  if (month && year) {
    where = `WHERE Month__c = ${month} AND Year__c = ${year}`;
  }

  const records = await sfQuery(`
    SELECT Id, Name, Transaction_Date__c, Description__c, Amount__c,
           Category__c, Bank_Account__c, Vendor__c,
           Month__c, Year__c, Is_Excluded__c, Notes__c,
           CreatedDate
    FROM ${SF_OBJECT}
    ${where}
    ORDER BY Transaction_Date__c ASC
  `.trim());

  return records.map((r) => ({
    sfId: r.Id,
    name: r.Name,
    transactionDate: r.Transaction_Date__c,
    description: r.Description__c,
    amount: r.Amount__c || 0,
    category: r.Category__c,
    bankAccount: r.Bank_Account__c,
    vendor: r.Vendor__c,
    month: r.Month__c,
    year: r.Year__c,
    isExcluded: r.Is_Excluded__c || false,
    notes: r.Notes__c,
    createdDate: r.CreatedDate,
  }));
}

/** Save categorized expense rows to Salesforce */
export async function saveExpensesToSF(rows, month, year) {
  if (!SF_LIVE) return { success: false, error: "SF_LIVE is not enabled" };

  try {
    const { sfCreate } = await import("@/lib/salesforce");
    const results = [];

    for (const row of rows) {
      const result = await sfCreate(SF_OBJECT, {
        Transaction_Date__c: row.transactionDate,
        Description__c: (row.description || "").slice(0, 255),
        Amount__c: row.amount,
        Category__c: row.category || "Other / Miscellaneous",
        Bank_Account__c: row.bankAccount,
        Vendor__c: (row.vendor || "").slice(0, 100),
        Month__c: month,
        Year__c: year,
        Is_Excluded__c: row.isExcluded || false,
        Notes__c: row.notes || null,
      });
      results.push({ success: true, id: result.id });
    }

    return { success: true, count: results.length };
  } catch (err) {
    console.error("Save expenses error:", err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get expenses for a specific month/year from SF */
export async function getExpensesByMonth(month, year) {
  if (!SF_LIVE) return [];

  try {
    return await fetchExpensesFromSF(month, year);
  } catch (err) {
    console.error("Expense query failed:", err.message);
    return [];
  }
}

/** Get all expenses from SF */
export async function getExpenses() {
  if (!SF_LIVE) return [];

  try {
    return await fetchExpensesFromSF();
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
