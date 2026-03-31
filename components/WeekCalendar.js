"use client";

const ROLE_COLORS = {
  primary: "#3498db", ops: "#e74c3c", cto: "#8e44ad", ed: "#c4a237",
  cos: "#27ae60", cfo: "#2ecc71", coo: "#e67e22", comms: "#1abc9c",
  dev: "#9b59b6", family: "#e91e63",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WeekCalendar({ events = [], weekStart }) {
  // Build 7 day columns
  const days = [];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const dayName = DAY_NAMES[d.getDay()];
    const dayNum = d.getDate();
    const monthNum = d.getMonth() + 1;
    const isToday = dateStr === today;

    // Filter events for this day
    const dayEvents = events.filter(e => {
      const eDate = e.allDay
        ? e.start
        : new Date(e.start).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      return eDate === dateStr;
    });

    const allDay = dayEvents.filter(e => e.allDay);
    const timed = dayEvents.filter(e => !e.allDay).sort((a, b) => new Date(a.start) - new Date(b.start));

    days.push({ dateStr, dayName, dayNum, monthNum, isToday, allDay, timed });
  }

  return (
    <div className="data-card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 1,
        background: "var(--card-border)",
        flex: 1,
        overflow: "hidden",
        borderRadius: "0 0 var(--radius-md) var(--radius-md)",
      }}>
        {days.map(day => (
          <div key={day.dateStr} style={{
            background: day.isToday ? "rgba(52, 152, 219, 0.04)" : "var(--card-bg)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Day header */}
            <div style={{
              padding: "8px 8px 6px",
              borderBottom: "1px solid var(--card-border)",
              textAlign: "center",
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: day.isToday ? "var(--status-blue)" : "var(--text-dim)",
              }}>
                {day.dayName}
              </div>
              <div style={{
                fontSize: 18, fontWeight: day.isToday ? 700 : 400,
                color: day.isToday ? "var(--text-bright)" : "var(--text-dim)",
                lineHeight: 1.2,
              }}>
                {day.dayNum}
              </div>
            </div>

            {/* Events */}
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
              {/* All-day pills */}
              {day.allDay.length > 0 && (
                <div style={{ padding: "2px 4px 4px", display: "flex", flexDirection: "column", gap: 2 }}>
                  {day.allDay.map((e, i) => (
                    <div key={i} style={{
                      fontSize: 9, padding: "2px 5px", borderRadius: 3, fontWeight: 600,
                      background: `${ROLE_COLORS[e.role] || "#666"}22`,
                      color: ROLE_COLORS[e.role] || "#666",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }} title={e.summary}>
                      {e.summary}
                    </div>
                  ))}
                </div>
              )}

              {/* Timed events */}
              {day.timed.map((e, i) => (
                <div key={e.id || i} style={{
                  padding: "3px 6px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 4,
                  borderBottom: "1px solid var(--card-border)08",
                }} title={`${e.summary}\n${e.description?.slice(0, 100) || ""}`}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                    background: ROLE_COLORS[e.role] || "#666",
                  }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 10, color: "var(--text-dim)", fontFamily: "monospace",
                    }}>
                      {formatTime(e.start)}
                    </div>
                    <div style={{
                      fontSize: 11, color: "var(--text-bright)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      lineHeight: 1.3,
                    }}>
                      {e.summary}
                    </div>
                  </div>
                </div>
              ))}

              {day.allDay.length === 0 && day.timed.length === 0 && (
                <div style={{ padding: 12, textAlign: "center", fontSize: 10, color: "var(--text-dim)", opacity: 0.5 }}>
                  &mdash;
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(dateStr) {
  try {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
    });
  } catch {
    return "";
  }
}
