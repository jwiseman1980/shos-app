import ExcelJS from "exceljs";
import { assembleMonthlyReport } from "@/lib/data/monthly-report";
import { getMonthName } from "@/lib/dates";

/**
 * Build the 8-sheet "Squarespace Order Classifications" monthly bookkeeper
 * workbook for a given month/year. Returns the xlsx as a Node Buffer plus
 * a suggested filename. Used by the on-demand finance API route AND the
 * monthly cron that drafts an email to the bookkeeper.
 *
 * @param {number} month — 1-12
 * @param {number} year
 * @returns {Promise<{ buffer: Buffer, filename: string, report: object }>}
 */
export async function buildMonthlyReportWorkbook(month, year) {
  const report = await assembleMonthlyReport(month, year);
  const wb = new ExcelJS.Workbook();
  wb.creator = "SHOS — Steel Hearts Operating System";

  const headerStyle = {
    font: { bold: true, size: 10, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF333333" } },
    alignment: { horizontal: "left" },
  };
  const moneyFmt = '"$"#,##0.00';

  // ── Sheet 1: Summary ──
  const ws1 = wb.addWorksheet("Summary");
  ws1.columns = [{ width: 28 }, { width: 16 }, { width: 30 }];
  ws1.addRow([`Steel Hearts — ${getMonthName(month)} ${year} Financial Report`]).font = { bold: true, size: 14 };
  ws1.addRow([]);
  ws1.addRow(["REVENUE & INCOME", "Amount", "Notes"]);
  ws1.getRow(3).eachCell((cell) => Object.assign(cell, headerStyle));
  ws1.addRow(["Bracelet Sales (Squarespace)", report.summary.moneyIn.braceletSales, ""]);
  ws1.addRow(["Donations Received", report.summary.moneyIn.donationsReceived, ""]);
  ws1.addRow(["Total Revenue", report.summary.moneyIn.total, ""]).font = { bold: true };
  ws1.addRow([]);
  ws1.addRow(["EXPENSES", "Amount", "Notes"]);
  ws1.getRow(8).eachCell((cell) => Object.assign(cell, headerStyle));
  ws1.addRow(["Donation Disbursements", report.summary.moneyOut.disbursements, ""]);
  ws1.addRow(["Donated Bracelet Costs", report.summary.moneyOut.donatedBraceletCosts, ""]);
  ws1.addRow(["Operational Expenses", report.summary.moneyOut.operationalExpenses, ""]);
  ws1.addRow(["Total Expenses", report.summary.moneyOut.total, ""]).font = { bold: true };
  ws1.addRow([]);
  ws1.addRow(["NET INCOME / (LOSS)", report.summary.net, ""]).font = { bold: true, size: 12 };
  ws1.addRow([]);
  ws1.addRow(["KEY METRICS", "Value", ""]);
  ws1.getRow(16).eachCell((cell) => Object.assign(cell, headerStyle));
  ws1.addRow(["Bracelets Sold", report.summary.keyMetrics.braceletsSold, ""]);
  ws1.addRow(["Bracelets Donated", report.summary.keyMetrics.braceletsDonated, ""]);
  ws1.addRow(["Orgs Supported", report.summary.keyMetrics.orgsSupported, ""]);
  ws1.addRow(["Obligation Balance", report.summary.obligations.closingBalance, ""]);
  ws1.getColumn(2).numFmt = moneyFmt;

  // ── Sheet 2: Bracelet Sales ──
  const ws2 = wb.addWorksheet("Bracelet Sales");
  ws2.columns = [
    { header: "Date", width: 12 },
    { header: "Order #", width: 16 },
    { header: "SKU", width: 22 },
    { header: "Hero", width: 24 },
    { header: "Qty", width: 6 },
    { header: "Unit Price", width: 12 },
    { header: "Revenue", width: 12 },
    { header: "D-Variant", width: 10 },
    { header: "Designated Org", width: 28 },
    { header: "$10 Obligation", width: 14 },
  ];
  ws2.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));
  for (const r of report.braceletSales) {
    ws2.addRow([
      r.orderDate?.slice(0, 10),
      r.orderNumber,
      r.sku,
      r.heroName,
      r.quantity,
      r.unitPrice,
      r.lineTotal,
      r.isDVariant ? "Yes" : "",
      r.designatedOrg,
      r.obligationAmount,
    ]);
  }
  ws2.getColumn(6).numFmt = moneyFmt;
  ws2.getColumn(7).numFmt = moneyFmt;
  ws2.getColumn(10).numFmt = moneyFmt;

  // ── Sheet 3: Donations Received ──
  const ws3 = wb.addWorksheet("Donations Received");
  ws3.columns = [
    { header: "Date", width: 14 },
    { header: "Donor Name", width: 24 },
    { header: "Amount", width: 12 },
    { header: "Source", width: 14 },
    { header: "Method", width: 14 },
    { header: "Email", width: 28 },
  ];
  ws3.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));
  for (const d of report.donationsReceived) {
    ws3.addRow([d.donationDate, d.donorName || "Anonymous", d.amount, d.source, d.paymentMethod, d.donorEmail]);
  }
  ws3.getColumn(3).numFmt = moneyFmt;

  // ── Sheet 4: Disbursements ──
  const ws4 = wb.addWorksheet("Disbursements");
  ws4.columns = [
    { header: "DON #", width: 12 },
    { header: "Organization", width: 28 },
    { header: "Amount", width: 12 },
    { header: "Cycle", width: 14 },
    { header: "Method", width: 14 },
    { header: "Receipt", width: 10 },
  ];
  ws4.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));
  for (const d of report.disbursements) {
    ws4.addRow([
      d.name,
      d.organizationName,
      d.amount,
      d.cycleMonth && d.cycleYear ? `${getMonthName(d.cycleMonth).slice(0, 3)} ${d.cycleYear}` : "",
      d.paymentMethod,
      d.receiptCaptured ? "Yes" : "Missing",
    ]);
  }
  ws4.getColumn(3).numFmt = moneyFmt;

  // ── Sheet 5: Donated Bracelets ──
  const ws5 = wb.addWorksheet("Donated Bracelets");
  ws5.columns = [
    { header: "Date", width: 12 },
    { header: "Hero", width: 24 },
    { header: "SKU", width: 22 },
    { header: "Recipient", width: 22 },
    { header: "Qty", width: 6 },
    { header: "Unit Cost", width: 12 },
    { header: "Total Cost", width: 12 },
  ];
  ws5.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));
  for (const d of report.donatedBracelets) {
    ws5.addRow([d.orderDate?.slice(0, 10), d.heroName, d.sku, d.recipient, d.quantity, d.unitCost, d.totalCost]);
  }
  ws5.getColumn(6).numFmt = moneyFmt;
  ws5.getColumn(7).numFmt = moneyFmt;

  // ── Sheet 6: Other Expenses ──
  const ws6 = wb.addWorksheet("Other Expenses");
  ws6.columns = [
    { header: "Date", width: 12 },
    { header: "Description", width: 36 },
    { header: "Category", width: 24 },
    { header: "Vendor", width: 20 },
    { header: "Amount", width: 12 },
    { header: "Account", width: 16 },
  ];
  ws6.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));
  for (const e of report.expenses) {
    ws6.addRow([e.transactionDate, e.description, e.category, e.vendor, e.amount, e.bankAccount]);
  }
  ws6.getColumn(5).numFmt = moneyFmt;

  // ── Sheet 7: Obligation Tracker ──
  const ws7 = wb.addWorksheet("Obligation Tracker");
  ws7.columns = [
    { header: "Organization", width: 30 },
    { header: "Opening Balance", width: 16 },
    { header: "New Obligations", width: 16 },
    { header: "Disbursements", width: 14 },
    { header: "Closing Balance", width: 16 },
  ];
  ws7.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));
  for (const o of report.obligationTracker) {
    ws7.addRow([o.orgName, o.openingBalance, o.newObligations, o.disbursements, o.closingBalance]);
  }
  [2, 3, 4, 5].forEach((c) => { ws7.getColumn(c).numFmt = moneyFmt; });

  // ── Sheet 8: Data Issues ──
  const ws8 = wb.addWorksheet("Data Issues");
  ws8.columns = [
    { header: "#", width: 4 },
    { header: "Issue", width: 44 },
    { header: "Severity", width: 12 },
    { header: "Count", width: 8 },
    { header: "Details", width: 60 },
  ];
  ws8.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));
  report.dataIssues.forEach((issue, i) => {
    ws8.addRow([i + 1, issue.description, issue.severity, issue.count, (issue.details || []).join(", ")]);
  });
  if (report.dataIssues.length === 0) {
    ws8.addRow(["", "No data issues detected", "", "", ""]);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `SH_Monthly_Financial_Report_${getMonthName(month)}_${year}.xlsx`;

  return { buffer, filename, report };
}
