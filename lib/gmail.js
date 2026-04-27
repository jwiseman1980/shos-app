import { google } from "googleapis";
import fs from "fs";

// ---------------------------------------------------------------------------
// RFC 2047 encoded-word helper for email headers.
// Non-ASCII characters (em dashes, accented names, etc.) must be encoded
// in MIME headers or they'll display as mojibake (e.g. Ã¢Â€Â").
// ---------------------------------------------------------------------------
function encodeHeaderValue(text) {
  if (/[^\x00-\x7F]/.test(text)) {
    return `=?UTF-8?B?${Buffer.from(text, "utf-8").toString("base64")}?=`;
  }
  return text;
}

// ---------------------------------------------------------------------------
// Gmail API client using Google Workspace domain-wide delegation.
//
// Credential resolution order:
//   1. GOOGLE_SERVICE_ACCOUNT_KEY env var as full SA JSON (Vercel format)
//   2. GOOGLE_SERVICE_ACCOUNT_KEY as raw PEM + GOOGLE_SERVICE_ACCOUNT_EMAIL
//   3. Local file at C:/Users/JosephWiseman/.secrets/shos-signer.json
// ---------------------------------------------------------------------------

const LOCAL_KEY_PATH = "C:/Users/JosephWiseman/.secrets/shos-signer.json";

function loadCredentials() {
  const keyEnvVar = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (keyEnvVar) {
    // Try parsing as full SA JSON key file (Vercel env var format)
    try {
      const keyJson = JSON.parse(keyEnvVar);
      return {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || keyJson.client_email,
        private_key: keyJson.private_key,
      };
    } catch {
      // Fall back: treat as raw PEM key string with separate email env var
      return {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: keyEnvVar.replace(/^"|"$/g, "").replace(/\\n/g, "\n"),
      };
    }
  }

  // Local dev: read from disk
  try {
    const keyJson = JSON.parse(fs.readFileSync(LOCAL_KEY_PATH, "utf8"));
    return { client_email: keyJson.client_email, private_key: keyJson.private_key };
  } catch {
    throw new Error(
      `Gmail service account not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY or provide ${LOCAL_KEY_PATH}`
    );
  }
}

/**
 * Build an authenticated Gmail client that impersonates a @steel-hearts.org user.
 *
 * @param {string} userEmail — the @steel-hearts.org address to act on behalf of
 * @param {object} [options]
 * @param {string[]} [options.scopes] — override default scopes
 * @returns {google.gmail_v1.Gmail} authenticated Gmail client
 */
export async function getGmailClient(userEmail, { scopes } = {}) {
  const { client_email, private_key } = loadCredentials();

  if (!client_email || !private_key) {
    throw new Error("Gmail service account credentials incomplete.");
  }

  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: scopes || ["https://www.googleapis.com/auth/gmail.modify"],
    subject: userEmail,
  });

  await auth.authorize();
  console.log(`[gmail] Authenticated, impersonating: ${userEmail}`);

  return google.gmail({ version: "v1", auth });
}

// ---------------------------------------------------------------------------
// Mailbox configuration — all @steel-hearts.org addresses accessible via
// domain-wide delegation. Add new mailboxes here as needed.
// ---------------------------------------------------------------------------

const MAILBOXES = {
  joseph:  { email: "joseph.wiseman@steel-hearts.org", name: "Joseph Wiseman" },
  contact: { email: "contact@steel-hearts.org", name: "Steel Hearts Customer Service" },
};

export { MAILBOXES };

function resolveMailbox(key) {
  return MAILBOXES[key] || MAILBOXES.joseph;
}

// ---------------------------------------------------------------------------
// Inbox read + triage functions
// ---------------------------------------------------------------------------

/**
 * Parse email headers into a clean object.
 */
function parseHeaders(headers = []) {
  const get = (name) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  return {
    from: get("From"),
    to: get("To"),
    subject: get("Subject"),
    date: get("Date"),
    replyTo: get("Reply-To"),
  };
}

/**
 * Extract attachment metadata from a Gmail message payload.
 * Returns array of { filename, mimeType, size, attachmentId } objects.
 */
function extractAttachments(payload) {
  const attachments = [];
  if (!payload) return attachments;

  function walk(parts) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          size: part.body?.size || 0,
          attachmentId: part.body?.attachmentId || null,
        });
      }
      if (part.parts) walk(part.parts);
    }
  }

  walk(payload.parts);
  return attachments;
}

/**
 * Extract plain text body from a Gmail message payload.
 */
