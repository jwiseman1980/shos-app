/**
 * Build the Megan Moore "Re: Memorial Bracelets for LTC Shah" draft.
 *
 *  1. Pull Kristin's Shah bracelet photos off message 19dcc1de68bb14f6 (Gmail)
 *  2. Pull Ryan's updated SVGs (USA-SHAH-6, USA-SHAH-7) from Slack
 *  3. Create a Gmail draft on thread 19d92158459acab3 with everything attached
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from the worktree first, then the canonical app dir.
const envCandidates = [
  join(__dirname, "../.env.local"),
  "C:/dev/AI Projects/SHOS/shos-app/.env.local",
];
for (const path of envCandidates) {
  try {
    const text = readFileSync(path, "utf8");
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx === -1) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
    console.log(`[env] loaded ${path}`);
    break;
  } catch {}
}

const { getGmailClient, createGmailDraft, getThread } = await import("../lib/gmail.js");
const { getMessageAttachments, downloadAttachment } = await import(
  "../lib/gmail-attachments.js"
);

const SENDER_EMAIL = "joseph.wiseman@steel-hearts.org";
const SENDER_NAME = "Joseph Wiseman";
const TO = "m6moore@odu.edu";
const CC = "spencer@flybbsf.org";
const SUBJECT = "Re: Memorial Bracelets for LTC Shah";
const THREAD_ID = "19d92158459acab3";
const KRISTIN_MSG_ID = "19dcc1de68bb14f6";

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_FILES = [
  { id: "F0AUU36S423", filename: "USA-SHAH-6.svg", mimeType: "image/svg+xml" },
  { id: "F0AV64RV3CM", filename: "USA-SHAH-7.svg", mimeType: "image/svg+xml" },
];

const BODY = `Hi Megan,

Apologies for the delay in getting back to you. Attached are the updated bracelet designs incorporating "Be Bold. Be Quick. Be Gone." — one for each size (7" and 6"). I've also included photos of an actual finished bracelet so you can see what they look like in hand.

Please review and let us know if everything looks good or if you'd like any changes. Once you approve, we'll move straight to production.

To answer your questions — our bracelets come in one color, brushed stainless steel. They're built to last.

We are donating all 175 bracelets at no cost — no need to pay for the additional 25.

We've noted Mrs. Shah's request regarding the GoFundMe and will direct future proceeds accordingly.

Regarding the May 18 event — I'll be attending with one guest in one vehicle. We're honored to be part of it.

Once we get your green light on the design, we'll have them produced and shipped well before the event.

Joe`;

async function fetchSlackFile({ id, filename, mimeType }) {
  if (!SLACK_TOKEN) throw new Error("SLACK_BOT_TOKEN not set");
  const infoRes = await fetch(`https://slack.com/api/files.info?file=${id}`, {
    headers: { Authorization: `Bearer ${SLACK_TOKEN}` },
  });
  const info = await infoRes.json();
  if (!info.ok) throw new Error(`slack files.info(${id}): ${info.error}`);

  const dlUrl = info.file.url_private_download || info.file.url_private;
  if (!dlUrl) throw new Error(`slack file ${id}: no download url`);

  const dlRes = await fetch(dlUrl, {
    headers: { Authorization: `Bearer ${SLACK_TOKEN}` },
  });
  if (!dlRes.ok) throw new Error(`slack download ${id}: HTTP ${dlRes.status}`);

  const buf = Buffer.from(await dlRes.arrayBuffer());
  if (buf.length < 100) throw new Error(`slack file ${id}: suspiciously small (${buf.length}B)`);
  console.log(`[slack] ${filename}: ${buf.length}B`);
  return { filename, mimeType, content: buf };
}

async function fetchGmailAttachments() {
  const list = await getMessageAttachments(KRISTIN_MSG_ID);
  if (!list.length) throw new Error(`no attachments on message ${KRISTIN_MSG_ID}`);

  const out = [];
  for (const att of list) {
    const buf = await downloadAttachment(KRISTIN_MSG_ID, att.attachmentId);
    console.log(`[gmail] ${att.filename}: ${buf.length}B (${att.mimeType})`);
    out.push({
      filename: att.filename,
      mimeType: att.mimeType,
      content: buf,
    });
  }
  return out;
}

async function getInReplyTo() {
  // Use the latest message in the Megan thread as the In-Reply-To target
  // so Gmail keeps the draft inside the same conversation.
  const { messages } = await getThread(THREAD_ID);
  if (!messages.length) return null;
  const last = messages[messages.length - 1];
  const gmail = await getGmailClient(SENDER_EMAIL);
  const meta = await gmail.users.messages.get({
    userId: "me",
    id: last.id,
    format: "metadata",
    metadataHeaders: ["Message-ID", "Message-Id"],
  });
  const headers = meta.data.payload?.headers || [];
  const msgId =
    headers.find((h) => h.name.toLowerCase() === "message-id")?.value || null;
  return msgId;
}

async function main() {
  console.log("[1/4] Downloading Kristin's photos from Gmail…");
  const photos = await fetchGmailAttachments();

  console.log("[2/4] Downloading Ryan's SVGs from Slack…");
  const svgs = [];
  for (const f of SLACK_FILES) svgs.push(await fetchSlackFile(f));

  console.log("[3/4] Resolving In-Reply-To from Megan thread…");
  const inReplyTo = await getInReplyTo();
  console.log(`      In-Reply-To: ${inReplyTo || "(none — draft will start fresh)"}`);

  // SVGs first (the design is the headline), then photos.
  const attachments = [...svgs, ...photos];

  console.log(`[4/4] Creating Gmail draft with ${attachments.length} attachments…`);
  const result = await createGmailDraft({
    senderEmail: SENDER_EMAIL,
    senderName: SENDER_NAME,
    to: TO,
    cc: CC,
    subject: SUBJECT,
    body: BODY,
    threadId: THREAD_ID,
    inReplyTo,
    attachments,
  });

  console.log("[done] draft created:", result);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
