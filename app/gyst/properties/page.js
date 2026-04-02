import Link from "next/link";
import { getProperties } from "@/lib/data/properties";

export const dynamic = "force-dynamic";

const STATUS_COLORS = {
  active: "var(--status-green)",
  turnover: "var(--gold)",
  vacant: "var(--status-red)",
  sold: "var(--text-dim)",
};

function fmt(n) {
  return n != null ? `$${Number(n).toLocaleString()}` : "—";
}

export default async function PropertiesPage() {
  let properties = [];
  let error = null;

  try {
    properties = await getProperties();
  } catch (err) {
    error = err.message;
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 20, color: "var(--status-red)", fontSize: 13 }}>
        <strong>Error loading properties:</strong> {error}
        <p style={{ marginTop: 8, color: "var(--text-dim)" }}>
          If the table does not exist, run the SQL from{" "}
          <code>app/api/gyst/setup/route.js</code> in Supabase, then POST to{" "}
          <code>/api/gyst/setup</code> to seed data.
        </p>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="card" style={{ padding: 20, fontSize: 13, color: "var(--text-dim)" }}>
        No properties yet. POST to <code>/api/gyst/setup</code> to seed the Schoolfield property.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
      {properties.map((p) => {
        const equity = (p.estimated_value || 0) - (p.mortgage_balance || 0);
        const statusColor = STATUS_COLORS[p.role] || "var(--text-dim)";

        return (
          <Link
            key={p.id}
            href={`/gyst/properties/${p.id}`}
            style={{ textDecoration: "none" }}
          >
            <div className="card" style={{ cursor: "pointer", transition: "border-color 0.15s" }}>
              <div style={{ padding: 16 }}>
                {/* Name + status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)" }}>
                    {p.address}
                  </span>
                  <span style={{
                    padding: "2px 10px",
                    borderRadius: "var(--radius-pill)",
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    background: `${statusColor}20`,
                    color: statusColor,
                    border: `1px solid ${statusColor}40`,
                  }}>
                    {p.role || "rental"}
                  </span>
                </div>

                {/* Address */}
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
                  {p.address}, {p.city}, {p.state} {p.zip}
                </div>

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                  <StatRow label="Rent" value={`${fmt(p.rental_income)}/mo`} />
                  <StatRow label="Value" value={fmt(p.estimated_value)} />
                  <StatRow label="Equity" value={fmt(equity)} accent={equity > 0 ? "var(--status-green)" : "var(--status-red)"} />
                  <StatRow label="Mortgage" value={`${fmt(p.mortgage_payment)}/mo`} />
                </div>

                {/* Tenant */}
                {p.tenant_name && (
                  <div style={{ marginTop: 12, padding: "6px 10px", background: "var(--bg-3)", borderRadius: "var(--radius-sm)", fontSize: 11, color: "var(--text-dim)" }}>
                    Tenant: {p.tenant_name}
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function StatRow({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: accent || "var(--text-bright)" }}>
        {value}
      </div>
    </div>
  );
}
