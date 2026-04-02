"use client";

import { useState, useMemo } from "react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://shos-app.vercel.app";

export default function DesignCatalog({ designs = [] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return designs;
    const q = search.toLowerCase();
    return designs.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.heroName && d.heroName.toLowerCase().includes(q)) ||
        d.sku.toLowerCase().includes(q)
    );
  }, [designs, search]);

  if (designs.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
        No completed designs in storage.
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU, or hero..."
          style={{
            width: "100%",
            maxWidth: 400,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--card-border)",
            background: "var(--bg)",
            color: "var(--text-bright)",
            fontSize: 13,
            boxSizing: "border-box",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 12 }}>
          {filtered.length} of {designs.length} designs
        </span>
      </div>

      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: 8,
          overflow: "hidden",
          maxHeight: 500,
          overflowY: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "var(--card-bg)", zIndex: 1 }}>
              <th style={thStyle}>SKU</th>
              <th style={thStyle}>Hero</th>
              <th style={thStyle}>Size</th>
              <th style={thStyle}>File</th>
              <th style={thStyle}>Download</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.name} style={{ borderBottom: "1px solid var(--card-border)" }}>
                <td style={tdStyle}>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                    {d.sku}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontWeight: 500, color: "var(--text-bright)", fontSize: 13 }}>
                    {d.heroName || d.sku}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-dim)" }}>
                  {d.size === "6" ? '6"' : d.size === "7" ? '7"' : "—"}
                </td>
                <td style={{ ...tdStyle, fontSize: 11, color: "var(--text-dim)" }}>
                  {d.name}
                </td>
                <td style={tdStyle}>
                  <a
                    href={`/api/designs/download?sku=${encodeURIComponent(d.sku)}`}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--status-blue)",
                      textDecoration: "none",
                      padding: "3px 10px",
                      border: "1px solid var(--status-blue)",
                      borderRadius: 4,
                      display: "inline-block",
                    }}
                  >
                    ↓ SVG
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tdStyle = { padding: "6px 12px", fontSize: 13, verticalAlign: "middle" };
const thStyle = {
  padding: "8px 12px",
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-dim)",
  textAlign: "left",
};
