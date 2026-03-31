/**
 * SendGrid email service — bulk transactional + marketing email.
 * Used for customer outreach, newsletters, order confirmations,
 * shipping notifications, and any high-volume sends.
 *
 * Gmail API still handles 1:1 family emails (personal, need human review).
 *
 * Setup:
 * 1. Sign up at sendgrid.com (apply for nonprofit program)
 * 2. Verify steel-hearts.org domain (DKIM, SPF records)
 * 3. Create API key with "Mail Send" permission
 * 4. Add SENDGRID_API_KEY to Vercel env vars
 *
 * Sending domain: hello@steel-hearts.org (or noreply@steel-hearts.org)
 */

import sgMail from "@sendgrid/mail";

let _initialized = false;

function init() {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY not configured");
  }
  if (!_initialized) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    _initialized = true;
  }
}

/**
 * Send a single email via SendGrid.
 */
export async function sendEmail({ from, to, subject, html, text, replyTo, categories }) {
  init();

  const msg = {
    to: Array.isArray(to) ? to : [to],
    from: from || { email: "hello@steel-hearts.org", name: "Steel Hearts Foundation" },
    subject,
    ...(html && { html }),
    ...(text && { text }),
    replyTo: replyTo || "joseph.wiseman@steel-hearts.org",
    ...(categories && { categories }),
  };

  const [response] = await sgMail.send(msg);
  return {
    statusCode: response.statusCode,
    messageId: response.headers["x-message-id"],
  };
}

/**
 * Send a batch of personalized emails via SendGrid.
 * Each recipient gets their own individual email.
 *
 * SendGrid's sendMultiple handles up to 1,000 recipients per call.
 * For larger lists, we chunk automatically.
 *
 * @param {Array<{to, subject, html, text}>} emails — array of email payloads
 * @param {object} defaults — shared defaults (from, replyTo, categories)
 * @returns {object} { sent, failed, errors }
 */
export async function sendBatch(emails, defaults = {}) {
  init();

  const from = defaults.from || { email: "hello@steel-hearts.org", name: "Steel Hearts Foundation" };
  const replyTo = defaults.replyTo || "joseph.wiseman@steel-hearts.org";
  const categories = defaults.categories || [];

  // SendGrid recommends max 1,000 per API call
  const BATCH_SIZE = 1000;
  let sent = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);

    const messages = chunk.map((e) => ({
      to: Array.isArray(e.to) ? e.to : [e.to],
      from,
      subject: e.subject,
      ...(e.html && { html: e.html }),
      ...(e.text && { text: e.text }),
      replyTo,
      categories,
    }));

    try {
      await sgMail.send(messages);
      sent += chunk.length;
    } catch (err) {
      // SendGrid may return partial success info
      const sgError = err.response?.body?.errors;
      failed += chunk.length;
      errors.push({
        batch: Math.floor(i / BATCH_SIZE),
        error: sgError ? sgError.map((e) => e.message).join("; ") : err.message,
      });
    }
  }

  return { sent, failed, errors };
}

/**
 * Send using SendGrid's personalizations for true batch efficiency.
 * One API call, one template, many recipients — each gets their own copy.
 * Best for outreach where the email content is identical for all recipients.
 *
 * @param {object} options
 * @param {string[]} options.recipients — array of email addresses
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} options.text
 * @param {string} [options.fromEmail]
 * @param {string} [options.fromName]
 * @param {string[]} [options.categories]
 * @returns {object} { sent, messageId }
 */
export async function sendToMany({
  recipients,
  subject,
  html,
  text,
  fromEmail,
  fromName,
  categories,
}) {
  init();

  // SendGrid personalizations: max 1,000 per message
  const CHUNK_SIZE = 1000;
  let totalSent = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + CHUNK_SIZE);

    const msg = {
      personalizations: chunk.map((email) => ({
        to: [{ email }],
      })),
      from: {
        email: fromEmail || "hello@steel-hearts.org",
        name: fromName || "Steel Hearts Foundation",
      },
      subject,
      content: [
        ...(text ? [{ type: "text/plain", value: text }] : []),
        ...(html ? [{ type: "text/html", value: html }] : []),
      ],
      replyTo: { email: "joseph.wiseman@steel-hearts.org" },
      ...(categories && { categories }),
    };

    try {
      await sgMail.send(msg);
      totalSent += chunk.length;
    } catch (err) {
      const sgError = err.response?.body?.errors;
      errors.push({
        chunk: Math.floor(i / CHUNK_SIZE),
        error: sgError ? sgError.map((e) => e.message).join("; ") : err.message,
      });
    }
  }

  return { sent: totalSent, failed: recipients.length - totalSent, errors };
}

/**
 * Check if SendGrid is configured and ready to use.
 */
export function isSendGridConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY);
}
