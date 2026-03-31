"use client";

import { useState } from "react";
import DataCard from "@/components/DataCard";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export default function ChatHistoryList({ sessions, selectedSession, selectedMessages }) {
  const [viewId, setViewId] = useState(selectedSession?.id || null);
  const [messages, setMessages] = useState(selectedMessages || []);
  const [loadingId, setLoadingId] = useState(null);

  async function loadSession(id) {
    if (id === viewId) {
      setViewId(null);
      setMessages([]);
      return;
    }
    setLoadingId(id);
    try {
      const res = await fetch(`/api/chat/history?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setViewId(id);
      }
    } catch {}
    setLoadingId(null);
  }

  if (!sessions.length) {
    return (
      <DataCard title="No Sessions Yet">
        <p style={{ fontSize: 13, color: "var(--text-dim)", padding: 16 }}>
          Operator chat sessions will appear here once conversations are saved.
        </p>
      </DataCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sessions.map((s) => (
        <div key={s.id}>
          <div
            onClick={() => loadSession(s.id)}
            style={{
              padding: "12px 16px",
              background: viewId === s.id ? "var(--bg-2)" : "var(--bg-card)",
              border: `1px solid ${viewId === s.id ? "var(--gold)" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)" }}>
                  {s.user_name || "Unknown"}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: 8 }}>
                  on {s.page_context || "/"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  {s.message_count || 0} messages
                </span>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  {timeAgo(s.started_at)}
                </span>
              </div>
            </div>
            {s.summary && (
              <p style={{ fontSize: 12, color: "var(--text)", margin: "6px 0 0", lineHeight: 1.5 }}>
                {s.summary}
              </p>
            )}
            {s.tools_used?.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {s.tools_used.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      color: "var(--text-dim)",
                    }}
                  >
                    {t.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Expanded message thread */}
          {viewId === s.id && (
            <div
              style={{
                margin: "4px 0 8px 16px",
                padding: 16,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                maxHeight: 500,
                overflowY: "auto",
              }}
            >
              {loadingId === s.id ? (
                <p style={{ fontSize: 12, color: "var(--text-dim)" }}>Loading...</p>
              ) : messages.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-dim)" }}>No messages recorded.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {messages.filter((m) => !m.is_auto).map((m) => (
                    <div key={m.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: m.role === "assistant" ? "#c4a237" : "var(--text-bright)",
                          }}
                        >
                          {m.role === "assistant" ? "Operator" : m.role === "user" ? s.user_name || "User" : "System"}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                          {formatDate(m.created_at)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text)",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          paddingLeft: 8,
                          borderLeft: `2px solid ${m.role === "assistant" ? "#c4a237" : "var(--border)"}`,
                        }}
                      >
                        {m.content}
                      </div>
                      {m.tool_calls && (
                        <div style={{ marginTop: 4, paddingLeft: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {(Array.isArray(m.tool_calls) ? m.tool_calls : []).map((t, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: 10,
                                padding: "1px 6px",
                                background: "var(--bg-2)",
                                borderRadius: 999,
                                color: "#c4a237",
                              }}
                            >
                              {typeof t === "string" ? t.replace(/_/g, " ") : "tool"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
