import { NextResponse } from "next/server";

/**
 * POST /api/donors/draft-email
 * Creates a thank-you email draft in a volunteer's @steel-hearts.org Gmail account.
 *
 * Body: {
 *   donorName: "John Smith",
 *   donorEmail: "john@example.com",
 *   amount: 100,
 *   donationDate: "2026-03-04T02:08:33.000+0000",
 *   isRepeatDonor: false,
 *   senderEmail: "kristin@steel-hearts.org",  // volunteer's @steel-hearts.org address
 *   senderName: "Kristin Hughes",              // volunteer display name
 *   sfId: "a15V500000LNKd3IAH"                // for tracking
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      donorName,
      donorEmail,
      amount,
      donationDate,
      isRepeatDonor,
      senderEmail,
      senderName,
      sfId,
    } = body;

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

    // Check if Gmail is configured
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gmail service account not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY.",
          mock: true,
        },
        { status: 200 }
      );
    }

    const { createGmailDraft } = await import("@/lib/gmail");

    // Format amount
    const amountStr = `$${(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

    // Build display name for donor
    const displayName = donorName || "Friend";

    // Build personalized body
    let emailBody = `Dear ${displayName},\n\n`;

    if (isRepeatDonor) {
      emailBody += `Thank you once again for your generous donation of ${amountStr} to Steel Hearts. Your continued support means the world to us and the families we serve.\n\n`;
    } else {
      emailBody += `Thank you so much for your generous donation of ${amountStr} to Steel Hearts. Your support directly helps us honor our fallen heroes and provide memorial bracelets to Gold Star families and veteran organizations at no cost.\n\n`;
    }

    emailBody += `Every dollar raised goes toward designing, producing, and donating memorial bracelets that keep the memory of our fallen service members alive.\n\n`;
    emailBody += `We are deeply grateful for your support.\n`;

    const { buildEmailSignature } = await import("@/lib/email-signature");
    emailBody += buildEmailSignature(senderName, senderEmail);

    const subject = "Thank you for your donation to Steel Hearts";

    const draft = await createGmailDraft({
      senderEmail,
      senderName: senderName || "Steel Hearts",
      to: donorEmail,
      subject,
      body: emailBody,
    });

    return NextResponse.json({
      success: true,
      draftId: draft.draftId,
      sfId,
      message: `Draft created in ${senderEmail} inbox`,
    });
  } catch (error) {
    console.error("Failed to create Gmail draft:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
