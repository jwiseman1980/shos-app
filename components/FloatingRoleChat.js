"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import RoleChat from "@/components/RoleChat";

const ROLE_COLORS = {
  ed:     "#c4a237",
  cos:    "#b0b8c4",
  cfo:    "#27ae60",
  coo:    "#e67e22",
  comms:  "#8e44ad",
  dev:    "#3498db",
  family: "#e74c3c",
};

const ROLE_LABELS = {
  ed:     "ED",
  cos:    "COS",
  cfo:    "CFO",
  coo:    "COO",
  comms:  "Comms",
  dev:    "Dev",
  family: "Family",
};

// Map paths to roles — first match wins
const ROLE_PATHS = [
  { role: "cfo",    prefixes: ["/finance"] },
  { role: "cos",    prefixes: ["/cos", "/sops", "/email", "/org", "/settings"] },
  { role: "coo",    prefixes: ["/coo", "/bracelets", "/orders", "/designs", "/laser", "/shipping", "/inventory"] },
  { role: "comms",  prefixes: ["/comms", "/content", "/memorials", "/anniversaries"] },
  { role: "dev",    prefixes: ["/dev", "/donors"] },
  { role: "family", prefixes: ["/family", "/families", "/messages", "/volunteers"] },
  { role: "ed",     prefixes: ["/gyst", "/"] },
];

function getRole(pathname) {
  for (const { role, prefixes } of ROLE_PATHS) {
    for (const prefix of prefixes) {
      if (prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)) {
        return role;
      }
    }
  }
  return "ed";
}

export default function FloatingRoleChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const role = getRole(pathname);
  const color = ROLE_COLORS[role];
  const label = ROLE_LABELS[role];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 100,
          background: color,
          color: role === "cos" || role === "coo" ? "#0a0a0e" : "#fff",
          border: "none",
          borderRadius: 28,
          padding: "10px 20px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: `0 4px 20px ${color}40`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          letterSpacing: "0.02em",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = `0 6px 24px ${color}60`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = `0 4px 20px ${color}40`;
        }}
      >
        <span style={{ fontSize: 15 }}>◎</span>
        Talk to {label}
      </button>

      {open && <RoleChat role={role} onClose={() => setOpen(false)} />}
    </>
  );
}
