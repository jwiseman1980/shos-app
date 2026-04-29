/**
 * Triage Sync Cron — every 30 minutes
 *
 * Keeps the today/triage feed accurate without anyone in a chat session.
 * Scans Gmail, Slack, orders, and heroes; creates or closes tasks so the
 * feed reflects reality.
 *
 * Auth: CRON_SECRET (Vercel cron) or SHOS_API_KEY (manual).
 *
 * Dedupe strategy:
 *   1. Strict: tasks.source_type + tasks.source_id pair is the canonical key.
 *      Look up existing tasks first, update or skip if found.
 *   2. Soft: against the original 17 seed tasks (source_type='manual',
 *      tag 'seed:joseph-2026-04'). Match by sender lastname / order# /
 *      hero lastname appearing in the seed task title.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import { getServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOSEPH_EMAIL = "joseph.wiseman@steel-hearts.org";
const LOCAL_KEY_PATH = "C:/Users/JosephWiseman/.secrets/shos-signer.json";
const SLACK_API = "https://slack.com/api";
const RYAN_EMAIL_HINTS = ["ryan.santana@steel-hearts.org", "ryan@steel-hearts.org"];

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  const f = (fromEmail || "").toLowerCase();
  if (labels.includes("SPAM") || labels.includes("CATEGORY_PROMOTIONS")) return true;
  if (NEWSLETTER_HINTS.some((h) => f.includes(h))) return true;
  if (/\bunsubscribe\b/i.test(subject || "")) return true;
  return false;
}

function ageDays(dateStr) {
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / 86400000;
}

function priorityFromAgeDays(days) {
  if (days > 3) return "critical";
  if (days > 1) return "high";
  return "medium";
}

function buildGmailClient(scopes = ["https://www.googleapis.com/auth/gmail.readonly"]) {
  let client_email, private_key;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const keyJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || keyJson.client_email;
      private_key = keyJson.private_key;
    } catch {
      client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      private_key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
        .replace(/^"|"$/g, "")
        .replace(/\\n/g, "\n");
    }
  } else if (fs.existsSync(LOCAL_KEY_PATH)) {
    const keyJson = JSON.parse(fs.readFileSync(LOCAL_KEY_PATH, "utf8"));
    client_email = keyJson.client_email;
    private_key = keyJson.private_key;
  } else {
    throw new Error("Gmail service account not configured");
  }

  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes,
    subject: JOSEPH_EMAIL,
  });
  return google.gmail({ version: "v1", auth });
}

async function slackFetch(method, params, token) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`slack.${method}: ${data.error || "unknown"}`);
  return data;
}

// ---------------------------------------------------------------------------
// Soft-dedupe against the seed task list
// ---------------------------------------------------------------------------

/**
 * Build a dictionary of "open seed task keywords" from existing manual tasks
 * so we don't recreate something Joseph already has on his list.
 */
