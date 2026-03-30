"use client";

export default function Scoreboard({ stats, isAdmin }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isAdmin ? "repeat(auto-fit, minmax(140px, 1fr))" : "repeat(auto-fit, minmax(160px, 1fr))",
      gap: 12,
    }}>
      {/* Anniversaries progress */}
      <ScoreCard
        label="Anniversaries"
        value={`${stats.anniversariesCompleted}/${stats.anniversariesTotal}`}
        sub="this month"
        progress={stats.anniversariesTotal > 0 ? stats.anniversariesCompleted / stats.anniversariesTotal : 0}
        color="#e74c3c"
      />

      {/* Completed items */}
      <ScoreCard
        label="Completed"
        value={stats.completedThisMonth}
        sub="this month"
        color="#c4a237"
      />

      {/* Hours invested */}
      <ScoreCard
        label="Hours"
        value={stats.hoursThisMonth}
        sub="invested this month"
        color="#27ae60"
      />

      {/* Streak */}
      <ScoreCard
        label="Streak"
        value={`${stats.streak}d`}
        sub="consecutive days"
        color="#8e44ad"
      />

      {/* Admin: heroes */}
      {isAdmin && (
        <ScoreCard
          label="Heroes"
          value={stats.heroesHonored}
          sub="active listings"
          color="#c4a237"
        />
      )}
    </div>
  );
}

function ScoreCard({ label, value, sub, progress, color }) {
  return (
    <div style={{
      padding: "16px 14px",
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderTop: `3px solid ${color}`,
      borderRadius: "var(--radius-md)",
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-bright)", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>{sub}</div>

      {/* Progress bar */}
      {progress !== undefined && (
        <div style={{
          marginTop: 8, height: 4,
          background: "var(--card-border)", borderRadius: 2, overflow: "hidden",
        }}>
          <div style={{
            width: `${Math.round(progress * 100)}%`,
            height: "100%", background: color,
            transition: "width 0.3s ease",
          }} />
        </div>
      )}
    </div>
  );
}
