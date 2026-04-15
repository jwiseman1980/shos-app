"use client";

import { useState, useEffect, useMemo } from "react";
import Accomplishments from "@/components/Accomplishments";

// ---------------------------------------------------------------------------
// Urgent email categories — surface these in the URGENT strip
// ---------------------------------------------------------------------------
const URGENT_EMAIL_CATEGORIES = ["FAMILY", "BRACELET-REQUEST", "FINANCIAL-CPA", "FINANCIAL-BOOKKEEPER"];

// Basic client-side email classifier based on subject/from patterns.
// Category is NOT stored by the Gmail API — we infer it from content.
function classifyEmail(email) {
  const subject = (email.subject || "").toLowerCase();
  const from = (email.from || "").toLowerCase();
  const snippet = (email.snippet || "").toLowerCase();
  const combined = `${subject} ${from} ${snippet}`;

  if (/bracelet\s*request|request.*bracelet|honor.*bracelet|memorial.*bracelet/i.test(combined)) return "BRACELET-REQUEST";
  if (/gold\s*star|fallen\s*hero|fallen\s*warrior|family.*memorial|bereaved/i.test(combined)) return "FAMILY";
  if (/cpa|accountant|tax\s*return|form\s*990|irs|990\s*prep|bookkeep/i.test(combined)) return "FINANCIAL-CPA";
  if (/bank\s*statement|chase|stripe|donation\s*receipt|financial\s*statement/i.test(combined)) return "FINANCIAL-BOOKKEEPER";
  if (/insurance|mortgage|property\s*tax|hoa|utility|electric|water\s*bill/i.test(combined)) return "PROPERTY";
  if (/shipstation|shipped|tracking|usps|fedex|ups/i.test(combined)) return "SHIPPING";
  if (/donor|donation|contribute|giving/i.test(combined)) return "DONOR";
  if (/partner|organization|foundation|non\s*profit|nonprofit/i.test(combined)) return "PARTNER-ORG";
  if (/newsletter|unsubscribe|list-unsubscribe/i.test(combined)) return "NEWSLETTER";
  return "OTHER";
}

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

