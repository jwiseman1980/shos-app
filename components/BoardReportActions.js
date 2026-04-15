"use client";

export default function BoardReportActions({ year }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <button
        className="btn btn-primary"
        onClick={() => window.print()}
        style={{ fontSize: 12 }}
      >
        Print / Save PDF
      </button>
      <a
        href={`/api/finance/bookkeeper-export?start=${year}-01-01&end=${year}-12-31`}
        className="btn"
        style={{
          fontSize: 12,
          padding: "6px 14px",
          border: "1px solid var(--card-border)",
          color: "var(--text)",
          textDecoration: "none",
          borderRadius: "var(--radius-md)",
        }}
      >
        Export for Sara (Excel)
      </a>
    </div>
  );
}
