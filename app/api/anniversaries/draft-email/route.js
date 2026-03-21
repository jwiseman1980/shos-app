import { NextResponse } from "next/server";

/**
 * POST /api/anniversaries/draft-email
 * Creates an anniversary remembrance email draft in a volunteer's Gmail.
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
    const ordinal =
      years === 1 ? "1st" :
      years === 2 ? "2nd" :
      years === 3 ? "3rd" :
      `${years}th`;

    let emailBody = `Dear ${displayFamily},\n\n`;
    emailBody += `On behalf of everyone at Steel Hearts, we wanted to reach out to you on the ${ordinal} anniversary of ${heroName}'s passing. We want you to know that ${heroName} is not forgotten, and that their sacrifice continues to be honored.\n\n`;
    emailBody += `Steel Hearts was founded to ensure that the memory of our fallen heroes lives on. Through our memorial bracelet program, supporters across the country carry ${heroName}'s name with them every day.\n\n`;
    emailBody += `We are thinking of you and your family during this time. If there is anything we can do, or if you would like to share any memories or updates, please don't hesitate to reach out.\n\n`;
    emailBody += `With deepest respect,\n`;
    emailBody += `${senderName || "The Steel Hearts Team"}\n`;
    emailBody += `Steel Hearts 501(c)(3)\n`;
    if (senderEmail === "joseph.wiseman@steel-hearts.org") {
      emailBody += `Executive Director/Co-Founder\n`;
    }
    emailBody += `www.steel-hearts.org`;

    const subject = `Remembering ${heroName} — Steel Hearts`;

    const draft = await createGmailDraft({
      senderEmail,
      senderName: senderName || "Steel Hearts",
      to: familyEmail,
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
    console.error("Failed to create anniversary email draft:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
