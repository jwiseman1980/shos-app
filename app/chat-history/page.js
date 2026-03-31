import DataCard from "@/components/DataCard";
import ChatHistoryList from "@/components/ChatHistoryList";
import { getRecentSessions } from "@/lib/data/chat";

export const dynamic = "force-dynamic";

export default async function ChatHistoryPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";
  const sessionId = params?.id || null;

  let sessions = [];
  let selectedSession = null;
  let selectedMessages = [];

  try {
    sessions = await getRecentSessions({ limit: 50, search: search || undefined });
  } catch {}

  if (sessionId) {
    try {
      const { getSession, getSessionMessages } = await import("@/lib/data/chat");
      selectedSession = await getSession(sessionId);
      selectedMessages = await getSessionMessages(sessionId);
    } catch {}
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)" }}>
            Operator Chat History
          </div>
          <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0" }}>
            {sessions.length} recent session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <form method="get" style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search conversations..."
            style={{
              padding: "6px 12px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text)",
              fontSize: 12,
              width: 220,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "6px 14px",
              background: "var(--bg-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>
      </div>

      <ChatHistoryList
        sessions={sessions}
        selectedSession={selectedSession}
        selectedMessages={selectedMessages}
      />
    </>
  );
}
