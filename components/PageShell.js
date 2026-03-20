export default function PageShell({ title, subtitle, children }) {
  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
