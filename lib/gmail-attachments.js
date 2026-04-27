import { getGmailClient, MAILBOXES } from "./gmail.js";

function resolveMailbox(key) {
  return MAILBOXES[key] || MAILBOXES.joseph;
}

/**
 * List all attachments on a Gmail message.
 *
 * @param {string} messageId
 * @param {object} [options]
 * @param {string} [options.mailbox] — mailbox key (defaults to "joseph")
 * @returns {Promise<Array<{filename, mimeType, size, attachmentId}>>}
 */
export async function getMessageAttachments(messageId, { mailbox } = {}) {
  const { email } = resolveMailbox(mailbox);
  const gmail = await getGmailClient(email);

  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const attachments = [];
  function walk(parts) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        });
      }
      if (part.parts) walk(part.parts);
    }
  }

  walk(msg.data.payload?.parts);
  return attachments;
}

/**
 * Download a Gmail attachment as a Buffer of decoded bytes.
 *
 * Gmail returns attachment data as base64url-encoded; this decodes it.
 *
 * @param {string} messageId
 * @param {string} attachmentId
 * @param {object} [options]
 * @param {string} [options.mailbox] — mailbox key (defaults to "joseph")
 * @returns {Promise<Buffer>}
 */
export async function downloadAttachment(messageId, attachmentId, { mailbox } = {}) {
  const { email } = resolveMailbox(mailbox);
  const gmail = await getGmailClient(email);

  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });

  const data = (res.data.data || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(data, "base64");
}
