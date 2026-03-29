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
 * @returns {google.gmail_v1.Gmail} authenticated Gmail client
 */
export async function getGmailClient(userEmail) {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "").replace(
    /\\n/g,
    "\n"
  );

  if (!serviceEmail || !privateKey) {
    throw new Error(
      "Gmail service account not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY."
    );
  }

  const auth = new google.auth.JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/gmail.compose"],
    subject: userEmail, // impersonate this user via domain-wide delegation
  });

  await auth.authorize();

  return google.gmail({ version: "v1", auth });
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
  cc,
}) {
  const gmail = await getGmailClient(senderEmail);

  // Build RFC 2822 message
  const headers = [
    `From: ${senderName} <${senderEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=UTF-8`,
  ];

  if (cc) {
    headers.push(`Cc: ${cc}`);
  }

  const rawMessage = [...headers, "", body].join("\r\n");

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
}) {
  const gmail = await getGmailClient(senderEmail);

  const headers = [
    `From: ${senderName} <${senderEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=UTF-8`,
  ];

  const rawMessage = [...headers, "", body].join("\r\n");
  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  });

  return {
    messageId: result.data.id,
    threadId: result.data.threadId,
  };
}
