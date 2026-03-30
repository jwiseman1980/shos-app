"use client";

import { useState, useEffect } from "react";

export default function SocialDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("instagram");

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d);
        else setError(d.error);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 13 }}>
        Loading social data from Meta...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 13 }}>
        Meta API unavailable: {error}
      </div>
    );
  }

  const ig = data?.instagram;
  const fbPosts = data?.recentFacebook || [];
  const igPosts = data?.recentInstagram || [];

  return (
    <div>
      {/* Instagram Profile Stats */}
      {ig && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}>
          <MiniStat label="Followers" value={ig.followers?.toLocaleString()} />
          <MiniStat label="Following" value={ig.following?.toLocaleString()} />
          <MiniStat label="Posts" value={ig.posts?.toLocaleString()} />
          <MiniStat label="Handle" value={`@${ig.username}`} />
        </div>
      )}

      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <TabButton
          active={activeTab === "instagram"}
          onClick={() => setActiveTab("instagram")}
          label={`Instagram (${igPosts.length})`}
          color="#E1306C"
        />
        <TabButton
          active={activeTab === "facebook"}
          onClick={() => setActiveTab("facebook")}
          label={`Facebook (${fbPosts.length})`}
          color="#1877F2"
        />
      </div>

      {/* Post list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(activeTab === "instagram" ? igPosts : fbPosts).map((post) => (
          <PostCard key={post.id} post={post} platform={activeTab} />
        ))}
        {(activeTab === "instagram" ? igPosts : fbPosts).length === 0 && (
          <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 13 }}>
            No recent posts found.
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg)",
      border: "1px solid var(--card-border)",
      borderRadius: "var(--radius-sm)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-bright)" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, label, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 600,
        border: active ? `1px solid ${color}` : "1px solid var(--card-border)",
        background: active ? `${color}18` : "transparent",
        color: active ? color : "var(--text-dim)",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function PostCard({ post, platform }) {
  const date = new Date(post.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });

  return (
    <div style={{
      padding: "12px 14px",
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: "var(--radius-md)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {date} · {post.mediaType}
        </span>
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: platform === "instagram" ? "#E1306C" : "#1877F2", textDecoration: "none" }}
        >
          View ↗
        </a>
      </div>
      <div style={{
        fontSize: 13,
        color: "var(--text-secondary)",
        marginBottom: 8,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
      }}>
        {post.caption || post.message || "(No caption)"}
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-dim)" }}>
        <span>♥ {post.likes}</span>
        <span>💬 {post.comments}</span>
        {post.shares != null && <span>↗ {post.shares}</span>}
      </div>
    </div>
  );
}
