"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import NewHeroModal from "./NewHeroModal";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const BRACELET_BASE = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/bracelet-designs`
  : "";

const STATUS_META = {
  live: { color: "var(--status-green)", label: "Live" },
  no_page: { color: "var(--status-orange)", label: "Needs page" },
  needs_design: { color: "var(--status-red)", label: "Needs design" },
};

const ACADEMY_FILTERS = ["USMA", "USNA", "USAFA"];
const BRANCH_FILTERS = ["USA", "USMC", "USN", "USAF", "FIRE"];

export default function HeroCatalog({ heroes, counts }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    let list = heroes;

    if (filter === "needs_design") {
      list = list.filter((h) => h.status === "needs_design");
    } else if (filter === "no_page") {
      list = list.filter((h) => h.status === "no_page");
    } else if (ACADEMY_FILTERS.includes(filter)) {
      list = list.filter((h) => h.academy === filter);
    } else if (BRANCH_FILTERS.includes(filter)) {
      list = list.filter((h) => h.branchPrefix === filter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((h) => {
        return (
          (h.name && h.name.toLowerCase().includes(q)) ||
          (h.sku && h.sku.toLowerCase().includes(q)) ||
          (h.branch && h.branch.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [heroes, filter, search]);

  return (
    <div>
      <div style={searchRow}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU, or branch..."
          style={searchInput}
        />
        <span style={resultCount}>
          {filtered.length} of {heroes.length}
        </span>
      </div>

      <div style={pillRow}>
        <Pill active={filter === "all"} onClick={() => setFilter("all")} label={`All ${counts.total}`} />
        <Pill
          active={filter === "needs_design"}
          onClick={() => setFilter("needs_design")}
          label={`Needs Design ${counts.needsDesign}`}
          color="var(--status-red)"
        />
        <Pill
          active={filter === "no_page"}
          onClick={() => setFilter("no_page")}
          label={`Needs Page ${counts.noPage}`}
          color="var(--status-orange)"
        />
        <PillDivider />
        {ACADEMY_FILTERS.map((a) => (
          <Pill key={a} active={filter === a} onClick={() => setFilter(a)} label={a} />
        ))}
        <PillDivider />
        {BRANCH_FILTERS.map((b) => (
          <Pill key={b} active={filter === b} onClick={() => setFilter(b)} label={b} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={emptyState}>No heroes match your search or filter.</div>
      ) : (
        <div style={grid}>
          {filtered.map((h) => (
            <HeroCard key={h.id} hero={h} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowNew(true)}
        style={fab}
        aria-label="New hero"
        title="New hero"
      >
        +
      </button>

      {showNew && <NewHeroModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

function HeroCard({ hero }) {
  const meta = STATUS_META[hero.status] || STATUS_META.no_page;
  const thumb = hero.sku && hero.hasFiles && BRACELET_BASE
    ? `${BRACELET_BASE}/${hero.sku}/${hero.sku}-7.svg`
    : null;

  return (
    <Link href={`/heroes/${hero.id}`} style={cardStyle} className="hero-card">
      <div style={cardThumb}>
        {thumb ? (
          <img
            src={thumb}
            alt={hero.name}
            style={thumbImg}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}
        <div
          style={{
            ...thumbPlaceholder,
            display: thumb ? "none" : "flex",
          }}
        >
          No Design
        </div>
        <span
          style={{ ...statusDot, background: meta.color }}
          title={meta.label}
        />
      </div>
      <div style={cardBody}>
        <div style={cardName}>{hero.name}</div>
        <div style={cardMeta}>
          {hero.rank && <span style={metaRank}>{hero.rank}</span>}
          {hero.branch && <span style={metaBranch}>{hero.branch}</span>}
          {hero.academy && <span style={metaAcademy}>{hero.academy}</span>}
        </div>
        {hero.sku && <div style={cardSku}>{hero.sku}</div>}
      </div>
    </Link>
  );
}

function Pill({ active, onClick, label, color }) {
  const activeColor = color || "var(--gold)";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...pillBase,
        ...(active
          ? { borderColor: activeColor, color: activeColor, background: "rgba(255,255,255,0.04)" }
          : {}),
      }}
    >
      {label}
    </button>
  );
}

function PillDivider() {
  return <span style={pillDivider} />;
}

const searchRow = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  flexWrap: "wrap",
};

const searchInput = {
  flex: 1,
  minWidth: 240,
  maxWidth: 480,
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid var(--card-border)",
  background: "var(--bg)",
  color: "var(--text-bright)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const resultCount = {
  fontSize: 12,
  color: "var(--text-dim)",
};

const pillRow = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 6,
  marginBottom: 20,
};

const pillBase = {
  padding: "5px 12px",
  fontSize: 12,
  fontWeight: 500,
  background: "transparent",
  border: "1px solid var(--card-border)",
  borderRadius: 999,
  color: "var(--text-dim)",
  cursor: "pointer",
  transition: "all 0.12s",
};

const pillDivider = {
  width: 1,
  height: 18,
  background: "var(--card-border)",
  margin: "0 4px",
};

const emptyState = {
  padding: 48,
  textAlign: "center",
  color: "var(--text-dim)",
  fontSize: 13,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 12,
};

const cardStyle = {
  display: "flex",
  flexDirection: "column",
  background: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: 10,
  overflow: "hidden",
  textDecoration: "none",
  color: "inherit",
  transition: "border-color 0.15s, transform 0.15s",
};

const cardThumb = {
  position: "relative",
  width: "100%",
  aspectRatio: "1 / 1",
  background: "var(--bg-3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const thumbImg = {
  maxWidth: "80%",
  maxHeight: "80%",
  objectFit: "contain",
};

const thumbPlaceholder = {
  position: "absolute",
  inset: 0,
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 500,
  color: "var(--text-dim)",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const statusDot = {
  position: "absolute",
  top: 8,
  right: 8,
  width: 10,
  height: 10,
  borderRadius: "50%",
  boxShadow: "0 0 0 2px var(--bg-3)",
};

const cardBody = {
  padding: "10px 12px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minHeight: 64,
};

const cardName = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-bright)",
  lineHeight: 1.3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
};

const cardMeta = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  fontSize: 10,
};

const metaRank = {
  color: "var(--gold)",
  fontWeight: 600,
  letterSpacing: "0.04em",
};

const metaBranch = {
  color: "var(--silver-dark)",
};

const metaAcademy = {
  padding: "1px 6px",
  borderRadius: 4,
  background: "rgba(196, 162, 55, 0.1)",
  color: "var(--gold)",
  fontWeight: 600,
  letterSpacing: "0.04em",
};

const cardSku = {
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  color: "var(--text-dim)",
  marginTop: 2,
};

const fab = {
  position: "fixed",
  bottom: 88,
  right: 24,
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "var(--gold)",
  color: "#0a0a0e",
  border: "none",
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(196, 162, 55, 0.3)",
  zIndex: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
