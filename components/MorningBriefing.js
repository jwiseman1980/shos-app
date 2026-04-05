"use client";

import { useState, useEffect, useMemo } from "react";
import Accomplishments from "@/components/Accomplishments";

const CATEGORY_COLORS = {
  "FINANCIAL-CPA": "#2ecc71",
  "FINANCIAL-BOOKKEEPER": "#27ae60",
  FINANCIAL: "#2ecc71",
  PROPERTY: "#e67e22",
  "BRACELET-REQUEST": "#c4a237",
  FAMILY: "#e91e63",
  DONOR: "#3498db",
  SHIPPING: "#9b59b6",
  "INSURANCE-MORTGAGE": "#e74c3c",
  UTILITY: "#95a5a6",
  "VA-VET": "#1abc9c",
  "PARTNER-ORG": "#8e44ad",
  PERSONAL: "#3498db",
  NEWSLETTER: "#95a5a6",
  OTHER: "var(--text-dim)",
};

const PRIORITY_CATEGORIES = [
  "FAMILY",
  "BRACELET-REQUEST",
  "FINANCIAL-CPA",
  "FINANCIAL-BOOKKEEPER",
  "PROPERTY",
  "DONOR",
  "PARTNER-ORG",
  "VA-VET",
];

function SectionHeader({ title, accent }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: accent || "var(--text-dim)",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 8,
        paddingBottom: 4,
        borderBottom: `1px solid ${accent || "var(--border)"}`,
      }}
    >
      {title}
    </div>
  );
}

