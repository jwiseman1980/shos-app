import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

/**
 * POST /api/finance/donations-thank-you
 * Creates a Gmail draft thank-you + marks donation as thanked in Supabase.
 *
 * Body: {
 *   donationId: string | null,   // Supabase UUID — null for D-variants
 *   donorName: string,
 *   donorEmail: string,
 *   amount: number,
 *   donationDate: string,
 *   emailSubject: string,
 *   emailBody: string,
 *   senderEmail: string,         // must be @steel-hearts.org
 *   senderName: string,
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      donationId,
      donorName,
      donorEmail,
      emailSubject,
      emailBody,
      senderEmail,
      senderName,
    } = body;

    if (!donorEmail) {
      return NextResponse.json({ error: "donorEmail is required" }, { status: 400 });
    }

    if (!senderEmail || !senderEmail.endsWith("@steel-hearts.org")) {
      return NextResponse.json(
        { error: "senderEmail must be a @steel-hearts.org address" },
        { status: 400 }
      );
    }

    // Gmail not configured → mock mode (still mark thanked if we have an ID)
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const marked = donationId ? await markThanked(donationId) : false;
      return NextResponse.json({
        success: false,
        mock: true,
        error: "Gmail service account not configured — draft not created, but donation marked.",
        marked,
      });
    }

    const { createGmailDraft } = await import("@/lib/gmail");

    const draft = await createGmailDraft({
      senderEmail,
      senderName: senderName || "Steel Hearts Foundation",
      to: donorEmail,
      subject: emailSubject || "Thank you for your donation to Steel Hearts Foundation",
      body: emailBody,
    });

    // Mark as thanked in Supabase (only for actual donation records, not D-variants)
    const marked = donationId ? await markThanked(donationId) : false;

    return NextResponse.json({
      success: true,
      draftId: draft.draftId,
      marked,
      message: `Draft saved to ${senderEmail} Gmail drafts`,
    });
  } catch (error) {
    console.error("[donations-thank-you POST]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/finance/donations-thank-you
 * Toggle thank-you status directly (no draft creation).
 *
 * Body: { donationId: string, thankYouSent: boolean }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { donationId, thankYouSent } = body;

    if (!donationId) {
      return NextResponse.json({ error: "donationId is required" }, { status: 400 });
    }

    const sb = getServerClient();
    const newValue = thankYouSent !== false;

    const updateData = {
      thank_you_sent: newValue,
      updated_at: new Date().toISOString(),
    };

    if (newValue) {
      updateData.thank_you_date = new Date().toISOString().slice(0, 10);
    } else {
      updateData.thank_you_date = null;
    }

    const { error } = await sb
      .from("donations")
      .update(updateData)
      .eq("id", donationId);

    if (error) throw error;

    return NextResponse.json({ success: true, donationId, thankYouSent: newValue });
  } catch (error) {
    console.error("[donations-thank-you PATCH]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

async function markThanked(donationId) {
  try {
    const sb = getServerClient();
    const { error } = await sb
      .from("donations")
      .update({
        thank_you_sent: true,
        thank_you_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", donationId);
    return !error;
  } catch {
    return false;
  }
}
