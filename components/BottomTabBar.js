"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/dashboard/today",
    label: "Feed",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    ),
    matchPaths: ["/dashboard/today", "/"],
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    matchPaths: ["/pipeline", "/pipelines"],
  },
  {
    href: "/operator",
    label: "Operator",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    matchPaths: ["/operator"],
  },
];

export default function BottomTabBar({ badgeCounts = {} }) {
  const pathname = usePathname();

  function isActive(tab) {
    return tab.matchPaths.some((p) =>
      p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")
    );
  }

  return (
    <nav className="bottom-tab-bar" aria-label="Main navigation">
      {TABS.map((tab) => {
        const active = isActive(tab);
        const badge = badgeCounts[tab.href];
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tab-item ${active ? "tab-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="tab-icon-wrap">
              {tab.icon}
              {badge > 0 && (
                <span className="tab-badge">{badge > 99 ? "99+" : badge}</span>
              )}
            </span>
            <span className="tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