export default function MorningBriefing({
  tasks = [],
  emails = [],
  calendarEvents = [],
  greeting,
  onViewChange,
  onTaskClick,
}) {
  const [anniversaryData, setAnniversaryData] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [accomplishments, setAccomplishments] = useState([]);

  // Fetch anniversary + order + accomplishment data on mount
  useEffect(() => {
    const month = new Date().getMonth() + 1;
    fetch(`/api/anniversaries?month=${month}`)
      .then((r) => r.json())
      .then((d) => setAnniversaryData(d))
      .catch(() => {});

    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => setOrderData(d))
      .catch(() => {});

    fetch("/api/execution-log")
      .then((r) => r.json())
      .then((d) => setAccomplishments(d.items || []))
      .catch(() => {});
  }, []);

  // Urgent items: critical + overdue
  const urgentItems = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    return tasks.filter(
      (t) =>
        t.status !== "done" &&
        (t.priority === "critical" ||
          (t.dueDate && t.dueDate < todayStr && t.status !== "done"))
    );
  }, [tasks]);

  // Email categories
  const emailsByCategory = useMemo(() => {
    const cats = {};
    for (const e of emails) {
      const cat = e.category || "OTHER";
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(e);
    }
    return cats;
  }, [emails]);

  const flaggedEmails = useMemo(() => {
    return emails
      .filter((e) => e.isUnread && PRIORITY_CATEGORIES.includes(e.category))
      .slice(0, 5);
  }, [emails]);

  // Calendar summary
  const timedEvents = useMemo(() => {
    return (calendarEvents || []).filter(
      (e) => !e.allDay && e.start && e.start.includes("T")
    );
  }, [calendarEvents]);

  const personalEvents = useMemo(() => {
    return (calendarEvents || []).filter((e) => e.role === "primary");
  }, [calendarEvents]);

  // Top 3 priority tasks
  const topTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== "done").slice(0, 3);
  }, [tasks]);

  const unreadCount = emails.filter((e) => e.isUnread).length;

  return (
    <div style={{ padding: 20, height: "100%", overflowY: "auto" }}>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            color: "var(--text-bright)",
            fontSize: 20,
            fontWeight: 600,
            margin: 0,
          }}
        >
          {greeting || "Good morning"}
        </h2>
        <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 2 }}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "America/New_York",
          })}
        </div>
      </div>

      {/* Section 1: Urgent */}
      {urgentItems.length > 0 && (
        <div
          style={{
            background: "rgba(231, 76, 60, 0.1)",
            border: "1px solid rgba(231, 76, 60, 0.3)",
            borderRadius: 8,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <SectionHeader
            title={`Urgent (${urgentItems.length})`}
            accent="var(--status-red)"
          />
          {urgentItems.slice(0, 5).map((t, i) => (
            <div
              key={t.id || i}
              onClick={() => onTaskClick?.(t.id)}
              style={{
                fontSize: 13,
                color: "var(--text-bright)",
                padding: "4px 0",
                cursor: "pointer",
              }}
            >
              <span style={{ color: "var(--status-red)", marginRight: 6 }}>
                {t.priority === "critical" ? "!!" : "!"}
              </span>
              {t.title || t.summary}
              {t.dueDate && (
                <span
                  style={{ color: "var(--text-dim)", fontSize: 11, marginLeft: 8 }}
                >
                  due {t.dueDate}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Two-column grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Section 2: Today's Calendar */}
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <SectionHeader title="Today's Calendar" />
            <div
              style={{
                fontSize: 14,
                color: "var(--text-bright)",
                fontWeight: 500,
              }}
            >
              {timedEvents.length} events
              {personalEvents.length > 0 && (
                <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>
                  {" "}
                  ({personalEvents.length} personal)
                </span>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              {timedEvents.slice(0, 4).map((ev, i) => (
                <div
                  key={ev.id || i}
                  style={{
                    fontSize: 12,
                    color: "var(--text-dim)",
                    padding: "2px 0",
                  }}
                >
                  <span style={{ color: "var(--text-bright)" }}>
                    {new Date(ev.start).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: "America/New_York",
                    })}
                  </span>{" "}
                  {ev.summary}
                </div>
              ))}
              {timedEvents.length > 4 && (
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                  +{timedEvents.length - 4} more
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Email Triage */}
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <SectionHeader title={`Email (${unreadCount} unread)`} />
            {/* Category badges */}
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}
            >
              {Object.entries(emailsByCategory)
                .filter(([cat]) => cat !== "OTHER" && cat !== "NEWSLETTER")
                .sort((a, b) => b[1].length - a[1].length)
                .slice(0, 6)
                .map(([cat, msgs]) => (
                  <span
                    key={cat}
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: `${CATEGORY_COLORS[cat] || "var(--text-dim)"}22`,
                      color: CATEGORY_COLORS[cat] || "var(--text-dim)",
                      border: `1px solid ${CATEGORY_COLORS[cat] || "var(--text-dim)"}44`,
                    }}
                  >
                    {cat} ({msgs.length})
                  </span>
                ))}
            </div>
            {/* Flagged emails */}
            {flaggedEmails.length > 0 && (
              <div>
                {flaggedEmails.map((e, i) => (
                  <div
                    key={e.id || i}
                    style={{ fontSize: 12, color: "var(--text-dim)", padding: "3px 0" }}
                  >
                    <span style={{ color: "var(--text-bright)" }}>{e.fromName}</span>
                    {" — "}
                    {e.subject}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => onViewChange?.("email-triage")}
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "var(--gold)",
                background: "none",
                border: "1px solid var(--gold)",
                borderRadius: 4,
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              Open Email Triage
            </button>
          </div>

          {/* Section 6: GYST / Personal */}
          {personalEvents.length > 0 && (
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: 8,
                padding: 14,
              }}
            >
              <SectionHeader title="Personal / GYST" accent="#3498db" />
              {personalEvents.slice(0, 4).map((ev, i) => (
                <div
                  key={ev.id || i}
                  style={{ fontSize: 12, color: "var(--text-dim)", padding: "2px 0" }}
                >
                  <span style={{ color: "var(--text-bright)" }}>
                    {ev.allDay
                      ? "All day"
                      : new Date(ev.start).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                          timeZone: "America/New_York",
                        })}
                  </span>{" "}
                  {ev.summary}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Section 4: Anniversary Status */}
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <SectionHeader title="Anniversaries" accent="#e91e63" />
            {anniversaryData ? (
              <>
                <div style={{ fontSize: 13, color: "var(--text-bright)" }}>
                  {anniversaryData.count || 0} heroes this month
                </div>
                {anniversaryData.data && (
                  <div style={{ marginTop: 6 }}>
                    {(() => {
                      const sent = anniversaryData.data.filter(
                        (h) => h.anniversaryStatus === "sent"
                      ).length;
                      const total = anniversaryData.count || 0;
                      const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
                      return (
                        <>
                          <div
                            style={{
                              height: 6,
                              borderRadius: 3,
                              background: "rgba(255,255,255,0.1)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background:
                                  pct === 100
                                    ? "var(--status-green)"
                                    : "var(--gold)",
                                borderRadius: 3,
                                transition: "width 0.3s",
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-dim)",
                              marginTop: 4,
                            }}
                          >
                            {sent} of {total} sent ({pct}%)
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Loading...</div>
            )}
          </div>

          {/* Section 5: Order Queue */}
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <SectionHeader title="Order Queue" accent="var(--gold)" />
            {orderData?.stats ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {[
                  ["Design", orderData.stats.designNeeded],
                  ["Laser", orderData.stats.readyToLaser],
                  ["Production", orderData.stats.inProduction],
                  ["Ship", orderData.stats.readyToShip],
                ].map(([label, count]) => (
                  <div
                    key={label}
                    style={{
                      textAlign: "center",
                      padding: "6px 0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color:
                          count > 0 ? "var(--gold)" : "var(--text-dim)",
                      }}
                    >
                      {count || 0}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-dim)",
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Loading...</div>
            )}
          </div>

          {/* Section 7: AI Top 3 Recommendations */}
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--gold)",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <SectionHeader title="Today's Priorities" accent="var(--gold)" />
            {topTasks.map((t, i) => (
              <div
                key={t.id || i}
                onClick={() => onTaskClick?.(t.id)}
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "6px 0",
                  cursor: "pointer",
                  borderBottom:
                    i < topTasks.length - 1
                      ? "1px solid rgba(255,255,255,0.04)"
                      : "none",
                }}
              >
                <span
                  style={{
                    color: "var(--gold)",
                    fontWeight: 700,
                    fontSize: 14,
                    minWidth: 20,
                  }}
                >
                  {i + 1}.
                </span>
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-bright)",
                    }}
                  >
                    {t.title || t.summary}
                  </div>
                  {t.reason && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                        marginTop: 2,
                      }}
                    >
                      {t.reason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Section 8: Today's Accomplishments */}
          <div
            style={{
              background: "var(--card-bg)",
              border: accomplishments.length > 0 ? "1px solid var(--status-green)" : "1px solid var(--card-border)",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <SectionHeader title={`Completed Today (${accomplishments.length})`} accent="var(--status-green)" />
            <Accomplishments items={accomplishments} />
          </div>
        </div>
      </div>
    </div>
  );
}
