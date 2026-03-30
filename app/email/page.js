export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import EmailInbox from "@/components/EmailInbox";
import { listInbox } from "@/lib/gmail";

export default async function EmailPage() {
  let messages = [];
  let nextPageToken = null;
  let error = null;

  try {
    const result = await listInbox({ maxResults: 50 });
    messages = result.messages;
    nextPageToken = result.nextPageToken;
  } catch (err) {
    console.error("Email page load error:", err.message);
    error = err.message;
  }

  const unreadCount = messages.filter((m) => m.isUnread).length;

  return (
    <PageShell
      title="Inbox"
      subtitle={error
        ? "Could not connect to Gmail"
        : `${messages.length} in inbox${unreadCount > 0 ? ` \u00b7 ${unreadCount} unread` : ""}`
      }
    >
      {error ? (
        <div style={{
          background: "var(--card-bg)", border: "1px solid var(--card-border)",
          borderRadius: 8, padding: 24, textAlign: "center",
        }}>
          <p style={{ color: "var(--status-red)", fontSize: 14, marginBottom: 8 }}>
            Gmail connection failed
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: 12 }}>
            {error}
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 12 }}>
            Ensure gmail.modify scope is added to domain-wide delegation for the service account.
          </p>
        </div>
      ) : (
        <EmailInbox initialMessages={messages} initialNextPage={nextPageToken} />
      )}
    </PageShell>
  );
}
