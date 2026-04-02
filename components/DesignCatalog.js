"use client";

import { useState, useMemo } from "react";

/**
 * Group designs by base SKU so 6" and 7" appear on one row.
 */
function groupByHero(designs) {
  const map = new Map();
  for (const d of designs) {
    const key = d.baseSku || d.sku;
    if (!map.has(key)) {
      map.set(key, { baseSku: key, heroName: d.heroName, sizes: {} });
    }
    const group = map.get(key);
    if (!group.heroName && d.heroName) group.heroName = d.heroName;
    if (d.size) {
      group.sizes[d.size] = d.sku;
    } else {
      // Base file with no size suffix
      group.sizes["base"] = d.sku;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.heroName || a.baseSku).localeCompare(b.heroName || b.baseSku)
  );
}

export default function DesignCatalog({ designs = [] }) {
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => groupByHero(designs), [designs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped.filter(
      (g) =>
        g.baseSku.toLowerCase().includes(q) ||
        (g.heroName && g.heroName.toLowerCase().includes(q))
    );
  }, [grouped, search]);

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
          placeholder="Search by name or SKU..."
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
          {filtered.length} of {grouped.length} heroes
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
              <th style={thStyle}>Hero</th>
              <th style={thStyle}>SKU</th>
              <th style={thStyle}>Downloads</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr key={g.baseSku} style={{ borderBottom: "1px solid var(--card-border)" }}>
                <td style={tdStyle}>
                  <span style={{ fontWeight: 500, color: "var(--text-bright)", fontSize: 13 }}>
                    {g.heroName || g.baseSku}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                    {g.baseSku}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {g.sizes["7"] && (
                      <a
                        href={`/api/designs/download?sku=${encodeURIComponent(g.sizes["7"])}`}
                        style={linkStyle}
                      >
                        ↓ 7"
                      </a>
                    )}
                    {g.sizes["6"] && (
                      <a
                        href={`/api/designs/download?sku=${encodeURIComponent(g.sizes["6"])}`}
                        style={linkStyle}
                      >
                        ↓ 6"
                      </a>
                    )}
                    {g.sizes["base"] && !g.sizes["7"] && !g.sizes["6"] && (
                      <a
                        href={`/api/designs/download?sku=${encodeURIComponent(g.sizes["base"])}`}
                        style={linkStyle}
                      >
                        ↓ SVG
                      </a>
                    )}
                  </div>
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
const linkStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--status-blue)",
  textDecoration: "none",
  padding: "3px 10px",
  border: "1px solid var(--status-blue)",
  borderRadius: 4,
  display: "inline-block",
  whiteSpace: "nowrap",
};
