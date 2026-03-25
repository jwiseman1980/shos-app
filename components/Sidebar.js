"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/", icon: "\u2302", label: "Daily Brief" },
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
      { href: "/inventory", icon: "\u2193", label: "Inventory Burnout" },
    ],
  },
  {
    label: "Engagement",
    items: [
      { href: "/messages", icon: "\u2709", label: "Family Messages" },
      { href: "/donors", icon: "\u2665", label: "Donor Engagement" },
      { href: "/email", icon: "\u270E", label: "Email Composer" },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/volunteers", icon: "\u263A", label: "Volunteers" },
      { href: "/org", icon: "\u2630", label: "Org Chart" },
      { href: "/finance", icon: "\u0024", label: "Finance" },
      { href: "/settings", icon: "\u2699", label: "Settings" },
    ],
  },
];

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    document.cookie = "shos_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/brand/steel-hearts-logo-gold.svg" alt="Steel Hearts" style={{ width: 36, height: 36, flexShrink: 0 }} />
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
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: user.color || "#1e3a5f",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {user.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.name}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{user.role}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: "none", border: "none", color: "var(--text-dim)",
                cursor: "pointer", fontSize: 11, padding: "2px 6px",
              }}
              title="Sign out"
            >
              {"\u2192"}
            </button>
          </div>
        )}
        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
          SHOS v0.2 &middot; Internal Use Only
        </div>
      </div>
    </aside>
  );
}