function extractBody(payload) {
  if (!payload) return "";

  // Simple single-part message
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Collect all text parts recursively
  function collectParts(node, results = { plain: [], html: [] }) {
    if (!node) return results;
    if (node.mimeType === "text/plain" && node.body?.data) {
      results.plain.push(Buffer.from(node.body.data, "base64").toString("utf-8"));
    }
    if (node.mimeType === "text/html" && node.body?.data) {
      results.html.push(Buffer.from(node.body.data, "base64").toString("utf-8"));
    }
    if (node.parts) {
      for (const part of node.parts) {
        collectParts(part, results);
      }
    }
    return results;
  }

  const parts = collectParts(payload);
  // Prefer plain text, fall back to HTML
  if (parts.plain.length > 0) return parts.plain[0];
  if (parts.html.length > 0) return parts.html[0];

  return "";
}

/**
 * List inbox messages (not archived, not spam/trash).
 *
 * @param {object} [options]
 * @param {number} [options.maxResults=50] — max messages to return
 * @param {string} [options.pageToken] — for pagination
 * @param {string} [options.query] — additional Gmail search query
 * @returns {Promise<{ messages: Array, nextPageToken: string|null }>}
 */
export async function listInbox({ maxResults = 50, pageToken, query, mailbox } = {}) {
  const resolved = resolveMailbox(mailbox);
  console.log(`[gmail] listInbox called — mailbox param: "${mailbox}", resolved email: "${resolved.email}"`);
  const gmail = await getGmailClient(resolved.email);

  const q = ["in:inbox", query || ""].filter(Boolean).join(" ");

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults,
    pageToken: pageToken || undefined,
  });

  const messageIds = listRes.data.messages || [];
  const nextPageToken = listRes.data.nextPageToken || null;

  if (messageIds.length === 0) {
    return { messages: [], nextPageToken: null };
  }

  // Fetch message details in parallel (metadata + snippet)
  const messages = await Promise.all(
    messageIds.map(async ({ id }) => {
      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date", "Reply-To"],
        });

        const headers = parseHeaders(msg.data.payload?.headers);
        const labels = msg.data.labelIds || [];

        return {
          id: msg.data.id,
          threadId: msg.data.threadId,
          snippet: msg.data.snippet || "",
          from: headers.from,
          to: headers.to,
          subject: headers.subject,
          date: headers.date,
          replyTo: headers.replyTo,
          isUnread: labels.includes("UNREAD"),
          isStarred: labels.includes("STARRED"),
          isImportant: labels.includes("IMPORTANT"),
          labels,
        };
      } catch (err) {
        console.error(`Failed to fetch message ${id}:`, err.message);
        return null;
      }
    })
  );

  return {
    messages: messages.filter(Boolean),
    nextPageToken,
  };
}

/**
 * Get full message content (for reading an email).
 *
 * @param {string} messageId
 * @returns {Promise<object>} full message with body
 */
export async function getMessage(messageId, { mailbox } = {}) {
  const { email } = resolveMailbox(mailbox);
  const gmail = await getGmailClient(email);

  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = parseHeaders(msg.data.payload?.headers);
  const body = extractBody(msg.data.payload);
  const attachments = extractAttachments(msg.data.payload);
  const labels = msg.data.labelIds || [];

  return {
    id: msg.data.id,
    threadId: msg.data.threadId,
    snippet: msg.data.snippet || "",
    from: headers.from,
    to: headers.to,
    subject: headers.subject,
    date: headers.date,
    replyTo: headers.replyTo,
    body,
    bodyIsHtml: body.startsWith("<") || /<[a-z][\s\S]*>/i.test(body.slice(0, 500)),
    isUnread: labels.includes("UNREAD"),
    isStarred: labels.includes("STARRED"),
    labels,
    attachments,
  };
}

/**
 * Archive a message (remove INBOX label). This is the "dismiss" action.
 *
 * @param {string} messageId
 * @returns {Promise<void>}
 */
export async function archiveMessage(messageId, { mailbox } = {}) {
  const { email } = resolveMailbox(mailbox);
  const gmail = await getGmailClient(email);

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["INBOX"],
    },
  });
}

/**
 * Archive multiple messages at once.
 *
 * @param {string[]} messageIds
 * @returns {Promise<{ archived: number, errors: number }>}
 */
export async function archiveMessages(messageIds, { mailbox } = {}) {
  const { email } = resolveMailbox(mailbox);
  const gmail = await getGmailClient(email);
  let archived = 0;
  let errors = 0;

  await Promise.all(
    messageIds.map(async (id) => {
      try {
        await gmail.users.messages.modify({
          userId: "me",
          id,
          requestBody: { removeLabelIds: ["INBOX"] },
        });
        archived++;
      } catch {
        errors++;
      }
    })
  );

  return { archived, errors };
}

/**
 * Mark a message as read.
 *
 * @param {string} messageId
 * @returns {Promise<void>}
 */
export async function markAsRead(messageId, { mailbox } = {}) {
  const { email } = resolveMailbox(mailbox);
  const gmail = await getGmailClient(email);

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });
}

