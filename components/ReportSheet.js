/**
 * ReportSheet — renders one section of the monthly financial report.
 * Server component — no client-side JS needed.
 */
export default function ReportSheet({ number, title, badge, badgeColor, children }) {
  return (
    <div className="report-section">
      <div className="report-section-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-dim)",
            background: "var(--bg)",
            padding: "2px 8px",
            borderRadius: "var(--radius-pill)",
          }}>
            Sheet {number}
          </span>
          <span className="report-section-title">{title}</span>
        </div>
        {badge && (
          <span className="report-section-badge" style={{
            background: badgeColor === "green"
              ? "var(--status-green-bg)"
              : badgeColor === "orange"
              ? "var(--status-orange-bg)"
              : "var(--status-gray-bg)",
            color: badgeColor === "green"
              ? "var(--status-green)"
              : badgeColor === "orange"
              ? "var(--status-orange)"
              : "var(--status-gray)",
          }}>
            {badge}
          </span>
        )}
      </div>
      <div className="card" style={{ padding: 16 }}>
        {children}
      </div>
    </div>
  );
}
