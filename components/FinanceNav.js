"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const FINANCE_TABS = [
  { href: "/finance", label: "Overview", exact: true },
  { href: "/finance/dashboard", label: "KPI Dashboard" },
  { href: "/finance/report", label: "Monthly Report" },
  { href: "/finance/disbursements", label: "Disbursements" },
  { href: "/finance/recon", label: "Recon Matrix" },
  { href: "/finance/expenses", label: "Expenses" },
  { href: "/finance/donations", label: "Donations" },
  { href: "/finance/close", label: "Monthly Close" },
  { href: "/finance/archive", label: "Archive" },
];

export default function FinanceNav() {
  const pathname = usePathname();

  return (
    <nav className="finance-nav">
      {FINANCE_TABS.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`finance-tab ${isActive ? "active" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
