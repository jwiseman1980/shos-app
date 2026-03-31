"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import RoleChat from "@/components/RoleChat";

const OPERATOR_COLOR = "#c4a237";

export default function FloatingRoleChat({ currentUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Dashboard has its own inline chat — hide the floating button there
  if (pathname === "/") return null;

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            background: "var(--bg-2)",
            border: `1px solid ${OPERATOR_COLOR}`,
            borderRadius: 999,
            color: OPERATOR_COLOR,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            transition: "all 0.15s ease",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: OPERATOR_COLOR,
            }}
          />
          Talk to Operator
        </button>
      )}

      {/* Chat Panel */}
      {open && <RoleChat pathname={pathname} onClose={() => setOpen(false)} currentUser={currentUser} />}
    </>
  );
}
