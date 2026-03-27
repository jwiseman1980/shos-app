import DataCard from "@/components/DataCard";
import MonthPicker from "@/components/MonthPicker";
import SopChecklist from "@/components/SopChecklist";
import { getCurrentMonth, getCurrentYear, getMonthName } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function MonthlyClosePage({ searchParams }) {
  const params = await searchParams;
  const currentMonth = getCurrentMonth();
  const currentYear = getCurrentYear();
  // Default to previous month (close is always for the prior month)
  const defaultMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const defaultYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const month = Number(params?.month) || defaultMonth;
  const year = Number(params?.year) || defaultYear;

  const CLOSE_STEPS = [
    {
      step: 1,
      title: "Download Chase Checking CSV",
      detail: `Download ${getMonthName(month)} ${year} statement from chase.com for account ending 2352.`,
      who: "joseph",
    },
    {
      step: 2,
      title: "Download Chase Credit Card CSV",
      detail: `Download ${getMonthName(month)} ${year} statement from chase.com for card ending 3418.`,
      who: "joseph",
    },
    {
      step: 3,
      title: "Upload & categorize expenses",
      detail: "Upload both CSVs to the Expenses page. Review auto-categorizations and fix any mismatches.",
      who: "operator",
      link: `/finance/expenses?month=${month}&year=${year}`,
    },
    {
      step: 4,
      title: "Enter Donorbox donations",
      detail: "Pull Donorbox dashboard for the month and enter each donation on the Donations Received page.",
      who: "operator",
      link: `/finance/donations?month=${month}&year=${year}`,
    },
    {
      step: 5,
      title: "Enter other donations (Stripe, PayPal, checks)",
      detail: "Check Stripe dashboard, PayPal, and any physical checks received. Enter on Donations page.",
      who: "operator",
      link: `/finance/donations?month=${month}&year=${year}`,
    },
    {
      step: 6,
      title: "Review auto-generated report",
      detail: "Open the Monthly Report page and review all 8 sections. Verify totals look reasonable.",
      who: "joseph",
      link: `/finance/report?month=${month}&year=${year}`,
    },
    {
      step: 7,
      title: "Resolve data issues (Sheet 8)",
      detail: "Address any flagged issues: missing orgs, unmatched SKUs, missing receipts.",
      who: "joseph",
      link: `/finance/report?month=${month}&year=${year}`,
    },
    {
      step: 8,
      title: "Joseph review & approve",
      detail: "Final review of all report sections. Confirm numbers match bank statements.",
      who: "joseph",
    },
    {
      step: 9,
      title: "Export Excel for Sara",
      detail: "Click Export Excel on the Report page. Save the .xlsx file.",
      who: "operator",
      link: `/api/finance/report/export?month=${month}&year=${year}`,
    },
    {
      step: 10,
      title: "Email report to Sara",
      detail: "Attach the Excel workbook to an email to sara.curran@outlook.com with the month summary.",
      who: "joseph",
    },
    {
      step: 11,
      title: "Mark report as Final",
      detail: "Update the report status in the Archive page.",
      who: "operator",
      link: "/finance/archive",
    },
  ];

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)" }}>
          {getMonthName(month)} {year} Close
        </div>
        <MonthPicker month={month} year={year} basePath="/finance/close" />
      </div>

      {/* Timeline */}
      <DataCard title={`SOP-FIN-002 — Monthly Financial Close`}>
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text-bright)" }}>Timeline:</strong> 1st&ndash;7th of each month
          <br />
          <strong>Day 1:</strong> Download bank data, pull donations
          <br />
          <strong>Days 1&ndash;3:</strong> Build report (auto-generated sections + manual entries)
          <br />
          <strong>Days 3&ndash;5:</strong> Joseph review, resolve issues
          <br />
          <strong>Days 5&ndash;7:</strong> Finalize + deliver to Sara Curran (bookkeeper)
        </div>

        {/* Step links */}
        <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={`/finance/expenses?month=${month}&year=${year}`} className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }}>
            Expenses
          </a>
          <a href={`/finance/donations?month=${month}&year=${year}`} className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }}>
            Donations
          </a>
          <a href={`/finance/report?month=${month}&year=${year}`} className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }}>
            Report
          </a>
          <a href={`/api/finance/report/export?month=${month}&year=${year}`} className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }}>
            Export Excel
          </a>
        </div>

        <SopChecklist
          sopId={`FIN-002-${year}-${String(month).padStart(2, "0")}`}
          sopTitle={`Monthly Financial Close — ${getMonthName(month)} ${year}`}
          steps={CLOSE_STEPS}
        />
      </DataCard>
    </>
  );
}
