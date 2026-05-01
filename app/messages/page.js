export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import MessageTracker from "@/components/MessageTracker";
import { getMessagesGroupedByHero, getMessageStats } from "@/lib/data/messages";
import volunteers from "@/data/volunteers.json";
import Link from "next/link";

export default async function FamilyMessagesPage({ searchParams }) {
  const params = await searchParams;
  const statusFilter = params?.filter || null; // eligible, not_eligible, sent, held
  const sourceFilter = params?.source || null; // squarespace, biopage

  // Load data
  const [allGroups, stats] = await Promise.all([
    getMessagesGroupedByHero(),
    getMessageStats(),
  ]);

  // Separate matched and unmatched
  const matchedGroups = allGroups.filter((g) => !g.isUnmatched);
  const unmatchedGroup = allGroups.find((g) => g.isUnmatched);

  // Apply filters to matched groups
  let filtered = matchedGroups;
  if (statusFilter === "eligible") {
    filtered = filtered.filter((g) => g.eligible);
  } else if (statusFilter === "not_eligible") {
    filtered = filtered.filter((g) => !g.eligible && g.sentMessages === 0);
  } else if (statusFilter === "sent") {
    filtered = filtered.filter((g) => g.sentMessages > 0);
  } else if (statusFilter === "held") {
    filtered = filtered.filter((g) => g.heldMessages > 0);
  }

  if (sourceFilter === "squarespace") {
    filtered = filtered.filter((g) =>
      g.messages.some((m) => m.source === "Squarespace Purchase")
    );
  } else if (sourceFilter === "biopage") {
    filtered = filtered.filter((g) =>
      g.messages.some((m) => m.source === "Bio Page Form")
    );
  }

  // Build filter URL helper
  function filterUrl(overrides = {}) {
    const p = {};
    if (statusFilter) p.filter = statusFilter;
    if (sourceFilter) p.source = sourceFilter;
    Object.assign(p, overrides);
    Object.keys(p).forEach((k) => {
      if (p[k] === null || p[k] === undefined || p[k] === "") delete p[k];
    });
    const qs = new URLSearchParams(p).toString();
    return `/messages${qs ? "?" + qs : ""}`;
  }

  // Compute eligible count from matched only
  const eligibleCount = matchedGroups.filter((g) => g.eligible).length;
  const heroesWithContact = matchedGroups.filter((g) => g.familyContactEmail).length;
  const draftsCreated = matchedGroups.filter((g) => g.sentMessages > 0).length;
  const pendingMessages = stats.newMessages + stats.readyToSend;
  const heroesWithPending = matchedGroups.filter(
    (g) => (g.newMessages + g.readyToSendMessages) > 0
  ).length;

  // Safe volunteer list (strip password hashes before passing to client)
  const safeVolunteers = volunteers
    .filter((v) => v.email && v.email.endsWith("@steel-hearts.org"))
    .map(({ name, email, role, initials }) => ({ name, email, role, initials }));

  return (
    <PageShell
      title="Family Messages"
      subtitle={`${stats.totalMessages} supporter messages across ${stats.heroesWithMessages} heroes`}
    >
      {/* Stats Grid */}
      <div className="stat-grid">
        <StatBlock
          label="Total Messages"
          value={stats.totalMessages}
          note={`${stats.linkedMessages} linked`}
          accent="var(--gold)"
        />
        <StatBlock
          label="Delivered"
          value={stats.sentMessages}
          note={stats.totalMessages > 0
            ? `${Math.round((stats.sentMessages / stats.totalMessages) * 100)}% of total`
            : "—"}
          accent="var(--status-green)"
        />
        <StatBlock
          label="Pending"
          value={pendingMessages}
          note={`${stats.newMessages} new, ${stats.readyToSend} ready`}
          accent="var(--status-orange)"
        />
        <StatBlock
          label="Heroes with Pending"
          value={heroesWithPending}
          note={`of ${stats.heroesWithMessages} with messages`}
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Eligible (6+)"
          value={eligibleCount}
          note={`${heroesWithContact} have family contact`}
          accent="var(--status-green)"
        />
        <StatBlock
          label="Unmatched"
          value={stats.unmatchedMessages}
          note={`${unmatchedGroup?.messages?.length || 0} orphan messages`}
          accent="var(--status-red)"
        />
      </div>

      {/* Progress Bar */}
      {stats.totalMessages > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
              Delivery Progress
            </span>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {stats.sentMessages}/{stats.linkedMessages} linked messages sent
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: stats.linkedMessages > 0
                  ? `${Math.round((stats.sentMessages / stats.linkedMessages) * 100)}%`
                  : "0%",
              }}
            />
          </div>
        </div>
      )}

      {/* Source Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{
          padding: "8px 14px",
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: "var(--radius-md)",
          fontSize: 12,
        }}>
          <span style={{ color: "var(--text-dim)" }}>Squarespace: </span>
          <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{stats.bySource.squarespace}</span>
        </div>
        <div style={{
          padding: "8px 14px",
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: "var(--radius-md)",
          fontSize: 12,
        }}>
          <span style={{ color: "var(--text-dim)" }}>Bio Page Form: </span>
          <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{stats.bySource.bioPage}</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Status:
          </span>
          {[
            { key: null, label: "All" },
            { key: "eligible", label: "Eligible (6+)" },
            { key: "not_eligible", label: "Not Eligible" },
            { key: "sent", label: "Has Sent" },
            { key: "held", label: "Has Held" },
          ].map((f) => (
            <Link
              key={f.key || "all"}
              href={filterUrl({ filter: f.key })}
              className={statusFilter === f.key ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "3px 8px", fontSize: 11 }}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Source:
          </span>
          {[
            { key: null, label: "All" },
            { key: "squarespace", label: "Squarespace" },
            { key: "biopage", label: "Bio Page" },
          ].map((f) => (
            <Link
              key={f.key || "all"}
              href={filterUrl({ source: f.key })}
              className={sourceFilter === f.key ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "3px 8px", fontSize: 11 }}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Active filter indicator */}
      {(statusFilter || sourceFilter) && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            Showing {filtered.length} of {matchedGroups.length} heroes
          </span>
          <Link
            href={filterUrl({ filter: null, source: null })}
            style={{ fontSize: 12, color: "var(--gold)" }}
          >
            Clear filters
          </Link>
        </div>
      )}

      {/* Hero Messages Table */}
      <DataCard title={`Supporter Messages by Hero — ${filtered.length} heroes`}>
        {filtered.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            No heroes match the current filters.
          </p>
        ) : (
          <MessageTracker heroGroups={filtered} volunteers={safeVolunteers} />
        )}
      </DataCard>

      {/* Unmatched Messages Summary */}
      {unmatchedGroup && unmatchedGroup.messages.length > 0 && (
        <DataCard title={`Unmatched Messages — ${unmatchedGroup.messages.length} messages need hero linking`}>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12, lineHeight: 1.5 }}>
            These messages have no bracelet link (Memorial_Bracelet__c is null). They came from the Bio Page Form
            with hero names instead of SKUs. They need to be manually matched to bracelets.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Hero Name (SKU field)</th>
                  <th>Source</th>
                  <th>Message Preview</th>
                </tr>
              </thead>
              <tbody>
                {unmatchedGroup.messages.slice(0, 20).map((msg) => (
                  <tr key={msg.sfId}>
                    <td style={{ fontSize: 12 }}>{msg.fromName || "Anonymous"}</td>
                    <td style={{ fontSize: 12, color: "var(--gold)" }}>
                      {msg.sku || msg.itemDescription || "—"}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-dim)" }}>{msg.source}</td>
                    <td style={{ fontSize: 11, color: "var(--text-dim)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {msg.message?.slice(0, 80) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unmatchedGroup.messages.length > 20 && (
            <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>
              Showing 20 of {unmatchedGroup.messages.length} unmatched messages
            </p>
          )}
        </DataCard>
      )}
    </PageShell>
  );
}