function buildSeedKeywordIndex(seedTasks = []) {
  const keywords = new Set();
  for (const t of seedTasks) {
    const text = `${t.title || ""} ${t.description || ""}`.toLowerCase();
    // Pull out distinctive multi-letter tokens (names, SKUs, order numbers)
    const tokens = text.match(/\b[a-z][a-z0-9-]{3,}\b|#\d+|\bdon-\d{4}-\d{3,}\b/g) || [];
    for (const tok of tokens) {
      // Skip generic English words
      if (
        [
          "respond", "follow", "process", "order", "from", "with", "their", "into", "next",
          "have", "been", "send", "ready", "approval", "system", "notion", "drive",
          "upcoming", "share", "needs", "need", "phone", "ahead", "before", "ahead",
          "details", "before", "outreach", "anniversary", "request", "bracelet", "bracelets",
          "create", "review", "design", "production", "thank", "deadline", "entered",
          "pipeline", "kristin", "google", "froze", "waiting", "currently",
        ].includes(tok)
      ) {
        continue;
      }
      keywords.add(tok);
    }
  }
  return keywords;
}

function softMatchesSeed(candidateText, seedKeywords) {
  const text = (candidateText || "").toLowerCase();
  let hits = 0;
  for (const kw of seedKeywords) {
    if (text.includes(kw)) {
      hits++;
      if (hits >= 1) return true; // single distinctive token hit is enough
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Gmail scan
// ---------------------------------------------------------------------------

async function fetchUnansweredThreads(gmail) {
  const q = "in:inbox newer_than:7d -from:me -category:promotions -category:social -label:spam";
  const list = await gmail.users.threads.list({ userId: "me", q, maxResults: 30 });
  const items = list.data.threads || [];
  if (!items.length) return [];

  const threads = await Promise.all(
    items.map(({ id }) =>
      gmail.users.threads
        .get({ userId: "me", id, format: "full" })
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

    const lastFromJoseph = fromEmail.includes(JOSEPH_EMAIL.toLowerCase());
    const subject = (parseHeaderMap(messages[0].payload?.headers || [])["subject"]) || "(no subject)";

    if (isNewsletterOrSpam(fromEmail, subject, lastMsg.labelIds || [])) continue;

    const date = lastHeaders["date"] || null;
    const days = ageDays(date);

    out.push({
      threadId: thread.id,
      lastFromJoseph,
      fromName,
      fromEmail,
      subject,
      lastMessageDate: date,
      ageDays: days,
      snippet: lastMsg.snippet || "",
    });
  }
  return out;
}

async function fetchAbandonedDrafts(gmail) {
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

  return detailed
    .filter(Boolean)
    .map((d) => {
      const msg = d.message;
      const headers = parseHeaderMap(msg?.payload?.headers || []);
      const body = extractPlainBody(msg?.payload);
      const abandoned = isJustSignature(body);
      const dateMs = msg?.internalDate ? parseInt(msg.internalDate, 10) : null;
      const date = headers["date"] || (dateMs ? new Date(dateMs).toISOString() : null);
      return {
        draftId: d.id,
        threadId: msg?.threadId || null,
        to: headers["to"] || "",
        subject: headers["subject"] || "(no subject)",
        date,
        ageDays: ageDays(date),
        abandoned,
      };
    });
}

// ---------------------------------------------------------------------------
// Slack scan
// ---------------------------------------------------------------------------

async function findRyanUserId(sb) {
  for (const email of RYAN_EMAIL_HINTS) {
    const { data } = await sb
      .from("users")
      .select("slack_user_id")
      .ilike("email", email)
      .limit(1)
      .single()
      .then((r) => r, () => ({ data: null }));
    if (data?.slack_user_id) return data.slack_user_id;
  }
  return null;
}

async function scanSlackForRyanFiles(token, sb) {
  const ryanId = await findRyanUserId(sb);
  if (!ryanId) return { newSvgs: 0, sampleNames: [], unreadDmCount: 0 };

  // Open DM channel with Ryan
  const open = await slackFetch("conversations.open", { users: ryanId }, token);
  const channelId = open.channel?.id;
  if (!channelId) return { newSvgs: 0, sampleNames: [], unreadDmCount: 0 };

  // Look for SVG files shared in the last 24h via files.list
  const since = Math.floor((Date.now() - 24 * 3600 * 1000) / 1000);
  let newSvgs = 0;
  const sampleNames = [];
  try {
    const files = await slackFetch(
      "files.list",
      {
        user: ryanId,
        types: "images,svg,application",
        ts_from: String(since),
        count: "50",
      },
      token
    );
    for (const f of files.files || []) {
      const name = (f.name || "").toLowerCase();
      const mt = (f.mimetype || "").toLowerCase();
      if (name.endsWith(".svg") || mt.includes("svg")) {
        newSvgs++;
        if (sampleNames.length < 3) sampleNames.push(f.name);
      }
    }
  } catch {
    // files.list may not be permitted with the bot scope; carry on
  }

  // Count unread DMs from Ryan in the last 7d
  let unreadDmCount = 0;
  try {
    const oldest = String(Math.floor((Date.now() - 7 * 86400000) / 1000));
    const history = await slackFetch(
      "conversations.history",
      { channel: channelId, limit: "50", oldest },
      token
    );
    for (const m of history.messages || []) {
      if (m.user === ryanId && (m.subtype == null || m.subtype === "")) {
        unreadDmCount++;
      }
    }
  } catch {}

  return { newSvgs, sampleNames, unreadDmCount, channelId };
}

// ---------------------------------------------------------------------------
// Task helpers
// ---------------------------------------------------------------------------

async function loadOpenTasks(sb) {
  const { data } = await sb
    .from("tasks")
    .select("id, title, description, status, priority, role, source_type, source_id, tags, due_date")
    .not("status", "in", "(done,cancelled)");
  return data || [];
}

function indexTasksBySource(tasks) {
  const idx = new Map();
  for (const t of tasks) {
    if (t.source_type && t.source_id) {
      idx.set(`${t.source_type}::${t.source_id}`, t);
    }
  }
  return idx;
}

async function ensureTask(sb, key, payload, existingMap, results) {
  const found = existingMap.get(key);
  if (found) {
    // Update priority + description if it has changed
    const updates = {};
    if (payload.priority && payload.priority !== found.priority) updates.priority = payload.priority;
    if (payload.description && payload.description !== found.description) updates.description = payload.description;
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await sb.from("tasks").update(updates).eq("id", found.id);
      results.push({ action: "updated", id: found.id, title: found.title });
    } else {
      results.push({ action: "unchanged", id: found.id, title: found.title });
    }
    return found.id;
  }

  const { data, error } = await sb
    .from("tasks")
    .insert({
      title: payload.title,
      description: payload.description || null,
      status: "todo",
      priority: payload.priority || "medium",
      role: payload.role || "ed",
      domain: payload.domain || null,
      hero_id: payload.hero_id || null,
      due_date: payload.due_date || null,
      source_type: payload.source_type,
      source_id: payload.source_id,
      tags: payload.tags || ["triage-sync"],
    })
    .select("id, title")
    .single();

  if (error) {
    results.push({ action: "error", error: error.message, title: payload.title });
    return null;
  }
  results.push({ action: "created", id: data.id, title: data.title });
  return data.id;
}

async function closeTask(sb, taskId, reason, results) {
  await sb
    .from("tasks")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: reason,
    })
    .eq("id", taskId);
  results.push({ action: "closed", id: taskId, reason });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(request) {
  // Auth
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const key = request.headers.get("x-api-key");
  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isApiKey = apiKey && key === apiKey;
  if (!isVercelCron && !isApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();
  const startedAt = new Date().toISOString();
  const summary = {
    startedAt,
    gmail: { unanswered: 0, replied: 0, abandonedDrafts: 0 },
    slack: { newSvgs: 0, unreadDms: 0 },
    orders: { designNeeded: 0, otherPending: 0, shippedClosed: 0 },
    anniversaries: { upcoming: 0 },
    tasks: { created: 0, updated: 0, unchanged: 0, closed: 0, errors: 0 },
    actions: [],
  };

  try {
    // Load all open tasks once + build seed keyword index
    const openTasks = await loadOpenTasks(sb);
    const sourceIdx = indexTasksBySource(openTasks);
    const seedTasks = openTasks.filter((t) =>
      Array.isArray(t.tags) && t.tags.some((tag) => /^seed:joseph/i.test(tag))
    );
    const seedKeywords = buildSeedKeywordIndex(seedTasks);

    // -----------------------------------------------------------------------
    // 1. Gmail — unanswered threads + abandoned drafts + auto-close replied
    // -----------------------------------------------------------------------
    let threads = [];
    let drafts = [];
    try {
      const gmail = buildGmailClient();
      [threads, drafts] = await Promise.all([
        fetchUnansweredThreads(gmail),
        fetchAbandonedDrafts(gmail),
      ]);
    } catch (err) {
      summary.actions.push({ action: "gmail_error", error: err.message });
    }

    for (const t of threads) {
      const sourceKey = `email::${t.threadId}`;
      const senderName = t.fromName || t.fromEmail.split("@")[0] || "Unknown";
      const cleanSubject = (t.subject || "").replace(/^Re:\s*/i, "");
      const titleSnippet = cleanSubject.slice(0, 60);

      if (t.lastFromJoseph) {
        // Joseph replied — auto-close any open task tied to this thread
        const found = sourceIdx.get(sourceKey);
        if (found) {
          await closeTask(sb, found.id, "Auto-closed: Joseph replied in thread", summary.actions);
          summary.tasks.closed++;
          summary.gmail.replied++;
        }
        continue;
      }

      summary.gmail.unanswered++;
      const candidateText = `${senderName} ${titleSnippet}`.toLowerCase();
      if (softMatchesSeed(candidateText, seedKeywords)) {
        // covered by an existing seed task — don't duplicate
        continue;
      }

      const priority = priorityFromAgeDays(t.ageDays);
      const id = await ensureTask(
        sb,
        sourceKey,
        {
          title: `${senderName} — ${titleSnippet}`,
          description: `Unanswered email thread from ${senderName} <${t.fromEmail}>. Subject: ${t.subject}. ${t.snippet?.slice(0, 200) || ""}`,
          priority,
          role: "ed",
          domain: "comms",
          source_type: "email",
          source_id: t.threadId,
          tags: ["triage-sync", "email"],
        },
        sourceIdx,
        summary.actions
      );
      if (id) {
        const last = summary.actions[summary.actions.length - 1];
        if (last?.action === "created") summary.tasks.created++;
        if (last?.action === "updated") summary.tasks.updated++;
        if (last?.action === "unchanged") summary.tasks.unchanged++;
      }
    }

    for (const d of drafts) {
      if (!d.abandoned) continue;
      summary.gmail.abandonedDrafts++;
      const sourceKey = `email-draft::${d.draftId}`;
      const recipient = extractFrom(d.to);
      const recipientName = recipient.name?.split("@")[0] || recipient.email || "Unknown";

      const candidateText = `${recipientName} ${d.subject}`.toLowerCase();
      if (softMatchesSeed(candidateText, seedKeywords)) continue;

      await ensureTask(
        sb,
        sourceKey,
        {
          title: `Abandoned draft: ${recipientName} — ${d.subject?.slice(0, 50) || "(no subject)"}`,
          description: `Gmail draft has only a signature — no body written. To: ${recipient.email || "—"}. Subject: ${d.subject || "(no subject)"}.`,
          priority: "high",
          role: "ed",
          domain: "comms",
          source_type: "email-draft",
          source_id: d.draftId,
          tags: ["triage-sync", "email-draft", "abandoned"],
        },
        sourceIdx,
        summary.actions
      );
      const last = summary.actions[summary.actions.length - 1];
      if (last?.action === "created") summary.tasks.created++;
      if (last?.action === "updated") summary.tasks.updated++;
      if (last?.action === "unchanged") summary.tasks.unchanged++;
    }

    // -----------------------------------------------------------------------
    // 2. Slack — new SVGs from Ryan + unread DMs
    // -----------------------------------------------------------------------
    const slackToken = process.env.SLACK_USER_TOKEN || process.env.SLACK_BOT_TOKEN;
    if (slackToken) {
      try {
        const slack = await scanSlackForRyanFiles(slackToken, sb);
        summary.slack.newSvgs = slack.newSvgs;
        summary.slack.unreadDms = slack.unreadDmCount;

        if (slack.newSvgs > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const sourceKey = `slack-svg::ryan-${today}`;
          const sample = slack.sampleNames.length ? ` (${slack.sampleNames.join(", ")})` : "";
          await ensureTask(
            sb,
            sourceKey,
            {
              title: `New designs from Ryan — download and categorize`,
              description: `${slack.newSvgs} SVG file(s) shared by Ryan in Slack in the last 24h${sample}. Download from Slack DM, save under Bracelet Design Files, and run upload-bracelet-designs-storage.mjs.`,
              priority: "high",
              role: "ed",
              domain: "operations",
              source_type: "slack-svg",
              source_id: `ryan-${today}`,
              tags: ["triage-sync", "slack", "design"],
            },
            sourceIdx,
            summary.actions
          );
          const last = summary.actions[summary.actions.length - 1];
          if (last?.action === "created") summary.tasks.created++;
          if (last?.action === "updated") summary.tasks.updated++;
          if (last?.action === "unchanged") summary.tasks.unchanged++;
        }
      } catch (err) {
        summary.actions.push({ action: "slack_error", error: err.message });
      }
    } else {
      summary.actions.push({ action: "slack_skipped", reason: "no SLACK_USER_TOKEN/SLACK_BOT_TOKEN" });
    }

    // -----------------------------------------------------------------------
    // 3. Supabase orders — design_needed > 3d, pending status checks,
    //    auto-close shipped
    // -----------------------------------------------------------------------
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: stalledItems } = await sb
      .from("order_items")
      .select("id, order_id, lineitem_sku, production_status, hero_id, updated_at, created_at, heroes(name, last_name)")
      .eq("production_status", "design_needed")
      .lte("updated_at", threeDaysAgo);

    for (const item of stalledItems || []) {
      summary.orders.designNeeded++;
      const sourceKey = `order-item::${item.id}`;
      const heroName = item.heroes?.name || item.lineitem_sku || "unknown";
      const heroLast = (item.heroes?.last_name || "").toLowerCase();

      if (heroLast && softMatchesSeed(heroLast, seedKeywords)) continue;

      await ensureTask(
        sb,
        sourceKey,
        {
          title: `Order stuck on design — ${heroName}`,
          description: `Order item ${item.id} (${item.lineitem_sku}) has been in design_needed for >3 days. Either advance the design or escalate to Ryan.`,
          priority: "high",
          role: "ed",
          domain: "operations",
          hero_id: item.hero_id,
          source_type: "order-item",
          source_id: item.id,
          tags: ["triage-sync", "order", "design-needed"],
        },
        sourceIdx,
        summary.actions
      );
      const last = summary.actions[summary.actions.length - 1];
      if (last?.action === "created") summary.tasks.created++;
      if (last?.action === "updated") summary.tasks.updated++;
      if (last?.action === "unchanged") summary.tasks.unchanged++;
    }

    // Auto-close order tasks whose item is now shipped
    const { data: shippedItems } = await sb
      .from("order_items")
      .select("id")
      .eq("production_status", "shipped");
    const shippedIds = new Set((shippedItems || []).map((r) => r.id));
    for (const t of openTasks) {
      if (t.source_type === "order-item" && t.source_id && shippedIds.has(t.source_id)) {
        await closeTask(sb, t.id, "Auto-closed: order item shipped", summary.actions);
        summary.tasks.closed++;
        summary.orders.shippedClosed++;
      }
    }

    // Auto-close design tasks whose hero is now design_status=complete
    const designTasks = openTasks.filter(
      (t) => t.source_type === "hero-design" && t.source_id
    );
    if (designTasks.length > 0) {
      const heroIds = designTasks.map((t) => t.source_id);
      const { data: completedHeroes } = await sb
        .from("heroes")
        .select("id, design_status")
        .in("id", heroIds)
        .eq("design_status", "complete");
      const completedIds = new Set((completedHeroes || []).map((h) => h.id));
      for (const t of designTasks) {
        if (completedIds.has(t.source_id)) {
          await closeTask(sb, t.id, "Auto-closed: hero design complete", summary.actions);
          summary.tasks.closed++;
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. Anniversaries — heroes with memorial date in next 7 days
    //    that are not already sent/complete/skipped
    // -----------------------------------------------------------------------
    const now = new Date();
    const upcomingTargets = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      upcomingTargets.push({ month: d.getMonth() + 1, day: d.getDate() });
    }

    const { data: heroes } = await sb
      .from("heroes")
      .select("id, name, last_name, memorial_month, memorial_day, anniversary_status, active_listing")
      .eq("active_listing", true);

    for (const h of heroes || []) {
      const m = Number(h.memorial_month);
      const d = Number(h.memorial_day);
      if (!m || !d) continue;
      const matches = upcomingTargets.some((t) => t.month === m && t.day === d);
      if (!matches) continue;
      if (["sent", "complete", "skipped", "email_sent"].includes(h.anniversary_status)) continue;

      summary.anniversaries.upcoming++;
      const sourceKey = `anniversary::${h.id}`;
      const heroLast = (h.last_name || "").toLowerCase();
      if (heroLast && softMatchesSeed(heroLast, seedKeywords)) continue;

      await ensureTask(
        sb,
        sourceKey,
        {
          title: `Anniversary outreach — ${h.name}`,
          description: `${h.name} memorial date ${m}/${d} is within 7 days. Status: ${h.anniversary_status || "not_started"}. Draft outreach to bracelet customers and family.`,
          priority: "high",
          role: "ed",
          domain: "comms",
          hero_id: h.id,
          source_type: "anniversary",
          source_id: h.id,
          tags: ["triage-sync", "anniversary"],
        },
        sourceIdx,
        summary.actions
      );
      const last = summary.actions[summary.actions.length - 1];
      if (last?.action === "created") summary.tasks.created++;
      if (last?.action === "updated") summary.tasks.updated++;
      if (last?.action === "unchanged") summary.tasks.unchanged++;
    }

    // Auto-close anniversary tasks whose hero now has a terminal status
    const annTasks = openTasks.filter((t) => t.source_type === "anniversary" && t.source_id);
    if (annTasks.length > 0) {
      const annHeroIds = annTasks.map((t) => t.source_id);
      const { data: annHeroes } = await sb
        .from("heroes")
        .select("id, anniversary_status")
        .in("id", annHeroIds);
      const closeMap = new Map();
      for (const h of annHeroes || []) {
        if (["sent", "complete", "skipped", "email_sent"].includes(h.anniversary_status)) {
          closeMap.set(h.id, h.anniversary_status);
        }
      }
      for (const t of annTasks) {
        if (closeMap.has(t.source_id)) {
          await closeTask(
            sb,
            t.id,
            `Auto-closed: anniversary_status=${closeMap.get(t.source_id)}`,
            summary.actions
          );
          summary.tasks.closed++;
        }
      }
    }

    // Tally errors
    summary.tasks.errors = summary.actions.filter((a) => a.action === "error").length;

    // -----------------------------------------------------------------------
    // 5. Persist last_triage_sync timestamp
    // -----------------------------------------------------------------------
    const finishedAt = new Date().toISOString();
    summary.finishedAt = finishedAt;
    summary.durationMs = Date.now() - new Date(startedAt).getTime();

    await sb
      .from("system_config")
      .upsert(
        { key: "last_triage_sync", value: finishedAt },
        { onConflict: "key" }
      )
      .then(() => null, () => null);

    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error("[triage-sync] failed:", err);
    return NextResponse.json(
      { success: false, error: err.message, summary },
      { status: 500 }
    );
  }
}
