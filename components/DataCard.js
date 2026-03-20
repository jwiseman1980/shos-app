export default function DataCard({ title, action, children }) {
  return (
    <div className="card">
      {(title || action) && (
        <div className="card-header">
          {title && <span className="card-title">{title}</span>}
          {action && action}
        </div>
      )}
      {children}
    </div>
  );
}
