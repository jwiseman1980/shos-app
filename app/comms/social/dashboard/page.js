"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SocialDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/social/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d);
        else setError(d.error || "Failed to load dashboard data");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-header">
          <h1 className="page-title">Social Media Dashboard</h1>
          <p className="page-subtitle">Loading metrics from Meta...</p>
        </div>
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
          Fetching live data from Meta Graph API and Supabase...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell">
        <div className="page-header">
          <h1 className="page-title">Social Media Dashboard</h1>
          <p className="page-subtitle">Error loading data</p>
        </div>
        <div className="card" style={{ padding: 20, color: "var(--status-red)", fontSize: 13 }}>
          {error}
        </div>
      </main>
    );
  }

  const { current, growth, recentPosts, topPosts, errors } = data;

  return (
    <main className="page-shell">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Social Media Dashboard</h1>
          <p className="page-subtitle">
            Live metrics from Meta Graph API + historical data from Supabase
          </p>
        </div>
        <Link
          href="/comms/social"
          style={{
            fontSize: 12,
            padding: "6px 14px",
            background: "rgba(142, 68, 173, 0.15)",
            color: "#8e44ad",
            border: "1px solid rgba(142, 68, 173, 0.3)",
            borderRadius: "var(--radius-md)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Back to Social Hub
        </Link>
      </div>

      {/* API Errors Banner */}
      {errors && Object.values(errors).some(Boolean) && (
        <div style={{
          padding: "10px 14px",
          marginBottom: 16,
          background: "rgba(231, 76, 60, 0.08)",
          border: "1px solid rgba(231, 76, 60, 0.25)",
          borderRadius: "var(--radius-md)",
          fontSize: 12,
          color: "var(--status-red)",
        }}>
          Some data sources returned errors:{" "}
          {Object.entries(errors)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ")}
        </div>
      )}

      {/* Big Stat Cards */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard
          label="Instagram Followers"
          value={current.igFollowers != null ? current.igFollowers.toLocaleString() : "--"}
          change={growth.igNetChange30d}
          accent="#E1306C"
        />
        <StatCard
          label="Facebook Followers"
          value={current.fbFollowers != null ? current.fbFollowers.toLocaleString() : "--"}
          change={growth.fbNetChange30d}
          accent="#1877F2"
        />
        <StatCard
          label="Combined Total"
          value={current.combinedFollowers ? current.combinedFollowers.toLocaleString() : "--"}
          change={growth.combinedNetChange30d}
          accent="var(--status-gold)"
        />
        <StatCard
          label="30-Day Net Change"
          value={formatChange(growth.combinedNetChange30d)}
          note={`IG: ${formatChange(growth.igNetChange30d)} | FB: ${formatChange(growth.fbNetChange30d)}`}
          accent={growth.combinedNetChange30d >= 0 ? "var(--status-green)" : "var(--status-red)"}
        />
      </div>

      {/* IG Extra Stats */}
      {(current.igFollowing != null || current.igMediaCount != null) && (
        <div style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap",
        }}>
          {current.igFollowing != null && (
            <MiniPill label="IG Following" value={current.igFollowing.toLocaleString()} />
          )}
          {current.igMediaCount != null && (
            <MiniPill label="IG Posts" value={current.igMediaCount.toLocaleString()} />
          )}
        </div>
      )}

      {/* Follower Growth Chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Follower Growth (Last 30 Days)</span>
        </div>
        <GrowthChart timeline={growth.timeline} />
      </div>

      {/* Two-Column: Recent Posts + Top Posts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Recent Posts */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="card-header">
            <span className="card-title">Recent Posts</span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {recentPosts.length} posts
            </span>
          </div>
          <div style={{ maxHeight: 500, overflowY: "auto" }}>
            {recentPosts.length === 0 ? (
              <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 13 }}>
                No posts found in Supabase. Run a Meta sync first.
              </div>
            ) : (
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Platform</th>
                    <th style={thStyle}>Caption</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Likes</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Comments</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Shares</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPosts.map((post) => (
                    <PostRow key={post.id || post.platform_post_id} post={post} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top Performing Posts */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="card-header">
            <span className="card-title">Top Performing Posts</span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              By total engagement
            </span>
          </div>
          <div style={{ maxHeight: 500, overflowY: "auto" }}>
            {topPosts.length === 0 ? (
              <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 13 }}>
                No engagement data yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
                {topPosts.map((post, i) => (
                  <TopPostCard key={post.id || post.platform_post_id} post={post} rank={i + 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Responsive override for mobile */}
      <style>{`
        @media (max-width: 768px) {
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .stat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const thStyle = {
  textAlign: "left",
  padding: "8px 10px",
  color: "var(--text-dim)",
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

function StatCard({ label, value, change, note, accent }) {
  return (
    <div
      className="stat-block"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {change != null && !note && (
        <div
          className="stat-note"
          style={{
            color: change > 0 ? "var(--status-green)" : change < 0 ? "var(--status-red)" : "var(--text-dim)",
          }}
        >
          {change > 0 ? "+" : ""}
          {change} in 30 days
        </div>
      )}
      {note && (
        <div className="stat-note" style={{ color: "var(--text-dim)" }}>
          {note}
        </div>
      )}
    </div>
  );
}

function MiniPill({ label, value }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 12px",
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: "var(--radius-sm)",
      fontSize: 12,
      color: "var(--text-dim)",
    }}>
      <span style={{ fontWeight: 600, color: "var(--text-bright)" }}>{value}</span>
      {label}
    </span>
  );
}

/**
 * Simple CSS bar chart for daily follower growth.
 * No external chart library needed.
 */
function GrowthChart({ timeline }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div style={{ padding: 20, color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>
        No follower growth data available. The Meta Insights API may need a few days of data.
      </div>
    );
  }

  const maxAbs = Math.max(1, ...timeline.map((d) => Math.abs(d.total)));

  return (
    <div style={{ padding: "12px 16px" }}>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, color: "var(--text-dim)" }}>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "#E1306C", borderRadius: 2, marginRight: 4 }} />
          Instagram
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "#1877F2", borderRadius: 2, marginRight: 4 }} />
          Facebook
        </span>
      </div>

      {/* Chart bars */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 2,
        height: 160,
        borderBottom: "1px solid var(--card-border)",
        position: "relative",
      }}>
        {/* Zero line */}
        <div style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "50%",
          borderBottom: "1px dashed rgba(255,255,255,0.1)",
        }} />

        {timeline.map((day, i) => {
          const igPct = (day.ig / maxAbs) * 50;
          const fbPct = (day.fb / maxAbs) * 50;
          const totalPositive = day.total >= 0;

          return (
            <div
              key={day.date}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
                position: "relative",
              }}
              title={`${day.date}\nIG: ${day.ig >= 0 ? "+" : ""}${day.ig}\nFB: ${day.fb >= 0 ? "+" : ""}${day.fb}\nTotal: ${day.total >= 0 ? "+" : ""}${day.total}`}
            >
              {/* Stacked bar from center line */}
              <div style={{
                position: "absolute",
                bottom: "50%",
                width: "80%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}>
                {totalPositive ? (
                  <>
                    {day.fb > 0 && (
                      <div style={{
                        width: "100%",
                        height: Math.max(1, Math.abs(fbPct)),
                        background: "#1877F2",
                        borderRadius: "2px 2px 0 0",
                        marginBottom: 1,
                      }} />
                    )}
                    {day.ig > 0 && (
                      <div style={{
                        width: "100%",
                        height: Math.max(1, Math.abs(igPct)),
                        background: "#E1306C",
                        borderRadius: day.fb > 0 ? "0" : "2px 2px 0 0",
                      }} />
                    )}
                  </>
                ) : null}
              </div>
              {!totalPositive && (
                <div style={{
                  position: "absolute",
                  top: "50%",
                  width: "80%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}>
                  {day.ig < 0 && (
                    <div style={{
                      width: "100%",
                      height: Math.max(1, Math.abs(igPct)),
                      background: "#E1306C",
                      opacity: 0.6,
                      borderRadius: "0 0 2px 2px",
                    }} />
                  )}
                  {day.fb < 0 && (
                    <div style={{
                      width: "100%",
                      height: Math.max(1, Math.abs(fbPct)),
                      background: "#1877F2",
                      opacity: 0.6,
                      borderRadius: "0 0 2px 2px",
                      marginTop: 1,
                    }} />
                  )}
                </div>
              )}

              {/* Date label (show every 5th) */}
              {i % 5 === 0 && (
                <div style={{
                  position: "absolute",
                  bottom: -18,
                  fontSize: 9,
                  color: "var(--text-dim)",
                  whiteSpace: "nowrap",
                }}>
                  {formatShortDate(day.date)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom margin for date labels */}
      <div style={{ height: 24 }} />

      {/* Summary row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 12,
        color: "var(--text-dim)",
        paddingTop: 8,
        borderTop: "1px solid var(--card-border)",
      }}>
        <span>
          IG 30d:{" "}
          <span style={{ color: timeline.reduce((s, d) => s + d.ig, 0) >= 0 ? "var(--status-green)" : "var(--status-red)", fontWeight: 600 }}>
            {formatChange(timeline.reduce((s, d) => s + d.ig, 0))}
          </span>
        </span>
        <span>
          FB 30d:{" "}
          <span style={{ color: timeline.reduce((s, d) => s + d.fb, 0) >= 0 ? "var(--status-green)" : "var(--status-red)", fontWeight: 600 }}>
            {formatChange(timeline.reduce((s, d) => s + d.fb, 0))}
          </span>
        </span>
        <span>
          Combined:{" "}
          <span style={{ color: timeline.reduce((s, d) => s + d.total, 0) >= 0 ? "var(--status-green)" : "var(--status-red)", fontWeight: 600 }}>
            {formatChange(timeline.reduce((s, d) => s + d.total, 0))}
          </span>
        </span>
      </div>
    </div>
  );
}

function PostRow({ post }) {
  const date = post.posted_at
    ? new Date(post.posted_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/New_York",
      })
    : "--";

  const platformColor = post.platform === "instagram" ? "#E1306C" : "#1877F2";
  const caption = post.caption || "(No caption)";

  return (
    <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
      <td style={{ padding: "8px 10px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
        {date}
      </td>
      <td style={{ padding: "8px 10px" }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          color: platformColor,
          background: `${platformColor}15`,
          padding: "2px 6px",
          borderRadius: "var(--radius-sm)",
        }}>
          {post.platform === "instagram" ? "IG" : "FB"}
        </span>
      </td>
      <td style={{
        padding: "8px 10px",
        color: "var(--text-secondary, var(--text-dim))",
        maxWidth: 220,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {post.permalink ? (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "none" }}
            title={caption}
          >
            {caption.slice(0, 60)}{caption.length > 60 ? "..." : ""}
          </a>
        ) : (
          <span title={caption}>{caption.slice(0, 60)}{caption.length > 60 ? "..." : ""}</span>
        )}
      </td>
      <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--text-dim)" }}>
        {post.likes || 0}
      </td>
      <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--text-dim)" }}>
        {post.comments || 0}
      </td>
      <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--text-dim)" }}>
        {post.shares || 0}
      </td>
    </tr>
  );
}

function TopPostCard({ post, rank }) {
  const totalEngagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0);
  const platformColor = post.platform === "instagram" ? "#E1306C" : "#1877F2";
  const caption = post.caption || "(No caption)";
  const date = post.posted_at
    ? new Date(post.posted_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      })
    : "";

  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg)",
      border: "1px solid var(--card-border)",
      borderRadius: "var(--radius-md)",
      borderLeft: `3px solid ${platformColor}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-dim)",
            background: "rgba(255,255,255,0.05)",
            borderRadius: "50%",
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {rank}
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            color: platformColor,
          }}>
            {post.platform === "instagram" ? "IG" : "FB"}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{date}</span>
        </div>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--status-green)",
        }}>
          {totalEngagement} engagements
        </span>
      </div>
      <div style={{
        fontSize: 12,
        color: "var(--text-secondary, var(--text-dim))",
        marginBottom: 6,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
      }}>
        {caption}
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-dim)" }}>
        <span>Likes: {post.likes || 0}</span>
        <span>Comments: {post.comments || 0}</span>
        <span>Shares: {post.shares || 0}</span>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: platformColor, textDecoration: "none", marginLeft: "auto" }}
          >
            View
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatChange(val) {
  if (val == null) return "--";
  return val >= 0 ? `+${val}` : `${val}`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
