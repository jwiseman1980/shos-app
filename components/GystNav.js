"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GYST_TABS = [
  { href: "/gyst", label: "Overview", exact: true },
  { href: "/gyst/properties", label: "Properties" },
];

export default function GystNav() {
  const pathname = usePathname();

  return (
    <nav className="finance-nav">
      {GYST_TABS.map((tab) => {
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
