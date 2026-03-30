import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

/**
 * POST /api/anniversaries/draft-email
 * Creates an anniversary remembrance email draft in a volunteer's Gmail.
 * Updates status to "In Progress" / "email_drafted" in Supabase (primary) and Salesforce (mirror).
 *
 * Body: {
 *   heroName: "SSG John Smith",
 *   branch: "Army",
 *   years: 5,
 *   memorialDate: "2021-03-15",
 *   familyEmail: "family@example.com",
 *   familyName: "Smith Family",
 *   senderEmail: "kristin@steel-hearts.org",
 *   senderName: "Kristin Hughes",
 *   sfId: "a15V500000LNKd3IAH"
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      heroName,
      branch,
      years,
      memorialDate,
      familyEmail,
      familyName,
      senderEmail,
      senderName,
      sfId,
    } = body;

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

    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    ) {
      return NextResponse.json(
        { success: false, error: "Gmail service account not configured.", mock: true },
        { status: 200 }
      );
    }

    const { createGmailDraft } = await import("@/lib/gmail");

    const displayFamily = familyName || "Family";
    const firstName = senderName ? senderName.split(" ")[0] : "A volunteer";
    const ordinal =
      years === 1 ? "1st" :
      years === 2 ? "2nd" :
      years === 3 ? "3rd" :
      `${years}th`;

    // Build a warm, human email — not a form letter.
    // Volunteers review and personalize before sending.
    const { buildEmailSignature } = await import("@/lib/email-signature");

    let emailBody = `Hi ${displayFamily},\n\n`;
    emailBody += `I just wanted you to know that we're thinking of you today, on the ${ordinal} anniversary of ${heroName}'s passing.\n\n`;
    emailBody += `People across the country wear ${heroName}'s memorial bracelet — and through them, ${heroName}'s name is carried forward every single day. That matters, and it's because of your family's willingness to let us honor ${heroName} that it's possible.\n\n`;
    emailBody += `If you ever want to share a memory, update us on anything, or just say hi — we'd love to hear from you.\n\n`;
    emailBody += `Thinking of you,\n`;
    emailBody += buildEmailSignature(senderName, senderEmail);

    const subject = `Thinking of you — ${heroName}`;

    const draft = await createGmailDraft({
      senderEmail,
      senderName: senderName || "Steel Hearts",
      to: familyEmail,
      subject,
      body: emailBody,
    });

    // --- Update Supabase (primary) ---
    if (sfId) {
      try {
        const supabase = getServerClient();
        await supabase
          .from("heroes")
          .update({
            anniversary_status: "email_drafted",
            updated_at: new Date().toISOString(),
          })
          .eq("sf_id", sfId);
      } catch (sbErr) {
        console.warn("[draft-email] Supabase status update failed:", sbErr.message);
      }
    }

    // --- Mirror to Salesforce (backup) ---
    if (sfId && process.env.SF_LIVE === "true") {
      try {
        const { sfUpdate } = await import("@/lib/salesforce");
        await sfUpdate("Memorial_Bracelet__c", sfId, {
          Anniversary_Status__c: "In Progress",
        });
      } catch (sfErr) {
        console.warn("[draft-email] SF status update failed:", sfErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      draftId: draft.draftId,
      sfId,
      message: `Draft created in ${senderEmail} inbox`,
    });
  } catch (error) {
    console.error("Failed to create anniversary email draft:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
