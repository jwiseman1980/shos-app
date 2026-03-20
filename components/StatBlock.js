export default function StatBlock({ label, value, note, accent }) {
  return (
    <div className="stat-block" style={accent ? { borderTop: `2px solid ${accent}` } : undefined}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}