/**
 * Star/unstar a message.
 *
 * @param {string} messageId
 * @param {boolean} starred
 * @returns {Promise<void>}
 */
export async function starMessage(messageId, starred, { mailbox } = {}) {
  const { email } = resolveMailbox(mailbox);
  const gmail = await getGmailClient(email);

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: starred
      ? { addLabelIds: ["STARRED"] }
      : { removeLabelIds: ["STARRED"] },
  });
}

/**
 * Create a draft email in a user's Gmail account.
 *
 * @param {object} options
 * @param {string} options.senderEmail — @steel-hearts.org address (the "from" / impersonated user)
 * @param {string} options.senderName — display name for the From header
 * @param {string} options.to — recipient email
 * @param {string} options.subject — email subject
 * @param {string} options.body — plain-text email body
 * @param {string} [options.html] — optional HTML body (sent as multipart/alternative)
 * @param {string} [options.cc] — optional CC address
 * @param {string} [options.bcc] — optional BCC address
 * @param {string} [options.threadId] — Gmail thread ID to attach the draft to (keeps it in an existing conversation)
 * @param {string} [options.inReplyTo] — RFC 822 Message-ID to set on the In-Reply-To/References headers
 * @param {Array<{ filename: string, mimeType: string, content: Buffer }>} [options.attachments]
 * @returns {Promise<object>} Gmail API draft response
 */
export async function createGmailDraft({
  senderEmail,
  senderName,
  to,
  subject,
  body,
  html,
  cc,
  bcc,
  threadId,
  inReplyTo,
  attachments,
}) {
  const gmail = await getGmailClient(senderEmail);

  // Determine content type and build MIME message
  let rawMessage;
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  // Threading headers — applied to whichever code path we take below.
  function applyThreadingHeaders(headers) {
    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`);
      headers.push(`References: ${inReplyTo}`);
    }
  }

  if (hasAttachments) {
    // multipart/mixed wrapping the body (alternative or plain) + each attachment
    const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const headers = [
      `From: ${senderName} <${senderEmail}>`,
      `To: ${to}`,
      `Subject: ${encodeHeaderValue(subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    ];
    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);
    applyThreadingHeaders(headers);

    const parts = [];

    if (html) {
      const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const plainText = body || html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
      parts.push(
        `--${mixedBoundary}`,
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        "",
        `--${altBoundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        "",
        plainText,
        `--${altBoundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        "",
        html,
        `--${altBoundary}--`,
      );
    } else {
      parts.push(
        `--${mixedBoundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        "",
        body || "",
      );
    }

    for (const att of attachments) {
      const encoded = Buffer.from(att.content).toString("base64");
      // Wrap base64 at 76 chars per RFC 2045
      const wrapped = encoded.match(/.{1,76}/g).join("\r\n");
      parts.push(
        `--${mixedBoundary}`,
        `Content-Type: ${att.mimeType}; name="${att.filename}"`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        "",
        wrapped,
      );
    }

    parts.push(`--${mixedBoundary}--`);

    rawMessage = [...headers, "", ...parts].join("\r\n");
  } else if (html) {
    // Multipart alternative: plain text + HTML
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const headers = [
      `From: ${senderName} <${senderEmail}>`,
      `To: ${to}`,
      `Subject: ${encodeHeaderValue(subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];
    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);
    applyThreadingHeaders(headers);

    const plainText = body || html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");

    rawMessage = [
      ...headers,
      "",
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      "",
      plainText,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      "",
      html,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    // Plain text only
    const headers = [
      `From: ${senderName} <${senderEmail}>`,
      `To: ${to}`,
      `Subject: ${encodeHeaderValue(subject)}`,
      `Content-Type: text/plain; charset=UTF-8`,
    ];
    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);
    applyThreadingHeaders(headers);

    rawMessage = [...headers, "", body].join("\r\n");
  }

  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const message = { raw: encoded };
  if (threadId) message.threadId = threadId;

  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message },
  });

  return {
    draftId: draft.data.id,
    messageId: draft.data.message?.id,
    threadId: draft.data.message?.threadId,
  };
}

/**
 * Send an email directly (not as draft) from a @steel-hearts.org account.
 * Used for internal notifications — assignment alerts, task reminders, etc.
 *
 * @param {object} options
 * @param {string} options.senderEmail — @steel-hearts.org address
 * @param {string} options.senderName — display name
 * @param {string} options.to — recipient email
 * @param {string} options.subject — email subject
 * @param {string} options.body — plain-text email body
 * @returns {Promise<object>} Gmail API send response
 */
