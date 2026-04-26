"use client";

import { useState } from "react";

const SECTIONS = [
  { key: "design", label: "Design Files" },
  { key: "info", label: "Quick Info" },
  { key: "photos", label: "Photos" },
  { key: "web", label: "Web Presence" },
  { key: "family", label: "Family" },
  { key: "orders", label: "Orders" },
  { key: "anniversary", label: "Anniversary" },
];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function HeroDetail({ hero, designs, photos, orders }) {
  const [open, setOpen] = useState({ design: true, info: true });

  const toggle = (key) =>
    setOpen((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div style={wrapper}>
      {SECTIONS.map((s) => (
        <Section
          key={s.key}
          label={s.label}
          isOpen={!!open[s.key]}
          onToggle={() => toggle(s.key)}
        >
          {s.key === "design" && <DesignSection hero={hero} designs={designs} />}
          {s.key === "info" && <InfoSection hero={hero} />}
          {s.key === "photos" && <PhotosSection photos={photos} />}
          {s.key === "web" && <WebSection hero={hero} />}
          {s.key === "family" && <FamilySection hero={hero} />}
          {s.key === "orders" && <OrdersSection orders={orders} />}
          {s.key === "anniversary" && <AnniversarySection hero={hero} />}
        </Section>
      ))}
    </div>
  );
}

function Section({ label, isOpen, onToggle, children }) {
  return (
    <div style={sectionWrap}>
      <button type="button" onClick={onToggle} style={sectionHeader}>
        <span style={sectionLabel}>{label}</span>
        <span style={{ ...sectionChevron, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
          ▶
        </span>
      </button>
      {isOpen && <div style={sectionBody}>{children}</div>}
    </div>
  );
}

// ── Design Files ───────────────────────────────────────────────

function DesignSection({ hero, designs }) {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState("");

  async function requestDesign() {
    setRequesting(true);
    setError(null);
    try {
      const res = await fetch("/api/heroes/request-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero_id: hero.id, notes }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Request failed");
      setRequested(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setRequesting(false);
    }
  }

  const status = hero.design_status || "not_started";
  const statusColor =
    status === "complete" || status === "approved"
      ? "var(--status-green)"
      : status === "in_progress" || status === "review"
      ? "var(--status-blue)"
      : "var(--status-orange)";

  return (
    <div>
      <div style={statusRow}>
        <span style={{ ...statusBadge, color: statusColor, borderColor: statusColor }}>
          {status.replace(/_/g, " ")}
        </span>
        {hero.lineitem_sku && (
          <span style={skuChip}>{hero.lineitem_sku}</span>
        )}
      </div>

      {designs.length > 0 ? (
        <div style={designGrid}>
          {designs.map((d) => (
            <div key={d.name} style={designCard}>
              <div style={designThumb}>
                <img src={d.url} alt={d.name} style={designImg} />
              </div>
              <div style={designLabel}>
                {d.size ? `${d.size}" size` : d.name}
              </div>
              <a
                href={d.url}
                download
                style={btnGhost}
              >
                Download
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div style={noDesignBox}>
          <div style={{ marginBottom: 12, color: "var(--text-dim)", fontSize: 13 }}>
            No design files in storage yet.
          </div>
          {requested ? (
            <div style={{ color: "var(--status-green)", fontSize: 13, fontWeight: 600 }}>
              ✓ Design request sent to Ryan
            </div>
          ) : (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional design notes for Ryan..."
                rows={2}
                style={textareaStyle}
              />
              <button
                type="button"
                onClick={requestDesign}
                disabled={requesting}
                style={btnPrimary}
              >
                {requesting ? "Sending..." : "Request Design"}
              </button>
              {error && (
                <div style={{ color: "var(--status-red)", fontSize: 12, marginTop: 8 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Quick Info ─────────────────────────────────────────────────

function InfoSection({ hero }) {
  const [fields, setFields] = useState({
    name: hero.name || "",
    rank: hero.rank || "",
    branch: hero.branch || "",
    memorial_month: hero.memorial_month || "",
    memorial_day: hero.memorial_day || "",
    lineitem_sku: hero.lineitem_sku || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  function set(key, value) {
    setFields((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/heroes/${hero.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          memorial_month: fields.memorial_month ? Number(fields.memorial_month) : null,
          memorial_day: fields.memorial_day ? Number(fields.memorial_day) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Save failed");
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={fieldGrid}>
        <Field label="Name">
          <input
            type="text"
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Rank">
          <input
            type="text"
            value={fields.rank}
            onChange={(e) => set("rank", e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Branch">
          <input
            type="text"
            value={fields.branch}
            onChange={(e) => set("branch", e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="SKU">
          <input
            type="text"
            value={fields.lineitem_sku}
            onChange={(e) => set("lineitem_sku", e.target.value)}
            style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
          />
        </Field>
        <Field label="Memorial Month">
          <select
            value={fields.memorial_month || ""}
            onChange={(e) => set("memorial_month", e.target.value)}
            style={inputStyle}
          >
            <option value="">—</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} ({MONTHS[i]})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Memorial Day">
          <input
            type="number"
            min="1"
            max="31"
            value={fields.memorial_day || ""}
            onChange={(e) => set("memorial_day", e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Saving..." : "Save"}
        </button>
        {saved && <span style={{ color: "var(--status-green)", fontSize: 12 }}>✓ Saved</span>}
        {error && <span style={{ color: "var(--status-red)", fontSize: 12 }}>{error}</span>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={fieldLabel}>
      <span style={fieldLabelText}>{label}</span>
      {children}
    </label>
  );
}

// ── Photos ─────────────────────────────────────────────────────

function PhotosSection({ photos }) {
  if (photos.length === 0) {
    return (
      <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
        No photos yet. Upload to <code style={inlineCode}>hero-photos/{"{SKU}"}/</code> in Supabase Storage.
      </div>
    );
  }
  return (
    <div style={photoGrid}>
      {photos.map((p) => (
        <a key={p.name} href={p.url} target="_blank" rel="noreferrer" style={photoCard}>
          <img src={p.url} alt={p.name} style={photoImg} loading="lazy" />
        </a>
      ))}
    </div>
  );
}

// ── Web Presence ───────────────────────────────────────────────

function WebSection({ hero }) {
  const lastNameSlug = (hero.last_name || hero.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const memorialUrl = hero.bio_page_url || `https://steel-hearts.org/heroes/${lastNameSlug}`;
  const squarespaceProduct = hero.lineitem_sku
    ? `https://steel-hearts.org/shop/${hero.lineitem_sku.toLowerCase()}`
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <LinkRow
        label="Memorial page"
        href={memorialUrl}
        present={Boolean(hero.bio_page_url)}
      />
      {squarespaceProduct && (
        <LinkRow label="Product page" href={squarespaceProduct} present={true} note="(unverified)" />
      )}
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
        Add social links to <code style={inlineCode}>heroes.bio_page_url</code> when posts go live.
      </div>
    </div>
  );
}

function LinkRow({ label, href, present, note }) {
  return (
    <div style={linkRow}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: present ? "var(--status-green)" : "var(--status-orange)",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 12, color: "var(--text-dim)", minWidth: 110 }}>
        {label}
      </span>
      <a href={href} target="_blank" rel="noreferrer" style={linkText}>
        {href}
      </a>
      {note && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{note}</span>}
    </div>
  );
}

// ── Family ─────────────────────────────────────────────────────

function FamilySection({ hero }) {
  const fc = hero.family_contact;
  if (!fc) {
    return (
      <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
        No family contact on file.
      </div>
    );
  }
  const fullName = [fc.first_name, fc.last_name].filter(Boolean).join(" ");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
      <div>
        <strong style={{ color: "var(--text-bright)" }}>{fullName}</strong>
      </div>
      {fc.email && (
        <div>
          <span style={{ color: "var(--text-dim)", marginRight: 8 }}>Email:</span>
          <a href={`mailto:${fc.email}`} style={linkText}>
            {fc.email}
          </a>
        </div>
      )}
      {fc.phone && (
        <div>
          <span style={{ color: "var(--text-dim)", marginRight: 8 }}>Phone:</span>
          {fc.phone}
        </div>
      )}
      {hero.anniversary_notes && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>NOTES</div>
          <div style={{ color: "var(--text)" }}>{hero.anniversary_notes}</div>
        </div>
      )}
    </div>
  );
}

// ── Orders ─────────────────────────────────────────────────────

function OrdersSection({ orders }) {
  return (
    <div style={statTiles}>
      <Tile label="Total Sold" value={orders.total} accent="var(--gold)" />
      <Tile label="Retail" value={orders.retail} accent="var(--status-green)" />
      <Tile label="Wholesale" value={orders.wholesale} accent="var(--status-blue)" />
      <Tile label="Donated" value={orders.donated} accent="var(--status-purple)" />
    </div>
  );
}

function Tile({ label, value, accent }) {
  return (
    <div style={{ ...tileBase, borderTop: `2px solid ${accent}` }}>
      <div style={tileLabel}>{label}</div>
      <div style={tileValue}>{value}</div>
    </div>
  );
}

// ── Anniversary ────────────────────────────────────────────────

function AnniversarySection({ hero }) {
  const month = hero.memorial_month;
  const day = hero.memorial_day;
  const dateStr = month && day ? `${MONTHS[month - 1]} ${day}` : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
      <Row label="Anniversary date" value={dateStr} />
      <Row label="Status" value={hero.anniversary_status || "not_started"} mono />
      <Row label="Outreach status" value={hero.anniversary_outreach_status || "—"} />
      <Row
        label="Last completed"
        value={hero.anniversary_completed_date || "—"}
      />
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
      <span style={{ color: "var(--text-dim)", fontSize: 12, minWidth: 130 }}>{label}</span>
      <span
        style={{
          color: "var(--text-bright)",
          fontFamily: mono ? "var(--font-mono)" : "inherit",
          fontSize: mono ? 12 : 13,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const wrapper = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const sectionWrap = {
  background: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: 10,
  overflow: "hidden",
};

const sectionHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "12px 16px",
  background: "transparent",
  border: "none",
  color: "var(--text-bright)",
  cursor: "pointer",
  textAlign: "left",
};

const sectionLabel = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--silver)",
};

const sectionChevron = {
  fontSize: 10,
  color: "var(--text-dim)",
  transition: "transform 0.15s",
};

const sectionBody = {
  padding: "0 16px 16px",
  borderTop: "1px solid var(--card-border)",
  paddingTop: 16,
};

const statusRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  flexWrap: "wrap",
};

const statusBadge = {
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 10px",
  border: "1px solid",
  borderRadius: 999,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const skuChip = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--text-dim)",
  padding: "2px 8px",
  background: "var(--bg-3)",
  borderRadius: 4,
};

const designGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const designCard = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  padding: 12,
  background: "var(--bg-3)",
  borderRadius: 8,
};

const designThumb = {
  width: "100%",
  aspectRatio: "1 / 1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg)",
  borderRadius: 6,
  overflow: "hidden",
};

const designImg = {
  maxWidth: "85%",
  maxHeight: "85%",
  objectFit: "contain",
};

const designLabel = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const noDesignBox = {
  padding: 16,
  background: "var(--bg-3)",
  border: "1px dashed var(--border-strong)",
  borderRadius: 8,
};

const textareaStyle = {
  width: "100%",
  minHeight: 56,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--card-border)",
  background: "var(--bg)",
  color: "var(--text-bright)",
  fontSize: 13,
  fontFamily: "inherit",
  resize: "vertical",
  marginBottom: 8,
  boxSizing: "border-box",
};

const btnPrimary = {
  padding: "8px 16px",
  background: "var(--gold)",
  color: "#0a0a0e",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost = {
  padding: "5px 12px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--status-blue)",
  textDecoration: "none",
  border: "1px solid var(--status-blue)",
  borderRadius: 4,
};

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
};

const fieldLabel = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const fieldLabelText = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-dim)",
};

const inputStyle = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--card-border)",
  background: "var(--bg)",
  color: "var(--text-bright)",
  fontSize: 13,
  outline: "none",
};

const photoGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
};

const photoCard = {
  display: "block",
  aspectRatio: "1 / 1",
  background: "var(--bg-3)",
  borderRadius: 6,
  overflow: "hidden",
};

const photoImg = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const linkRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 13,
  flexWrap: "wrap",
};

const linkText = {
  color: "var(--status-blue)",
  textDecoration: "none",
  wordBreak: "break-all",
};

const inlineCode = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  padding: "1px 6px",
  background: "var(--bg-3)",
  borderRadius: 3,
};

const statTiles = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
};

const tileBase = {
  padding: "12px 14px",
  background: "var(--bg-3)",
  borderRadius: 8,
};

const tileLabel = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: 4,
};

const tileValue = {
  fontSize: 24,
  fontWeight: 700,
  color: "var(--text-bright)",
};
