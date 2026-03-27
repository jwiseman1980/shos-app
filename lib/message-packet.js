/**
 * Message Packet Builder — FM-STD-003 / FM-STD-004 compliant
 *
 * Formats supporter messages into an email body for delivery to Gold Star families.
 * The email template wording is intentionally a placeholder — Joseph will craft the
 * final version. The function accepts a templateOverride to swap the intro/outro
 * without code changes.
 */

import { repairMojibake } from "@/lib/text-repair";
import { buildEmailSignature } from "@/lib/email-signature";

// ---------------------------------------------------------------------------
// Default template — PLACEHOLDER. Joseph will write the real one.
// ---------------------------------------------------------------------------
const DEFAULT_INTRO = `[DRAFT TEMPLATE — UPDATE BEFORE SENDING]

Dear {familyName},

We are reaching out to share messages written by people who were moved by {heroName}'s story. These are their words — offered in honor of {heroName}'s service and sacrifice.

We hope they bring some comfort knowing how many lives {heroName} continues to touch.

`;

const DEFAULT_OUTRO = `
These messages were collected over time from people across the country who wanted your family to know that {heroName} is not forgotten.

`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a complete email packet for a Gold Star family.
 *
 * @param {object} opts
 * @param {string} opts.heroName — the fallen hero's display name
 * @param {string} opts.familyName — "Smith Family" or similar
 * @param {string} opts.familyEmail — delivery target
 * @param {Array}  opts.messages — array of message objects from SF
 * @param {string} opts.senderName — volunteer / staff name
 * @param {string} opts.senderEmail — @steel-hearts.org address
 * @param {object} [opts.templateOverride] — { intro, outro } to replace defaults
 * @returns {{ subject: string, body: string, messageCount: number }}
 */
export function buildMessagePacket({
  heroName,
  familyName,
  familyEmail,
  messages,
  senderName,
  senderEmail,
  templateOverride,
}) {
  const displayFamily = familyName || "Family";
  const displayHero = heroName || "your loved one";

  // Template with token replacement
  const intro = (templateOverride?.intro || DEFAULT_INTRO)
    .replace(/\{familyName\}/g, displayFamily)
    .replace(/\{heroName\}/g, displayHero);

  const outro = (templateOverride?.outro || DEFAULT_OUTRO)
    .replace(/\{familyName\}/g, displayFamily)
    .replace(/\{heroName\}/g, displayHero);

  // Format messages
  const messageSection = formatMessageBody(messages);

  // Signature
  const signature = buildEmailSignature(senderName, senderEmail);

  const body = `${intro}${"─".repeat(40)}\n\n${messageSection}${"─".repeat(40)}\n${outro}${signature}`;

  const subject = `Messages of Support for ${displayHero} — Steel Hearts`;

  return {
    subject,
    body,
    messageCount: messages.length,
  };
}

/**
 * Format the message body section — one block per supporter.
 * Implements FM-STD-004 text normalization.
 */
export function formatMessageBody(messages) {
  if (!messages || messages.length === 0) return "(No messages)\n";

  return messages
    .map((msg) => {
      const senderName = msg.fromName || "A Supporter";
      const cleanMessage = normalizeMessageText(msg.message || "");

      let block = `${senderName.toUpperCase()}\n`;

      // Only show email if consent was given
      if (msg.consentToShare && msg.fromEmail) {
        block += `${msg.fromEmail}\n`;
      }

      block += `\n${cleanMessage}\n\n`;
      return block;
    })
    .join(`${"─".repeat(40)}\n\n`);
}

/**
 * Normalize message text per FM-STD-004.
 * - Repair mojibake (double-encoded UTF-8)
 * - Strip [nan] artifacts
 * - Strip timestamps from message bodies
 * - Extract angle-bracket emails
 * - Collapse whitespace
 */
export function normalizeMessageText(text) {
  if (!text) return "";

  let t = text;

  // Repair mojibake
  t = repairMojibake(t);

  // Strip [nan] artifacts
  t = t.replace(/\[nan\]/gi, "");

  // Strip timestamp patterns (e.g., "2024-03-15 10:23:45" or "Mar 15, 2024 10:23 AM")
  t = t.replace(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?\s*/g, "");
  t = t.replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\s*/gi, "");

  // Extract and remove angle-bracket emails from body (they belong in the email field, not body)
  t = t.replace(/<[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}>/g, "");

  // Collapse multiple spaces and newlines
  t = t.replace(/\n{3,}/g, "\n\n");
  t = t.replace(/  +/g, " ");

  return t.trim();
}
