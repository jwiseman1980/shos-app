"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_SECTIONS = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard/today", label: "Feed" },
      { href: "/pipelines",       label: "Pipelines" },
      { href: "/email",           label: "Inbox" },
      { href: "/orders",          label: "Orders" },
      { href: "/production",      label: "Production" },
      { href: "/laser",           label: "Laser" },
      { href: "/designs",         label: "Designs" },
      { href: "/shipping",        label: "Shipping" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/anniversaries", label: "Anniversaries" },
      { href: "/families",      label: "Families" },
      { href: "/messages",      label: "Messages" },
      { href: "/donors",        label: "Donors" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/finance",              label: "Finance Overview" },
      { href: "/gyst",                 label: "Personal (GYST)" },
      { href: "/finance/disbursements",label: "Disbursements" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/compliance",   label: "Compliance" },
      { href: "/sops",         label: "SOPs" },
      { href: "/tasks",        label: "All Tasks" },
      { href: "/settings",     label: "Settings" },
    ],
  },
];

export default function HamburgerMenu({ user }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    document.cookie = "shos_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Hamburger trigger button */}
      <button
        className="hamburger-btn"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
      >
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
      </button>

      {/* Backdrop */}
      {open && (
        <div className="hamburger-backdrop" onClick={() => setOpen(false)} />
      )}

      {/* Drawer */}
      <div className={`hamburger-drawer ${open ? "open" : ""}`}>
        <div className="hd-header">
          <div className="hd-brand">
            <img src="/brand/steel-hearts-logo-gold.svg" alt="Steel Hearts" style={{ width: 28, height: 28 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaed" }}>Steel Hearts</div>
              <div style={{ fontSize: 10, color: "#4b5563" }}>Operating System</div>
            </div>
          </div>
          <button className="hd-close" onClick={() => setOpen(false)} aria-label="Close menu">✕</button>
        </div>

        <nav className="hd-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="hd-section">
              <div className="hd-section-label">{section.label}</div>
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`hd-link ${active ? "hd-active" : ""}`}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="hd-footer">
          {user && (
            <div className="hd-user">
              <div className="hd-avatar" style={{ background: user.color || "#1e3a5f" }}>
                {user.initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#e8eaed" }}>{user.name}</div>
                <div style={{ fontSize: 10, color: "#4b5563" }}>{user.role}</div>
              </div>
              <button className="hd-logout" onClick={handleLogout} title="Sign out">Sign out</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