function RelativeTime({ iso }) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  let label;
  if (mins < 2) label = "just now";
  else if (mins < 60) label = `${mins}m ago`;
  else if (hours < 24) label = `${hours}h ago`;
  else label = `${days}d ago`;
  return <span style={{ color: "var(--text-dim)", fontSize: 10, marginLeft: 6 }}>{label}</span>;
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
  const [recentActivity, setRecentActivity] = useState(null);
  const [accomplishments, setAccomplishments] = useState([]);

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

    fetch("/api/recent-activity")
      .then((r) => r.json())
      .then((d) => setRecentActivity(d))
      .catch(() => {});

    fetch("/api/execution-log")
      .then((r) => r.json())
      .then((d) => setAccomplishments(d.items || []))
      .catch(() => {});
  }, []);

  // ---------------------------------------------------------------------------
  // Classify emails (category isn't stored by Gmail — derive from content)
  // ---------------------------------------------------------------------------
  const classifiedEmails = useMemo(() => {
    return emails.map((e) => ({ ...e, category: e.category || classifyEmail(e) }));
  }, [emails]);

  const unreadCount = classifiedEmails.filter((e) => e.isUnread).length;

  // ---------------------------------------------------------------------------
  // URGENT — derived from operational data sources, not the task queue
  // ---------------------------------------------------------------------------
  const urgentItems = useMemo(() => {
    const items = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // 1. Overdue orders — active items where the order is >14 days old
    if (orderData?.items?.length) {
      const cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() - 14);
      const cutoffStr = cutoffDate.toISOString().split("T")[0];

      const overdueOrders = (orderData.items || [])
        .filter(
          (item) =>
            item.orderDate &&
            item.orderDate < cutoffStr &&
            item.productionStatus !== "shipped" &&
            item.productionStatus !== "ready_to_ship"
        )
        .sort((a, b) => (a.orderDate || "").localeCompare(b.orderDate || ""))
        .slice(0, 4);

      for (const item of overdueOrders) {
        const daysSince = Math.floor((today - new Date(item.orderDate + "T12:00:00")) / 86400000);
        const statusLabel = (item.productionStatus || "").replace(/_/g, " ");
        items.push({
          id: `order-overdue-${item.id}`,
          urgencyType: "order",
          title: `Overdue — ${item.heroName || item.sku || "Order"} (${item.orderNumber || "no #"})`,
          detail: `${daysSince}d since order · ${statusLabel}`,
          priority: daysSince > 30 ? "critical" : "high",
          link: "/orders",
        });
      }
    }

    // 2. Anniversary emails due within 7 days
    if (anniversaryData?.data?.length) {
      const year = today.getFullYear();
      const upcoming = [];

      for (const hero of anniversaryData.data) {
        const status = (hero.anniversaryStatus || "").toLowerCase().replace(/\s+/g, "_");
        if (["email_sent", "sent", "complete", "completed", "skipped", "scheduled"].includes(status)) continue;

        if (hero.anniversaryMonth && hero.anniversaryDay) {
          let annDate = new Date(year, hero.anniversaryMonth - 1, hero.anniversaryDay, 12, 0, 0);
          if (annDate < today) annDate = new Date(year + 1, hero.anniversaryMonth - 1, hero.anniversaryDay, 12, 0, 0);

          const daysUntil = Math.floor((annDate - today) / 86400000);
          if (daysUntil >= 0 && daysUntil <= 7) {
            const displayName =
              [hero.rank, hero.firstName, hero.lastName].filter(Boolean).join(" ").trim() ||
              hero.name ||
              "Hero";
            upcoming.push({ hero, displayName, daysUntil });
          }
        }
      }

      upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

      for (const { hero, displayName, daysUntil } of upcoming.slice(0, 3)) {
        const detailLabel = daysUntil === 0 ? "TODAY" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;
        items.push({
          id: `ann-due-${hero.id || hero.sfId}`,
          urgencyType: "anniversary",
          title: `Anniversary email — ${displayName}`,
          detail: detailLabel,
          priority: daysUntil === 0 ? "critical" : daysUntil <= 2 ? "high" : "medium",
          link: "/anniversaries",
        });
      }
    }

    // 3. Priority unread emails (family, financial, compliance)
    const urgentEmails = classifiedEmails
      .filter((e) => e.isUnread && URGENT_EMAIL_CATEGORIES.includes(e.category))
      .slice(0, 3);

    for (const email of urgentEmails) {
      items.push({
        id: `email-urgent-${email.id}`,
        urgencyType: "email",
        title: email.subject || "(no subject)",
        detail: email.fromName || (email.from || "").replace(/<.*>/, "").trim() || "",
        category: email.category,
        priority: "high",
        link: null,
      });
    }

    // Sort: critical first, then by type (order → anniversary → email)
    const typeOrder = { order: 0, anniversary: 1, email: 2 };
    const priorityOrder = { critical: 0, high: 1, medium: 2 };
    items.sort((a, b) => {
      if (a.priority !== b.priority) return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      return (typeOrder[a.urgencyType] || 3) - (typeOrder[b.urgencyType] || 3);
    });

    return items;
  }, [orderData, anniversaryData, classifiedEmails]);

  // ---------------------------------------------------------------------------
  // Calendar
  // ---------------------------------------------------------------------------
  const timedEvents = useMemo(
    () => (calendarEvents || []).filter((e) => !e.allDay && e.start && e.start.includes("T")),
    [calendarEvents]
  );

  const personalEvents = useMemo(
    () => (calendarEvents || []).filter((e) => e.role === "primary"),
    [calendarEvents]
  );

  // ---------------------------------------------------------------------------
  // Top 3 priority tasks (used in Today's Priorities section)
  // ---------------------------------------------------------------------------
  const topTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done").slice(0, 3),
    [tasks]
  );

  // ---------------------------------------------------------------------------
  // Order Queue — 5 buckets
  // ---------------------------------------------------------------------------
  const orderBuckets = useMemo(() => {
    const s = orderData?.stats;
    if (!s) return null;
    return [
      { label: "Pending", count: s.notStarted || 0, tip: "Awaiting triage" },
      { label: "Design", count: s.designNeeded || 0, tip: "Needs Ryan" },
      { label: "Laser", count: s.readyToLaser || 0, tip: "Ready to engrave" },
      { label: "Prod", count: s.inProduction || 0, tip: "Being made" },
      { label: "Ship", count: s.readyToShip || 0, tip: "Ready to ship" },
    ];
  }, [orderData]);

  // ---------------------------------------------------------------------------
  // Email categories (for badge strip below header)
  // ---------------------------------------------------------------------------
  const emailCategoryMap = useMemo(() => {
    const cats = {};
    for (const e of classifiedEmails) {
      if (!e.isUnread) continue;
      const cat = e.category || "OTHER";
      if (cat === "OTHER" || cat === "NEWSLETTER" || cat === "SHIPPING") continue;
      cats[cat] = (cats[cat] || 0) + 1;
    }
    return cats;
  }, [classifiedEmails]);

  const CATEGORY_COLORS = {
    "FINANCIAL-CPA": "#2ecc71",
    "FINANCIAL-BOOKKEEPER": "#27ae60",
    FINANCIAL: "#2ecc71",
    PROPERTY: "#e67e22",
    "BRACELET-REQUEST": "#c4a237",
    FAMILY: "#e91e63",
    DONOR: "#3498db",
    "PARTNER-ORG": "#8e44ad",
  };

  return (
    <div style={{ padding: 20, height: "100%", overflowY: "auto" }}>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: "var(--text-bright)", fontSize: 20, fontWeight: 600, margin: 0 }}>
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

      {/* URGENT — operational urgencies only */}
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
          <SectionHeader title={`Urgent (${urgentItems.length})`} accent="var(--status-red)" />
          {urgentItems.slice(0, 6).map((item) => (
            <div
              key={item.id}
              onClick={() => item.link && (window.location.href = item.link)}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 6,
                fontSize: 13,
                color: "var(--text-bright)",
                padding: "4px 0",
                cursor: item.link ? "pointer" : "default",
              }}
            >
              <span style={{ color: item.priority === "critical" ? "var(--status-red)" : "#e67e22", flexShrink: 0 }}>
                {item.priority === "critical" ? "!!" : "!"}
              </span>
              <span style={{ flex: 1 }}>{item.title}</span>
              {item.detail && (
                <span style={{ color: "var(--text-dim)", fontSize: 11, flexShrink: 0 }}>{item.detail}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Two-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Today's Calendar */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, padding: 14 }}>
            <SectionHeader title="Today's Calendar" />
            <div style={{ fontSize: 14, color: "var(--text-bright)", fontWeight: 500 }}>
              {timedEvents.length} events
              {personalEvents.length > 0 && (
                <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>
                  {" "}({personalEvents.length} personal)
                </span>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              {timedEvents.slice(0, 4).map((ev, i) => (
                <div key={ev.id || i} style={{ fontSize: 12, color: "var(--text-dim)", padding: "2px 0" }}>
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

          {/* Email */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, padding: 14 }}>
            <SectionHeader title={`Email (${unreadCount} unread)`} />
            {/* Category badges for unread, non-noise emails */}
            {Object.keys(emailCategoryMap).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {Object.entries(emailCategoryMap)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([cat, count]) => (
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
                      {cat} ({count})
                    </span>
                  ))}
              </div>
            )}
            <button
              onClick={() => onViewChange?.("email-triage")}
              style={{
                marginTop: 4,
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

          {/* GYST / Personal */}
          {personalEvents.length > 0 && (
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, padding: 14 }}>
              <SectionHeader title="Personal / GYST" accent="#3498db" />
              {personalEvents.slice(0, 4).map((ev, i) => (
                <div key={ev.id || i} style={{ fontSize: 12, color: "var(--text-dim)", padding: "2px 0" }}>
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

          {/* Recent Activity */}
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <SectionHeader title="Recent Activity" accent="var(--text-dim)" />
            {recentActivity === null ? (
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Loading...</div>
            ) : !recentActivity.success || !recentActivity.events?.length ? (
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>No recent activity</div>
            ) : (
              <div>
                {recentActivity.events.slice(0, 8).map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 6,
                      fontSize: 12,
                      padding: "3px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                    }}
                  >
                    <span style={{ color: "var(--text-dim)", fontSize: 11, flexShrink: 0 }}>{evt.icon}</span>
                    <span style={{ flex: 1, color: "var(--text-bright)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {evt.label}
                    </span>
                    <RelativeTime iso={evt.timestamp} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Anniversary Status */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, padding: 14 }}>
            <SectionHeader title="Anniversaries" accent="#e91e63" />
            {anniversaryData ? (
              <>
                <div style={{ fontSize: 13, color: "var(--text-bright)" }}>
                  {anniversaryData.count || 0} heroes this month
                </div>
                {anniversaryData.data && anniversaryData.count > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {(() => {
                      const sent = anniversaryData.data.filter(
                        (h) => ["sent", "email_sent", "complete", "completed"].includes(
                          (h.anniversaryStatus || "").toLowerCase().replace(/\s+/g, "_")
                        )
                      ).length;
                      const total = anniversaryData.count || 0;
                      const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
                      return (
                        <>
                          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background: pct === 100 ? "var(--status-green)" : "var(--gold)",
                                borderRadius: 3,
                                transition: "width 0.3s",
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                            {sent} of {total} sent ({pct}%)
                          </div>
                        </>
                      );
                    })()}
                    {/* List upcoming anniversaries */}
                    <div style={{ marginTop: 8 }}>
                      {anniversaryData.data
                        .filter((h) => {
                          const s = (h.anniversaryStatus || "").toLowerCase().replace(/\s+/g, "_");
                          return !["sent", "email_sent", "complete", "completed", "skipped"].includes(s);
                        })
                        .slice(0, 4)
                        .map((h, i) => {
                          const name =
                            [h.rank, h.firstName, h.lastName].filter(Boolean).join(" ").trim() ||
                            h.name ||
                            "Hero";
                          const dateStr = h.memorialDate
                            ? new Date(h.memorialDate + "T12:00:00").toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : "";
                          return (
                            <div key={h.id || i} style={{ fontSize: 12, color: "var(--text-dim)", padding: "2px 0" }}>
                              <span style={{ color: "var(--text-bright)" }}>{name}</span>
                              {dateStr && <span style={{ marginLeft: 6 }}>{dateStr}</span>}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Loading...</div>
            )}
          </div>

          {/* Order Queue — 5 buckets */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, padding: 14 }}>
            <SectionHeader title="Order Queue" accent="var(--gold)" />
            {orderBuckets ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                  {orderBuckets.map(({ label, count, tip }) => (
                    <div
                      key={label}
                      title={tip}
                      style={{ textAlign: "center", padding: "4px 0" }}
                    >
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: count > 0 ? "var(--gold)" : "var(--text-dim)",
                        }}
                      >
                        {count}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
                {orderData?.stats?.totalActive > 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, textAlign: "right" }}>
                    {orderData.stats.totalActive} active · {orderData.stats.shipped || 0} shipped all-time
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Loading...</div>
            )}
          </div>

          {/* Today's Priorities */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--gold)", borderRadius: 8, padding: 14 }}>
            <SectionHeader title="Today's Priorities" accent="var(--gold)" />
            {topTasks.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Queue is clear</div>
            ) : (
              topTasks.map((t, i) => (
                <div
                  key={t.id || i}
                  onClick={() => onTaskClick?.(t.id)}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "6px 0",
                    cursor: "pointer",
                    borderBottom: i < topTasks.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}
                >
                  <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 14, minWidth: 20 }}>
                    {i + 1}.
                  </span>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text-bright)" }}>{t.title || t.summary}</div>
                    {t.reason && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{t.reason}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Completed Today */}
          <div
            style={{
              background: "var(--card-bg)",
              border: accomplishments.length > 0 ? "1px solid var(--status-green)" : "1px solid var(--card-border)",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <SectionHeader
              title={`Completed Today (${accomplishments.length})`}
              accent="var(--status-green)"
            />
            <Accomplishments items={accomplishments} />
          </div>
        </div>
      </div>
    </div>
  );
}
