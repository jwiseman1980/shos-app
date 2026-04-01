export default function PageShell({ title, subtitle, action, children }) {
  return (
    <div className="page-shell">
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {action && <div style={{ flexShrink: 0, paddingTop: 4 }}>{action}</div>}
      </div>
      {children}
    </div>
  );
}
