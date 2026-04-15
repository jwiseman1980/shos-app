import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getServerClient } from "@/lib/supabase";

// Nonprofit functional categories for bookkeeper
const FUNCTIONAL_MAP = {
  "Cost of Goods Sold":       { qb: "Cost of Goods Sold",       functional: "Program Services",    type: "expense" },
  "Inventory & Materials":    { qb: "Inventory & Materials",    functional: "Program Services",    type: "expense" },
  "Shipping & Fulfillment":   { qb: "Shipping & Fulfillment",   functional: "Program Services",    type: "expense" },
  "Charitable Disbursements": { qb: "Charitable Disbursements", functional: "Program Services",    type: "expense" },
  "Marketing & Advertising":  { qb: "Marketing & Advertising",  functional: "Fundraising",         type: "expense" },
  "Payroll & Taxes":          { qb: "Payroll & Taxes",          functional: "Management & General", type: "expense" },
  "Software & Subscriptions": { qb: "Software & Subscriptions", functional: "Management & General", type: "expense" },
  "Professional Services":    { qb: "Professional Services",    functional: "Management & General", type: "expense" },
  "Other / Miscellaneous":    { qb: "Other / Miscellaneous",    functional: "Management & General", type: "expense" },
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("start") || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
    const endDate   = searchParams.get("end")   || new Date().toISOString().split("T")[0];

    const sb = getServerClient();

    // Fetch expenses, donations, disbursements in parallel
    const [expensesRes, donationsRes, disbursementsRes] = await Promise.all([
      sb.from("expenses")
        .select("*")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .eq("is_excluded", false)
        .order("transaction_date"),
      sb.from("donations")
        .select("*")
        .gte("donation_date", startDate)
        .lte("donation_date", endDate)
        .order("donation_date"),
      sb.from("disbursements")
        .select("*, organizations(name)")
        .gte("disbursement_date", startDate)
        .lte("disbursement_date", endDate)
        .order("disbursement_date"),
    ]);

    const expenses      = expensesRes.data      || [];
    const donations     = donationsRes.data     || [];
    const disbursements = disbursementsRes.data || [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SHOS - Steel Hearts Operating System";
    workbook.created = new Date();

    // ── Sheet 1: Expenses ──
    const expSheet = workbook.addWorksheet("Expenses");
    expSheet.columns = [
      { header: "Date",                key: "date",         width: 12 },
      { header: "Description",         key: "description",  width: 40 },
      { header: "Vendor",              key: "vendor",       width: 25 },
      { header: "Category (SHOS)",     key: "category",     width: 28 },
      { header: "QuickBooks Account",  key: "qb_account",   width: 28 },
      { header: "Functional Category", key: "functional",   width: 24 },
      { header: "Amount",              key: "amount",       width: 12 },
      { header: "Account",             key: "bank_account", width: 16 },
      { header: "Notes",               key: "notes",        width: 30 },
    ];

    // Style header row
    expSheet.getRow(1).font      = { bold: true, color: { argb: "FFFFFFFF" } };
    expSheet.getRow(1).fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a2035" } };
    expSheet.getRow(1).alignment = { vertical: "middle" };

    for (const e of expenses) {
      const cat = e.category || "Other / Miscellaneous";
      const map = FUNCTIONAL_MAP[cat] || FUNCTIONAL_MAP["Other / Miscellaneous"];
      expSheet.addRow({
        date:         e.transaction_date,
        description:  e.description,
        vendor:       e.vendor       || "",
        category:     cat,
        qb_account:   map.qb,
        functional:   map.functional,
        amount:       e.amount,
        bank_account: e.bank_account || "",
        notes:        e.notes        || "",
      });
    }

    // Format amount column as currency
    expSheet.getColumn("amount").numFmt = '"$"#,##0.00';

    // Totals row
    const expTotal    = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const expTotalRow = expSheet.addRow({ description: "TOTAL", amount: expTotal });
    expTotalRow.font = { bold: true };
    expTotalRow.getCell("amount").numFmt = '"$"#,##0.00';

    // ── Sheet 2: Donations Received ──
    const donSheet = workbook.addWorksheet("Donations Received");
    donSheet.columns = [
      { header: "Date",               key: "date",           width: 12 },
      { header: "Donor Name",         key: "donor_name",     width: 28 },
      { header: "Donor Email",        key: "donor_email",    width: 30 },
      { header: "Amount",             key: "amount",         width: 12 },
      { header: "Source",             key: "source",         width: 18 },
      { header: "Payment Method",     key: "payment_method", width: 20 },
      { header: "Campaign",           key: "campaign",       width: 20 },
      { header: "QuickBooks Account", key: "qb_account",     width: 28 },
      { header: "Notes",              key: "notes",          width: 30 },
    ];
    donSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    donSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a2035" } };

    for (const d of donations) {
      const donorName =
        d.billing_name ||
        [d.donor_first_name, d.donor_last_name].filter(Boolean).join(" ") ||
        "Anonymous";
      const amount = d.donation_amount || d.amount || 0;
      donSheet.addRow({
        date:           d.donation_date,
        donor_name:     donorName,
        donor_email:    d.donor_email || "",
        amount,
        source:         d.source         || "",
        payment_method: d.payment_method || "",
        campaign:       d.campaign       || "",
        qb_account:     "Contributions & Grants",
        notes:          d.notes          || "",
      });
    }
    donSheet.getColumn("amount").numFmt = '"$"#,##0.00';
    const donTotal    = donations.reduce((s, d) => s + (d.donation_amount || d.amount || 0), 0);
    const donTotalRow = donSheet.addRow({ donor_name: "TOTAL", amount: donTotal });
    donTotalRow.font = { bold: true };

    // ── Sheet 3: Disbursements ──
    const disbSheet = workbook.addWorksheet("Disbursements");
    disbSheet.columns = [
      { header: "Date",               key: "date",       width: 12 },
      { header: "Organization",       key: "org",        width: 35 },
      { header: "Amount",             key: "amount",     width: 12 },
      { header: "Payment Method",     key: "method",     width: 20 },
      { header: "Fund Type",          key: "fund_type",  width: 20 },
      { header: "QuickBooks Account", key: "qb_account", width: 28 },
      { header: "Receipt Captured",   key: "receipt",    width: 16 },
      { header: "Notes",              key: "notes",      width: 30 },
    ];
    disbSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    disbSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a2035" } };

    for (const d of disbursements) {
      disbSheet.addRow({
        date:      d.disbursement_date,
        org:       d.organizations?.name || d.organization_name || "",
        amount:    d.amount,
        method:    d.payment_method  || "",
        fund_type: d.fund_type       || "",
        qb_account: "Charitable Disbursements",
        receipt:   d.receipt_captured ? "Yes" : "No",
        notes:     d.notes           || "",
      });
    }
    disbSheet.getColumn("amount").numFmt = '"$"#,##0.00';
    const disbTotal    = disbursements.reduce((s, d) => s + (d.amount || 0), 0);
    const disbTotalRow = disbSheet.addRow({ org: "TOTAL", amount: disbTotal });
    disbTotalRow.font = { bold: true };

    // ── Sheet 4: Summary for Sara ──
    const sumSheet = workbook.addWorksheet("Summary for Sara");
    sumSheet.getColumn(1).width = 35;
    sumSheet.getColumn(2).width = 18;

    const addSumRow = (label, value, bold = false) => {
      const row = sumSheet.addRow([label, value ?? ""]);
      if (bold) row.font = { bold: true };
      if (typeof value === "number") row.getCell(2).numFmt = '"$"#,##0.00';
      return row;
    };

    sumSheet.addRow(["Steel Hearts Foundation - Bookkeeper Export"]);
    sumSheet.getRow(1).font = { bold: true, size: 14 };
    sumSheet.addRow([`Period: ${startDate} to ${endDate}`]);
    sumSheet.addRow([`Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`]);
    sumSheet.addRow(["EIN: 47-2511085"]);
    sumSheet.addRow([]);

    addSumRow("INCOME", "", true);
    addSumRow("  Donations & Contributions", donTotal);
    addSumRow("  Bracelet Sales (see orders)", 0);
    addSumRow("Total Income", donTotal, true);
    sumSheet.addRow([]);

    addSumRow("EXPENSES BY FUNCTIONAL CATEGORY", "", true);
    const byFunctional = {};
    for (const e of expenses) {
      const cat = e.category || "Other / Miscellaneous";
      const map = FUNCTIONAL_MAP[cat] || FUNCTIONAL_MAP["Other / Miscellaneous"];
      byFunctional[map.functional] = (byFunctional[map.functional] || 0) + (e.amount || 0);
    }
    for (const [cat, amt] of Object.entries(byFunctional)) {
      addSumRow(`  ${cat}`, amt);
    }
    addSumRow("  Charitable Disbursements", disbTotal);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0) + disbTotal;
    addSumRow("Total Expenses", totalExpenses, true);
    sumSheet.addRow([]);

    addSumRow("NET", donTotal - totalExpenses, true);
    sumSheet.addRow([]);

    sumSheet.addRow(["NOTES FOR SARA:"]);
    sumSheet.getRow(sumSheet.lastRow.number).font = { bold: true };
    sumSheet.addRow(["- Expenses tab: full transaction list with QB account suggestions"]);
    sumSheet.addRow(["- Donations tab: all contributions received, categorize as Contributions & Grants"]);
    sumSheet.addRow(["- Disbursements tab: charity payouts, categorize as Charitable Disbursements"]);
    sumSheet.addRow(["- Bracelet sales should come from Squarespace/Stripe reports"]);
    sumSheet.addRow(["- Contact: joseph.wiseman@steel-hearts.org"]);

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();

    const filename = `SteelHearts-Bookkeeper-${startDate}-to-${endDate}.xlsx`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Bookkeeper export error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
