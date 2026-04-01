import { google } from "googleapis";

// ---------------------------------------------------------------------------
// Gmail API client using Google Workspace domain-wide delegation.
//
// Environment variables:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL — the service account email
//   GOOGLE_SERVICE_ACCOUNT_KEY   — the private key (PEM format, with \n for newlines)
// ---------------------------------------------------------------------------

/**
 * Build an authenticated Gmail client that impersonates a @steel-hearts.org user.
 *
 * @param {string} userEmail — the @steel-hearts.org address to act on behalf of
 * @param {object} [options]
 * @param {string[]} [options.scopes] — override default scopes
 * @returns {google.gmail_v1.Gmail} authenticated Gmail client
 */
export async function getGmailClient(userEmail, { scopes } = {}) {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");

  if (!serviceEmail || !privateKey) {
    throw new Error(
      "Gmail service account not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY."
    );
  }

  const auth = new google.auth.JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: scopes || [
      "https://www.googleapis.com/auth/gmail.modify",
    ],
    subject: userEmail,
  });

  await auth.authorize();

  return google.gmail({ version: "v1", auth });
}

// ---------------------------------------------------------------------------
// Inbox read + triage functions
// ---------------------------------------------------------------------------

const JOSEPH_EMAIL = "joseph.wiseman@steel-hearts.org";

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
 * Extract plain text body from a Gmail message payload.
 */
function extractBody(payload) {
  if (!payload) return "";

  // Simple single-part message
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Multipart — find text/plain part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
      // Nested multipart (e.g., multipart/alternative inside multipart/mixed)
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
    // Fallback to text/html if no plain text
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
  }

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
export async function listInbox({ maxResults = 50, pageToken, query } = {}) {
  const gmail = await getGmailClient(JOSEPH_EMAIL);

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
export async function getMessage(messageId) {
  const gmail = await getGmailClient(JOSEPH_EMAIL);

  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = parseHeaders(msg.data.payload?.headers);
  const body = extractBody(msg.data.payload);
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
    bodyIsHtml: body.startsWith("<"),
    isUnread: labels.includes("UNREAD"),
    isStarred: labels.includes("STARRED"),
    labels,
  };
}

/**
 * Archive a message (remove INBOX label). This is the "dismiss" action.
 *
 * @param {string} messageId
 * @returns {Promise<void>}
 */
export async function archiveMessage(messageId) {
  const gmail = await getGmailClient(JOSEPH_EMAIL);

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
export async function archiveMessages(messageIds) {
  const gmail = await getGmailClient(JOSEPH_EMAIL);
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
export async function markAsRead(messageId) {
  const gmail = await getGmailClient(JOSEPH_EMAIL);

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
export async function starMessage(messageId, starred) {
  const gmail = await getGmailClient(JOSEPH_EMAIL);

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
 * @param {string} [options.cc] — optional CC address
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
}) {
  const gmail = await getGmailClient(senderEmail);

  // Determine content type and build MIME message
  let rawMessage;

  if (html) {
    // Multipart alternative: plain text + HTML
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const headers = [
      `From: ${senderName} <${senderEmail}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];
    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);

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
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=UTF-8`,
    ];
    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);

    rawMessage = [...headers, "", body].join("\r\n");
  }

  // Base64url encode
  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: encoded,
      },
    },
  });

  return {
    draftId: draft.data.id,
    messageId: draft.data.message?.id,
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
    `Subject: ${subject}`,
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
