import { NextResponse } from "next/server";
import { buildEmailSignature } from "@/lib/email-signature";

/**
 * POST /api/donors/draft-reengagement-email
 * Creates a Gmail draft for a lapsed donor re-engagement email.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { donorName, donorEmail, lastDonationDate, senderEmail, senderName } = body;

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
        { success: false, error: "Gmail service account not configured.", mock: true },
        { status: 200 }
      );
    }

    const displayName = donorName || "Friend";
    const signature = buildEmailSignature(senderName, senderEmail);

    const subject = "We Miss You at Steel Hearts";

    const emailBody = `Dear ${displayName},

It's been a while since we last heard from you, and we wanted to reach out to share what Steel Hearts has been up to.

Since your last donation, we've continued our mission of honoring fallen service members through personalized memorial bracelets. Every bracelet we create carries the name, rank, and service of a hero — and every one is donated at no cost to their family.

Your past support helped make that possible, and we're deeply grateful.

If you'd like to continue supporting our mission, even a small gift helps us produce and donate more bracelets to Gold Star families and veteran organizations across the country.

Thank you for being part of the Steel Hearts family.

${signature}`;

    const { createGmailDraft } = await import("@/lib/gmail");
    const draft = await createGmailDraft({
      senderEmail,
      senderName,
      to: donorEmail,
      subject,
      body: emailBody,
    });

    return NextResponse.json({
      success: true,
      draftId: draft.draftId,
      message: `Re-engagement draft created in ${senderEmail} inbox`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
