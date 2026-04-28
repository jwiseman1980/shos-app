import { buildTriageGmailClient } from "@/lib/email-triage";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const JOSEPH_EMAIL = "joseph.wiseman@steel-hearts.org";
const SIGNATURE_HINTS = [
  "joseph wiseman",
  "steel hearts foundation",
  "steel hearts",
  "executive director",
  "sent from my",
];
const NEWSLETTER_HINTS = [
  "unsubscribe",
  "newsletter",
  "no-reply",
  "noreply",
  "donotreply",
  "mailer-daemon",
  "postmaster",
];

function parseHeaderMap(headers = []) {
  const map = {};
  for (const { name, value } of headers || []) map[name.toLowerCase()] = value;
  return map;
}

function extractFrom(raw = "") {
  const m = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) return { name: (m[1].trim() || m[2]), email: m[2].trim().toLowerCase() };
  return { name: raw, email: raw.trim().toLowerCase() };
}

function decodeBase64Url(data) {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractPlainBody(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  function walk(node) {
    if (!node) return null;
    if (node.mimeType === "text/plain" && node.body?.data) {
      return decodeBase64Url(node.body.data);
    }
    if (node.parts) {
      for (const p of node.parts) {
        const found = walk(p);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(payload) || "";
}

function stripQuoted(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  const cleaned = [];
  for (const line of lines) {
    if (/^On .+wrote:$/i.test(line.trim())) break;
    if (/^From:\s/.test(line) && cleaned.length > 5) break;
    if (line.trim().startsWith(">")) continue;
    cleaned.push(line);
  }
  return cleaned.join("\n").trim();
}

function isJustSignature(body) {
  const stripped = stripQuoted(body).trim();
  if (!stripped) return true;
  if (stripped.length < 25) return true;
  const lower = stripped.toLowerCase();
  const meaningfulLines = stripped
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !SIGNATURE_HINTS.some((s) => l.toLowerCase().includes(s)));
  if (meaningfulLines.length === 0) return true;
  const total = meaningfulLines.join(" ").trim();
  if (total.length < 25) return true;
  if (SIGNATURE_HINTS.filter((s) => lower.includes(s)).length >= 2 && total.length < 80) {
    return true;
  }
  return false;
}

function isNewsletterOrSpam(fromEmail = "", subject = "", labels = []) {
  const f = fromEmail.toLowerCase();
  if (labels.includes("SPAM") || labels.includes("CATEGORY_PROMOTIONS")) return true;
  if (NEWSLETTER_HINTS.some((h) => f.includes(h))) return true;
  if (/\bunsubscribe\b/i.test(subject)) return true;
  return false;
}

function ageDays(dateStr) {
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / 86400000;
}

function urgencyForDraft(isAbandoned, days) {
  if (isAbandoned) return { urgency: "OVERDUE", section: "TODAY", priority: 4 };
  if (days > 3) return { urgency: "TODAY", section: "TODAY", priority: 3 };
  if (days > 1) return { urgency: "WEEK", section: "WEEK", priority: 2 };
  return { urgency: "WEEK", section: "WEEK", priority: 2 };
}

function urgencyForUnanswered(days) {
  if (days > 4) return { urgency: "OVERDUE", section: "TODAY", priority: 4 };
  if (days > 2) return { urgency: "TODAY", section: "TODAY", priority: 3 };
  return { urgency: "WEEK", section: "WEEK", priority: 2 };
}

async function fetchDrafts(gmail) {
  const list = await gmail.users.drafts.list({ userId: "me", maxResults: 30 });
  const drafts = list.data.drafts || [];
  if (!drafts.length) return [];

  const detailed = await Promise.all(
    drafts.map(async ({ id }) => {
      try {
        const res = await gmail.users.drafts.get({ userId: "me", id, format: "full" });
        return res.data;
      } catch {
        return null;
      }
    })
  );

  return detailed.filter(Boolean).map((d) => {
    const msg = d.message;
    const headers = parseHeaderMap(msg?.payload?.headers || []);
    const to = headers["to"] || "";
    const subject = headers["subject"] || "(no subject)";
    const date = headers["date"] || msg?.internalDate
      ? new Date(parseInt(msg.internalDate, 10)).toISOString()
      : null;
    const body = extractPlainBody(msg?.payload);
    const abandoned = isJustSignature(body);
    const days = ageDays(date);
    const { urgency, section, priority } = urgencyForDraft(abandoned, days);
    const recipient = extractFrom(to);
    const recipientName = recipient.name?.split("@")[0] || recipient.email || "Unknown";
    const cleanSubject = subject.replace(/^Re:\s*/i, "");

    const briefPrefix = abandoned
      ? "Abandoned draft — body is empty or just a signature."
      : "Pending draft. Review and send.";

    return {
      id: `gmail-draft-${d.id}`,
      type: "EMAIL",
      priority,
      section,
      urgency,
      accentColor: abandoned ? "#ef4444" : "#c4a237",
      icon: abandoned ? "⚠️" : "📝",
      title: `${recipientName} — ${cleanSubject.slice(0, 50)}`,
      subtitle: abandoned ? "Abandoned draft · no body" : `Draft · ${recipient.email}`,
      badgeLabel: abandoned ? "ABANDONED" : "DRAFT",
      badgeClass: abandoned ? "badge-overdue" : "badge-week",
      brief: `${briefPrefix} To: ${recipient.email || "—"}. Subject: ${cleanSubject}.`,
      context: {
        draftId: d.id,
        threadId: msg?.threadId || null,
        messageId: msg?.id || null,
        to: recipient.email,
        subject,
        snippet: msg?.snippet || "",
        draftText: stripQuoted(body),
        category: "DRAFT",
        suggestedPipelines: [],
        abandoned,
      },
    };
  });
}

async function fetchUnansweredThreads(gmail) {
  const q = "in:inbox newer_than:7d -from:me -category:promotions -category:social -label:spam";
  const list = await gmail.users.threads.list({ userId: "me", q, maxResults: 25 });
  const items = list.data.threads || [];
  if (!items.length) return [];

  const threads = await Promise.all(
    items.map(({ id }) =>
      gmail.users.threads
        .get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        })
        .then((r) => r.data)
        .catch(() => null)
    )
  );

  const out = [];
  for (const thread of threads.filter(Boolean)) {
    const messages = thread.messages || [];
    if (!messages.length) continue;

    const nonDraft = messages.filter((m) => !m.labelIds?.includes("DRAFT"));
    if (!nonDraft.length) continue;

    const lastMsg = nonDraft[nonDraft.length - 1];
    const lastHeaders = parseHeaderMap(lastMsg.payload?.headers || []);
    const fromRaw = lastHeaders["from"] || "";
    const { name: fromName, email: fromEmail } = extractFrom(fromRaw);

    if (fromEmail.includes(JOSEPH_EMAIL)) continue;
    if (isNewsletterOrSpam(fromEmail, lastHeaders["subject"] || "", lastMsg.labelIds || [])) continue;

    const firstHeaders = parseHeaderMap(messages[0].payload?.headers || []);
    const subject = firstHeaders["subject"] || "(no subject)";
    const date = lastHeaders["date"] || null;
    const days = ageDays(date);
    if (days > 7) continue;

    const { urgency, section, priority } = urgencyForUnanswered(days);
    const senderName = fromName || fromEmail.split("@")[0];

    out.push({
      id: `gmail-thread-${thread.id}`,
      type: "EMAIL",
      priority,
      section,
      urgency,
      accentColor: "#c4a237",
      icon: "📧",
      title: `${senderName} — ${subject.replace(/^Re:\s*/i, "").slice(0, 50)}`,
      subtitle: `Unanswered · ${Math.max(1, Math.round(days))}d ago`,
      badgeLabel: urgency === "OVERDUE" ? "OVERDUE" : "REPLY",
      badgeClass: urgency === "OVERDUE" ? "badge-overdue" : "badge-today",
      brief: `Unanswered email from ${senderName}. ${(lastMsg.snippet || "").slice(0, 140)}`,
      context: {
        threadId: thread.id,
        messageId: lastMsg.id,
        from: fromRaw,
        fromName,
        fromEmail,
        subject,
        snippet: lastMsg.snippet || "",
        category: "EMAIL-UNANSWERED",
        draftText: "",
        suggestedPipelines: [],
      },
    });
  }
  return out;
}

export async function GET() {
  try {
    const gmail = await buildTriageGmailClient();
    const [drafts, unanswered] = await Promise.allSettled([
      fetchDrafts(gmail),
      fetchUnansweredThreads(gmail),
    ]);

    const draftItems = drafts.status === "fulfilled" ? drafts.value : [];
    const threadItems = unanswered.status === "fulfilled" ? unanswered.value : [];

    const seen = new Set(draftItems.map((d) => d.context?.threadId).filter(Boolean));
    const dedupedThreads = threadItems.filter((t) => !seen.has(t.context.threadId));

    return Response.json({
      items: [...draftItems, ...dedupedThreads],
      counts: {
        drafts: draftItems.length,
        unanswered: dedupedThreads.length,
      },
    });
  } catch (err) {
    console.error("[triage/gmail] failed:", err.message);
    return Response.json({ items: [], error: err.message }, { status: 200 });
  }
}
