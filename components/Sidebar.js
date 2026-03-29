"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Role color palette — each role has a distinct identity
export const ROLE_COLORS = {
  ed:     "#c4a237",  // gold — direction, brand
  cos:    "#b0b8c4",  // silver — governance, infrastructure
  cfo:    "#27ae60",  // green — money
  coo:    "#e67e22",  // orange — production
  comms:  "#8e44ad",  // purple — creative, public-facing
  dev:    "#3498db",  // blue — growth, fundraising
  family: "#e74c3c",  // red — relationships, heart
};

const NAV_ROLES = [
  {
    role: "ed",
    label: "Command",
    href: "/",
    items: [
      { href: "/", label: "Daily Brief", exact: true },
      { href: "/tasks", label: "Tasks" },
      { href: "/gyst", label: "Personal" },
    ],
  },
  {
    role: "cos",
    label: "Governance",
    href: "/cos",
    items: [
      { href: "/cos", label: "Overview", exact: true },
      { href: "/sops", label: "SOPs" },
      { href: "/engagements", label: "Engagements" },
      { href: "/email", label: "Email" },
      { href: "/org", label: "Org Chart" },
      { href: "/settings", label: "Settings" },
    ],
  },
  {
    role: "cfo",
    label: "Finance",
    href: "/finance",
    items: [
      { href: "/finance", label: "Overview", exact: true },
      { href: "/finance/report", label: "Monthly Report" },
      { href: "/finance/disbursements", label: "Disbursements" },
      { href: "/finance/recon", label: "Recon Matrix" },
      { href: "/finance/expenses", label: "Expenses" },
      { href: "/finance/donations", label: "Donations" },
      { href: "/finance/close", label: "Monthly Close" },
      { href: "/finance/archive", label: "Archive" },
    ],
  },
  {
    role: "coo",
    label: "Operations",
    href: "/coo",
    items: [
      { href: "/coo", label: "Overview", exact: true },
      { href: "/bracelets", label: "Pipeline" },
      { href: "/orders", label: "Orders" },
      { href: "/designs", label: "Designs" },
      { href: "/laser", label: "Laser" },
      { href: "/shipping", label: "Shipping" },
      { href: "/inventory", label: "Inventory" },
    ],
  },
  {
    role: "comms",
    label: "Communications",
    href: "/comms",
    items: [
      { href: "/comms", label: "Overview", exact: true },
      { href: "/comms/social", label: "Social Media" },
      { href: "/content", label: "Content Generator" },
      { href: "/memorials", label: "Memorial Pages" },
    ],
  },
  {
    role: "dev",
    label: "Development",
    href: "/dev",
    items: [
      { href: "/dev", label: "Overview", exact: true },
      { href: "/donors", label: "Donors" },
    ],
  },
  {
    role: "family",
    label: "Family Relations",
    href: "/family",
    items: [
      { href: "/family", label: "Overview", exact: true },
      { href: "/anniversaries", label: "Anniversary Emails" },
      { href: "/messages", label: "Messages" },
      { href: "/families", label: "Families" },
      { href: "/volunteers", label: "Volunteers" },
    ],
  },
];

function isItemActive(item, pathname) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");
}

function getActiveRole(pathname) {
  for (const roleGroup of NAV_ROLES) {
    for (const item of roleGroup.items) {
      if (isItemActive(item, pathname)) return roleGroup.role;
    }
    if (
      roleGroup.href !== "/" &&
      (pathname === roleGroup.href || pathname.startsWith(roleGroup.href + "/"))
    ) {
      return roleGroup.role;
    }
  }
  return "ed";
}

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeRole = getActiveRole(pathname);

  const handleLogout = async () => {
    document.cookie = "shos_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img
          src="/brand/steel-hearts-logo-gold.svg"
          alt="Steel Hearts"
          style={{ width: 36, height: 36, flexShrink: 0 }}
        />
        <div>
          <div className="sidebar-brand-text">Steel Hearts</div>
          <div className="sidebar-brand-sub">Operating System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ROLES.map((roleGroup) => {
          const isActive = roleGroup.role === activeRole;
          const color = ROLE_COLORS[roleGroup.role];

          return (
            <div key={roleGroup.role} className="sidebar-role-group">
              <Link
                href={roleGroup.href}
                className={`sidebar-role-header ${isActive ? "active" : ""}`}
                style={{ "--role-color": color }}
              >
                <span
                  className="sidebar-role-dot"
                  style={{ background: isActive ? color : "var(--text-dim)", opacity: isActive ? 1 : 0.3 }}
                />
                <span className="sidebar-role-label">{roleGroup.label}</span>
              </Link>

              {isActive && (
                <div className="sidebar-role-items">
                  {roleGroup.items.map((item) => {
                    const itemActive = isItemActive(item, pathname);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-sub-link ${itemActive ? "active" : ""}`}
                        style={itemActive ? { color, borderLeftColor: color } : undefined}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
              <div style={{
                fontSize: 12, fontWeight: 600, color: "var(--text-bright)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
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
          SHOS v0.3 &middot; Internal Use Only
        </div>
      </div>
    </aside>
  );
}
