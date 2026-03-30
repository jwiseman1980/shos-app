"use client";

const TYPE_META = {
  outreach:  { icon: "\u2764", color: "#e74c3c" },
  deadline:  { icon: "\u26a0", color: "#e74c3c" },
  donor:     { icon: "\u2605", color: "#27ae60" },
  order:     { icon: "\ud83d\udce6", color: "#e67e22" },
  design:    { icon: "\u270e", color: "#3498db" },
  recurring: { icon: "\ud83d\udccb", color: "#8e44ad" },
  task:      { icon: "\u2611", color: "#c4a237" },
  explore:   { icon: "\ud83d\udd0d", color: "#1abc9c" },
  idea:      { icon: "\ud83d\udca1", color: "#b0b8c4" },
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Accomplishments({ items }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>
        No accomplishments logged yet. Complete items from the queue above.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((item) => {
        const meta = TYPE_META[item.item_type] || TYPE_META.task;
        return (
          <div
            key={item.id}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              background: "var(--bg)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span style={{ fontSize: 14 }}>{meta.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: "var(--text-bright)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {item.user_name && <span style={{ color: meta.color }}>{item.user_name.split(" ")[0]}</span>}
                {item.user_name && " — "}
                {item.title}
              </div>
              {item.outcome && item.outcome !== "Completed" && (
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>
                  {item.outcome}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {item.duration_minutes && (
                <span style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 6,
                  background: "rgba(39, 174, 96, 0.1)", color: "var(--status-green)",
                  fontWeight: 600,
                }}>
                  {item.duration_minutes}m
                </span>
              )}
              <span style={{ fontSize: 10, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                {timeAgo(item.completed_at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
