"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/", icon: "\u2302", label: "Dashboard" },
      { href: "/sops", icon: "\u2611", label: "SOP Runner" },
    ],
  },
  {
    label: "Memorial",
    items: [
      { href: "/anniversaries", icon: "\u2605", label: "Anniversaries" },
      { href: "/memorials", icon: "\u2756", label: "Memorial Pages" },
      { href: "/content", icon: "\u270E", label: "Content Generator" },
    ],
  },
  {
    label: "Fulfillment",
    items: [
      { href: "/orders", icon: "\u2692", label: "Order Queue" },
      { href: "/designs", icon: "\u270E", label: "Design Queue" },
      { href: "/bracelets", icon: "\u25CB", label: "Bracelet Pipeline" },
      { href: "/laser", icon: "\u2604", label: "Laser Production" },
    ],
  },
  {
    label: "Engagement",
    items: [
      { href: "/donors", icon: "\u2665", label: "Donor Engagement" },
      { href: "/email", icon: "\u2709", label: "Email Composer" },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/volunteers", icon: "\u263A", label: "Volunteers" },
      { href: "/org", icon: "\u2630", label: "Org Chart" },
      { href: "/finance", icon: "\u0024", label: "Finance" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">SH</div>
        <div>
          <div className="sidebar-brand-text">Steel Hearts</div>
          <div className="sidebar-brand-sub">Operating System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="sidebar-group">
            <div className="sidebar-group-label">{group.label}</div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${pathname === item.href ? "active" : ""}`}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        SHOS v0.1 &middot; Internal Use Only
      </div>
    </aside>
  );
}
