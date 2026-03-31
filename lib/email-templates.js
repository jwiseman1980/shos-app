/**
 * HTML email templates for Steel Hearts outreach.
 * Branded, mobile-responsive, clean design.
 */

const GOLD = "#C4A237";
const DARK_BG = "#1a1a2e";
const CARD_BG = "#16213e";
const TEXT = "#e0e0e0";
const TEXT_DIM = "#8a8a9a";
const WHITE = "#ffffff";

function baseLayout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Steel Hearts Foundation</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${DARK_BG}; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${DARK_BG};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 24px 0 16px 0;">
              <span style="font-size: 28px; font-weight: 700; color: ${GOLD}; letter-spacing: 0.05em; font-family: Georgia, serif;">STEEL HEARTS</span>
              <br>
              <span style="font-size: 11px; color: ${TEXT_DIM}; letter-spacing: 0.15em; text-transform: uppercase; font-family: -apple-system, sans-serif;">FOUNDATION</span>
            </td>
          </tr>
          <!-- Content Card -->
          <tr>
            <td style="background-color: ${CARD_BG}; border-radius: 8px; padding: 40px 36px; border: 1px solid #2a2a4a;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 0 0 0;">
              <p style="font-size: 11px; color: ${TEXT_DIM}; margin: 0; font-family: -apple-system, sans-serif; line-height: 1.6;">
                Steel Hearts Foundation &middot; 501(c)(3) &middot; EIN 47-2511085
                <br>
                <a href="https://steel-hearts.org" style="color: ${GOLD}; text-decoration: none;">steel-hearts.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Message outreach email — sent to bracelet customers encouraging them
 * to leave a tribute message for the hero's family.
 */
export function buildOutreachEmail({
  heroFullName,
  heroFirstName,
  bioPageUrl,
  senderName,
}) {
  const content = `
    <p style="font-size: 18px; color: ${WHITE}; margin: 0 0 24px 0; line-height: 1.5;">
      Your words could mean the world.
    </p>
    <p style="font-size: 15px; color: ${TEXT}; margin: 0 0 20px 0; line-height: 1.7;">
      Thank you for honoring <strong style="color: ${WHITE};">${heroFullName}</strong> with a Steel Hearts memorial bracelet. Your support means more than you know.
    </p>
    <p style="font-size: 15px; color: ${TEXT}; margin: 0 0 20px 0; line-height: 1.7;">
      The anniversary of ${heroFirstName}'s passing is approaching, and we're preparing something special for the family &mdash; a collection of messages from the people who carry ${heroFirstName}'s memory forward.
    </p>
    <p style="font-size: 15px; color: ${TEXT}; margin: 0 0 28px 0; line-height: 1.7;">
      Would you take a moment to share a few words? Your message will be hand-delivered to the family as part of a tribute packet. It doesn't need to be long &mdash; just sincere.
    </p>
    <!-- CTA Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 28px auto;">
      <tr>
        <td align="center" style="background-color: ${GOLD}; border-radius: 6px;">
          <a href="${bioPageUrl}#tribute" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: ${DARK_BG}; text-decoration: none; font-family: -apple-system, sans-serif; letter-spacing: 0.02em;">
            Leave a Message for the Family
          </a>
        </td>
      </tr>
    </table>
    <p style="font-size: 14px; color: ${TEXT_DIM}; margin: 0 0 28px 0; line-height: 1.6; text-align: center; font-style: italic;">
      Every message matters. The families tell us these words are among the most meaningful things they receive.
    </p>
    <hr style="border: none; border-top: 1px solid #2a2a4a; margin: 0 0 20px 0;">
    <p style="font-size: 14px; color: ${TEXT}; margin: 0; line-height: 1.6;">
      With gratitude,
      <br>
      <strong style="color: ${WHITE};">${senderName}</strong>
      <br>
      <span style="color: ${TEXT_DIM};">Steel Hearts Foundation</span>
    </p>
  `;

  const plainText = `Your words could mean the world.

Thank you for honoring ${heroFullName} with a Steel Hearts memorial bracelet. Your support means more than you know.

The anniversary of ${heroFirstName}'s passing is approaching, and we're preparing something special for the family — a collection of messages from the people who carry ${heroFirstName}'s memory forward.

Would you take a moment to share a few words? Your message will be hand-delivered to the family as part of a tribute packet. It doesn't need to be long — just sincere.

Leave your message here:
${bioPageUrl}#tribute

Every message matters. The families tell us these words are among the most meaningful things they receive.

With gratitude,
${senderName}
Steel Hearts Foundation
steel-hearts.org`;

  return {
    html: baseLayout(content),
    plainText,
    subject: `Your words could mean the world — ${heroFullName}`,
  };
}
