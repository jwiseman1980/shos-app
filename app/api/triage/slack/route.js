import { getServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SLACK_API = "https://slack.com/api";
const RYAN_EMAIL_HINTS = ["ryan.santana@steel-hearts.org", "ryan@steel-hearts.org"];
const OPS_HUB_NAMES = ["ops-hub", "ops_hub", "ops"];

async function slackFetch(method, params, token) {
  const url = `${SLACK_API}/${method}`;
  const opts = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  };
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!data.ok) throw new Error(`slack.${method}: ${data.error || "unknown"}`);
  return data;
}

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

async function findOpsHubChannelId(token) {
  let cursor;
  for (let i = 0; i < 5; i++) {
    const data = await slackFetch(
      "conversations.list",
      { types: "public_channel,private_channel", limit: "200", cursor: cursor || "" },
      token
    );
    for (const ch of data.channels || []) {
      if (OPS_HUB_NAMES.includes(ch.name)) return ch.id;
    }
    cursor = data.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  return null;
}

function ageHours(ts) {
  if (!ts) return Infinity;
  const t = parseFloat(ts) * 1000;
  return (Date.now() - t) / 3600000;
}

function urgencyForAge(hours) {
  if (hours <= 6) return { urgency: "TODAY", section: "TODAY", priority: 3 };
  if (hours <= 24) return { urgency: "TODAY", section: "TODAY", priority: 3 };
  if (hours <= 72) return { urgency: "WEEK", section: "WEEK", priority: 2 };
  return { urgency: "WEEK", section: "WEEK", priority: 1 };
}

function truncate(text = "", n = 140) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

async function getRyanItems(token, sb) {
  const ryanId = await findRyanUserId(sb);
  if (!ryanId) return [];

  const open = await slackFetch("conversations.open", { users: ryanId }, token);
  const channelId = open.channel?.id;
  if (!channelId) return [];

  const oldest = String(Math.floor((Date.now() - 7 * 86400000) / 1000));
  const history = await slackFetch(
    "conversations.history",
    { channel: channelId, limit: "20", oldest },
    token
  );

  const messages = (history.messages || []).filter(
    (m) => m.user === ryanId && (m.subtype == null || m.subtype === "")
  );

  return messages.slice(0, 5).map((m) => {
    const hours = ageHours(m.ts);
    const { urgency, section, priority } = urgencyForAge(hours);
    const text = m.text || "(no text)";
    const ageLabel = hours < 1 ? "just now" : hours < 24 ? `${Math.round(hours)}h ago` : `${Math.round(hours / 24)}d ago`;

    return {
      id: `slack-ryan-${m.ts}`,
      type: "TASK",
      priority,
      section,
      urgency,
      accentColor: "#a855f7",
      icon: "💬",
      title: `Ryan (Slack) — ${truncate(text, 50)}`,
      subtitle: `DM from Ryan · ${ageLabel}`,
      badgeLabel: "SLACK DM",
      badgeClass: urgency === "OVERDUE" ? "badge-overdue" : "badge-today",
      brief: `DM from Ryan: ${truncate(text, 200)}`,
      context: {
        source: "Slack DM (Ryan)",
        notes: text,
        slackTs: m.ts,
        slackChannel: channelId,
      },
    };
  });
}

async function getOpsHubItems(token) {
  const channelId = await findOpsHubChannelId(token);
  if (!channelId) return [];

  const oldest = String(Math.floor((Date.now() - 48 * 3600 * 1000) / 1000));
  const history = await slackFetch(
    "conversations.history",
    { channel: channelId, limit: "30", oldest },
    token
  );

  const messages = (history.messages || []).filter(
    (m) => m.subtype == null || m.subtype === ""
  );

  return messages.slice(0, 5).map((m) => {
    const hours = ageHours(m.ts);
    const { urgency, section, priority } = urgencyForAge(hours);
    const text = m.text || "(no text)";
    const ageLabel = hours < 1 ? "just now" : hours < 24 ? `${Math.round(hours)}h ago` : `${Math.round(hours / 24)}d ago`;

    return {
      id: `slack-ops-${m.ts}`,
      type: "TASK",
      priority,
      section,
      urgency,
      accentColor: "#0ea5e9",
      icon: "📣",
      title: `#ops-hub — ${truncate(text, 50)}`,
      subtitle: `Channel update · ${ageLabel}`,
      badgeLabel: "OPS-HUB",
      badgeClass: "badge-week",
      brief: `#ops-hub: ${truncate(text, 200)}`,
      context: {
        source: "#ops-hub",
        notes: text,
        slackTs: m.ts,
        slackChannel: channelId,
      },
    };
  });
}

export async function GET() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return Response.json({ items: [], error: "SLACK_BOT_TOKEN not set" });
  }

  const sb = getServerClient();

  const [ryan, ops] = await Promise.allSettled([
    getRyanItems(token, sb),
    getOpsHubItems(token),
  ]);

  const items = [
    ...(ryan.status === "fulfilled" ? ryan.value : []),
    ...(ops.status === "fulfilled" ? ops.value : []),
  ];

  return Response.json({
    items,
    counts: {
      ryan: ryan.status === "fulfilled" ? ryan.value.length : 0,
      opsHub: ops.status === "fulfilled" ? ops.value.length : 0,
    },
  });
}
