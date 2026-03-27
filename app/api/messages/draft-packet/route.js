import { NextResponse } from "next/server";

/**
 * POST /api/messages/draft-packet
 * Creates a Gmail draft containing a supporter message packet for a Gold Star family.
 *
 * Body: {
 *   braceletId: "a08...",
 *   heroName: "CPT Drew Ross",
 *   familyName: "Ross Family",
 *   familyEmail: "family@example.com",
 *   senderEmail: "joseph@steel-hearts.org",
 *   senderName: "Joseph Wiseman",
 *   messageIds: ["a14...", "a14...", ...]
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      braceletId,
      heroName,
      familyName,
      familyEmail,
      senderEmail,
      senderName,
      messageIds,
    } = body;

    // Validation
    if (!senderEmail || !senderEmail.endsWith("@steel-hearts.org")) {
      return NextResponse.json(
        { error: "senderEmail must be a @steel-hearts.org address" },
        { status: 400 }
      );
    }

    if (!familyEmail) {
      return NextResponse.json(
        { error: "familyEmail is required" },
        { status: 400 }
      );
    }

    if (!messageIds || messageIds.length === 0) {
      return NextResponse.json(
        { error: "messageIds is required (at least one message)" },
        { status: 400 }
      );
    }

    // Check Gmail config
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Gmail service account not configured.",
          mock: true,
        },
        { status: 200 }
      );
    }

    // Fetch messages from Salesforce
    const { sfQuery, sfUpdate } = await import("@/lib/salesforce");

    // Build SOQL IN clause — escape single quotes in IDs
    const idList = messageIds.map((id) => `'${id.replace(/'/g, "\\'")}'`).join(",");
    const records = await sfQuery(
      `SELECT Id, Message__c, From_Name__c, From_Email__c, Status__c, Consent_to_Share__c
       FROM Family_Message__c
       WHERE Id IN (${idList})`
    );

    // Filter to only messages that haven't already been sent
    const validMessages = records.filter(
      (r) => r.Status__c !== "Sent"
    );

    if (validMessages.length === 0) {
      return NextResponse.json(
        { error: "No unsent messages found for the provided IDs" },
        { status: 400 }
      );
    }

    // Map SF records to the format the packet builder expects
    const messages = validMessages.map((r) => ({
      sfId: r.Id,
      message: r.Message__c,
      fromName: r.From_Name__c,
      fromEmail: r.From_Email__c,
      consentToShare: r.Consent_to_Share__c,
    }));

    // Build packet
    const { buildMessagePacket } = await import("@/lib/message-packet");
    const packet = buildMessagePacket({
      heroName,
      familyName,
      familyEmail,
      messages,
      senderName: senderName || "Steel Hearts",
      senderEmail,
    });

    // Create Gmail draft
    const { createGmailDraft } = await import("@/lib/gmail");
    const draft = await createGmailDraft({
      senderEmail,
      senderName: senderName || "Steel Hearts",
      to: familyEmail,
      subject: packet.subject,
      body: packet.body,
    });

    // Update message statuses to "Sent" in Salesforce
    if (process.env.SF_LIVE === "true") {
      let sfUpdated = 0;
      for (const msg of messages) {
        try {
          await sfUpdate("Family_Message__c", msg.sfId, {
            Status__c: "Sent",
          });
          sfUpdated++;
        } catch (sfErr) {
          console.warn(
            `SF status update failed for ${msg.sfId}:`,
            sfErr.message
          );
          // Don't fail — the draft was already created
        }
      }
      console.log(
        `Updated ${sfUpdated}/${messages.length} messages to Sent for ${heroName}`
      );
    }

    return NextResponse.json({
      success: true,
      draftId: draft.draftId,
      messageCount: messages.length,
      heroName,
      familyEmail,
      message: `Draft created in ${senderEmail} inbox with ${messages.length} messages`,
    });
  } catch (error) {
    console.error("Failed to create message packet draft:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
