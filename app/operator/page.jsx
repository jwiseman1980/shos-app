"use client";

import { useEffect } from "react";
import OperatorStrip from "@/components/OperatorStrip";

// Full-page Operator view — accessible from the mobile bottom tab bar.
// On desktop, the Operator is always visible in ConsoleShell's bottom strip.
// This page gives mobile users a dedicated full-screen context.
export default function OperatorPage() {
  // Scroll to top on load
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      color: "#e8eaed",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 20px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(14,14,18,0.96)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4b5563", marginBottom: 2 }}>
          HonorBase
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Operator</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
          AI-powered executive assistant — Steel Hearts Foundation
        </div>
      </div>

      {/* Operator strip in full-page mode */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <OperatorStrip fullPage />
      </div>
    </div>
  );
}
