import { google } from "googleapis";
import fs from "fs";

const JOSEPH_EMAIL = "joseph.wiseman@steel-hearts.org";
const LOCAL_KEY_PATH = "C:/Users/JosephWiseman/.secrets/shos-signer.json";

function parseHeaderMap(headers = []) {
  const map = {};
  for (const { name, value } of headers) {
    map[name.toLowerCase()] = value;
  }
  return map;
}

function extractFrom(raw = "") {
  const match = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>/);
  if (match) return { name: match[1].trim() || match[2], email: match[2].trim() };
  return { name: raw, email: raw };
}

export async function buildTriageGmailClient() {
  let client_email, private_key;

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    // Vercel: env var holds the full service account JSON
    const keyJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    client_email = keyJson.client_email;
    private_key = keyJson.private_key;
  } else {
    // Local dev: read from disk
    const keyJson = JSON.parse(fs.readFileSync(LOCAL_KEY_PATH, "utf8"));
    client_email = keyJson.client_email;
    private_key = keyJson.private_key;
  }

  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    subject: JOSEPH_EMAIL,
  });

  await auth.authorize();
  return google.gmail({ version: "v1", auth });
}

/**
 * Fetch category:personal inbox threads from the last 14 days and classify each as:
 *   needs_response — last message is from someone else, no draft
 *   draft_ready    — a draft exists in the thread
 *   awaiting_reply — last message is from Joseph (filtered out, not returned)
 *
 * Returns only needs_response and draft_ready threads.
 */
export async function triageInbox(gmail) {
  const listRes = await gmail.users.threads.list({
    userId: "me",
    q: "category:personal newer_than:14d in:inbox",
    maxResults: 30,
  });

  const threadItems = listRes.data.threads || [];
  if (!threadItems.length) return [];

  const threads = await Promise.all(
    threadItems.map(({ id }) =>
      gmail.users.threads
        .get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        })
        .then((r) => r.data)
    )
  );

  const results = [];

  for (const thread of threads) {
    const messages = thread.messages || [];
    if (!messages.length) continue;

    const draftMessages = messages.filter((m) => m.labelIds?.includes("DRAFT"));
    const nonDraftMessages = messages.filter((m) => !m.labelIds?.includes("DRAFT"));
    const hasDraft = draftMessages.length > 0;

    // Determine state from the latest non-draft message
    const lastMsg = (nonDraftMessages.length ? nonDraftMessages : messages).at(-1);
    const lastHeaders = parseHeaderMap(lastMsg.payload?.headers || []);
    const rawFrom = lastHeaders["from"] || "";
    const fromJoseph = rawFrom.toLowerCase().includes("joseph.wiseman@steel-hearts.org");

    let state;
    if (hasDraft) {
      state = "draft_ready";
    } else if (fromJoseph) {
      state = "awaiting_reply";
    } else {
      state = "needs_response";
    }

    if (state === "awaiting_reply") continue;

    const firstHeaders = parseHeaderMap(messages[0].payload?.headers || []);
    const { name, email } = extractFrom(rawFrom);

    results.push({
      threadId: thread.id,
      from: rawFrom,
      fromName: name,
      fromEmail: email,
      subject: firstHeaders["subject"] || "(no subject)",
      lastMessageDate: lastHeaders["date"] || null,
      lastMessageSnippet: (lastMsg.snippet || "").slice(0, 200),
      state,
      draftId: hasDraft ? draftMessages.at(-1).id : null,
    });
  }

  return results;
}
