import { NextResponse } from "next/server";
import { buildEmailSignature } from "@/lib/email-signature";

/**
 * POST /api/donors/draft-yearend-email
 * Creates a Gmail draft with a year-end stewardship summary.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      donorName,
      donorEmail,
      year,
      totalDonated,
      donationCount,
      senderEmail,
      senderName,
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

    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!serviceEmail || !serviceKey) {
      return NextResponse.json(
        { success: false, error: "Gmail service account not configured.", mock: true },
        { status: 200 }
      );
    }

    const displayName = donorName || "Friend";
    const reportYear = year || new Date().getFullYear() - 1;
    const totalStr = totalDonated
      ? `$${Number(totalDonated).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      : "your generous contributions";
    const countStr = donationCount || "multiple";
    const signature = buildEmailSignature(senderName, senderEmail);

    const subject = `Your ${reportYear} Donation Summary — Steel Hearts`;

    const emailBody = `Dear ${displayName},

As ${reportYear} comes to a close, we want to express our heartfelt gratitude for your generous support of Steel Hearts throughout the year.

YOUR ${reportYear} GIVING SUMMARY
----------------------------------
Total Donated: ${totalStr}
Number of Gifts: ${countStr}
Organization: Steel Hearts 501(c)(3)
EIN: 84-3689498

Your contributions have directly supported our mission of honoring fallen service members through personalized memorial bracelets donated at no cost to Gold Star families and veteran organizations.

This letter may serve as your tax receipt for ${reportYear} charitable contributions to Steel Hearts. No goods or services were provided in exchange for your donation(s).

Thank you for being part of the Steel Hearts family. Your generosity keeps the memory of our heroes alive.

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
      message: `Year-end summary draft created in ${senderEmail} inbox`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
