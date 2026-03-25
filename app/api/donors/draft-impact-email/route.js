import { NextResponse } from "next/server";
import { buildEmailSignature } from "@/lib/email-signature";

/**
 * POST /api/donors/draft-impact-email
 * Creates a Gmail draft for a Day 30 impact update email.
 * Also marks Impact_Update_Sent__c = true on the Donation__c record.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { donorName, donorEmail, amount, sfId, senderEmail, senderName } = body;

    if (!donorEmail) {
      return NextResponse.json(
        { error: "donorEmail is required" },
        { status: 400 }
      );
    }

    if (!senderEmail || !senderEmail.endsWith("@steel-hearts.org")) {
      return NextResponse.json(
        { error: "senderEmail must be a @steel-hearts.org address" },
        { status: 400 }
      );
    }

    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!serviceEmail || !serviceKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Gmail service account not configured.",
          mock: true,
        },
        { status: 200 }
      );
    }

    const displayName = donorName || "Friend";
    const amountStr = amount
      ? `$${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
      : "your generous gift";

    const subject = "Your Impact at Steel Hearts — A Quick Update";
    const signature = buildEmailSignature(senderName, senderEmail);

    const emailBody = `Dear ${displayName},

About a month ago, you made a donation of ${amountStr} to Steel Hearts. We wanted to take a moment to share how your support has made a difference.

Since your donation, Steel Hearts has continued to design, produce, and donate memorial bracelets honoring our fallen service members. Every bracelet we send to a Gold Star family carries with it the love and support of donors like you.

Your generosity helps us:
- Create personalized memorial bracelets for families of the fallen
- Donate bracelets at no cost to Gold Star families and veteran organizations
- Keep the memory of our heroes alive through tangible, lasting tributes

We are truly grateful for your continued support. If you ever want to learn more about the heroes we honor or how your donation is being used, please don't hesitate to reach out.

${signature}`;

    const { createGmailDraft } = await import("@/lib/gmail");
    const draft = await createGmailDraft({
      senderEmail,
      senderName,
      to: donorEmail,
      subject,
      body: emailBody,
    });

    // Mark impact update as sent in Salesforce
    if (sfId && process.env.SF_LIVE === "true") {
      try {
        const { sfUpdate } = await import("@/lib/salesforce");
        await sfUpdate("Donation__c", sfId, {
          Impact_Update_Sent__c: true,
          Impact_Update_Date__c: new Date().toISOString().split("T")[0],
        });
      } catch {
        // Best effort — draft was still created
      }
    }

    return NextResponse.json({
      success: true,
      draftId: draft.draftId,
      sfId,
      message: `Impact update draft created in ${senderEmail} inbox`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