export async function sendGmailMessage({
  senderEmail,
  senderName,
  to,
  subject,
  body,
  threadId,
  inReplyTo,
}) {
  const gmail = await getGmailClient(senderEmail);

  const headers = [
    `From: ${senderName} <${senderEmail}>`,
    `To: ${to}`,
    `Subject: ${encodeHeaderValue(subject)}`,
    `Content-Type: text/plain; charset=UTF-8`,
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  const rawMessage = [...headers, "", body].join("\r\n");
  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const requestBody = { raw: encoded };
  if (threadId) requestBody.threadId = threadId;

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody,
  });

  return {
    messageId: result.data.id,
    threadId: result.data.threadId,
  };
}

/**
 * Download an email attachment as a Buffer.
 *
 * @param {string} messageId — the Gmail message ID
 * @param {string} attachmentId — the attachment ID from getMessage().attachments
 * @param {object} [options]
 * @param {string} [options.mailbox] — mailbox key (defaults to "joseph")
 * @returns {Promise<Buffer>} raw file content
 */
export async function getAttachment(messageId, attachmentId, { mailbox } = {}) {
  const { email } = resolveMailbox(mailbox);
  const gmail = await getGmailClient(email);

  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });

  // Gmail returns base64url-encoded data
  const data = res.data.data
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Buffer.from(data, "base64");
}

// ---------------------------------------------------------------------------
// Thread-based inbox functions
// ---------------------------------------------------------------------------

/**
 * List inbox threads with summary info (for thread-based inbox view).
 *
 * @param {object} [options]
 * @param {number} [options.maxResults=30]
 * @param {string} [options.pageToken]
 * @param {string} [options.query]
 * @param {string} [options.mailbox]
 * @returns {Promise<{ threads: Array, nextPageToken: string|null }>}
 */
export async function listInboxThreads({ maxResults = 30, pageToken, query, mailbox } = {}) {
  const resolved = resolveMailbox(mailbox);
  const gmail = await getGmailClient(resolved.email);

  const q = ["in:inbox", query || ""].filter(Boolean).join(" ");

  const listRes = await gmail.users.threads.list({
    userId: "me",
    q,
    maxResults,
    pageToken: pageToken || undefined,
  });

  const threadItems = listRes.data.threads || [];
  const nextPageToken = listRes.data.nextPageToken || null;

  if (!threadItems.length) return { threads: [], nextPageToken: null };

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
        .catch(() => null)
    )
  );

  const result = threads
    .filter(Boolean)
    .map((thread) => {
      const messages = thread.messages || [];
      if (!messages.length) return null;

      const lastMsg = messages[messages.length - 1];
      const firstMsg = messages[0];
      const firstHeaders = parseHeaders(firstMsg.payload?.headers || []);
      const lastHeaders = parseHeaders(lastMsg.payload?.headers || []);

      return {
        threadId: thread.id,
        messageCount: messages.length,
        subject: firstHeaders.subject || "(no subject)",
        from: lastHeaders.from,
        snippet: lastMsg.snippet || "",
        date: lastHeaders.date,
        isUnread: messages.some((m) => m.labelIds?.includes("UNREAD")),
        isStarred: messages.some((m) => m.labelIds?.includes("STARRED")),
      };
    })
    .filter(Boolean);

  return { threads: result, nextPageToken };
}

/**
 * Get all messages in a thread with full body content.
 *
 * @param {string} threadId
 * @param {object} [options]
 * @param {string} [options.mailbox]
 * @returns {Promise<{ threadId: string, messages: Array }>}
 */
export async function getThread(threadId, { mailbox } = {}) {
  const { email } = resolveMailbox(mailbox);
  const gmail = await getGmailClient(email);

  const thread = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const messages = (thread.data.messages || []).map((msg) => {
    const headers = parseHeaders(msg.payload?.headers || []);
    const body = extractBody(msg.payload);
    const attachments = extractAttachments(msg.payload);
    const labels = msg.labelIds || [];

    return {
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet || "",
      from: headers.from,
      to: headers.to,
      subject: headers.subject,
      date: headers.date,
      body,
      bodyIsHtml: body.startsWith("<") || /<[a-z][\s\S]*>/i.test(body.slice(0, 500)),
      isUnread: labels.includes("UNREAD"),
      isDraft: labels.includes("DRAFT"),
      labels,
      attachments,
    };
  });

  return { threadId: thread.data.id, messages };
}

/**
 * Archive a thread (remove INBOX label from all messages).
 *
 * @param {string} threadId
 * @param {object} [options]
 * @param {string} [options.mailbox]
 */
export async function archiveThread(threadId, { mailbox } = {}) {
  const { email } = resolveMailbox(mailbox);
  const gmail = await getGmailClient(email);

  await gmail.users.threads.modify({
    userId: "me",
    id: threadId,
    requestBody: { removeLabelIds: ["INBOX"] },
  });
}
