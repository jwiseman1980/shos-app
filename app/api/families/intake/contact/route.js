import { NextResponse } from "next/server";
import { createFamilyContact, linkFamilyToHero } from "@/lib/data/families";

const SLACK_WEBHOOK = process.env.SLACK_SOP_WEBHOOK;
const SLACK_DM_JOSEPH = process.env.SLACK_DM_JOSEPH;

async function postSlack(text, webhook) {
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.warn("Slack failed:", e.message);
  }
}

/** POST — Step 2-3: Create family contact and link to hero */
export async function POST(req) {
  try {
    const body = await req.json();
    const { heroId, heroName, firstName, lastName, email, phone, relationship } = body;

    if (!heroId || !firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: "Missing required: heroId, firstName, lastName" },
        { status: 400 }
      );
    }
    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: "Must provide at least email or phone" },
        { status: 400 }
      );
    }

    // Create or find contact
    const contact = await createFamilyContact({ firstName, lastName, email, phone });
    if (!contact.success) return NextResponse.json(contact, { status: 500 });

    // Link to hero
    const link = await linkFamilyToHero(
      heroId,
      contact.contactId,
      relationship || "Surviving Family"
    );

    const msg = `\u{1F46A} Family linked: ${contact.name} \u2192 ${heroName || "hero"}${contact.wasExisting ? " (existing contact)" : ""}`;
    await Promise.all([
      postSlack(msg, SLACK_WEBHOOK),
      postSlack(msg, SLACK_DM_JOSEPH),
    ]);

    return NextResponse.json({
      success: true,
      contactId: contact.contactId,
      contactName: contact.name,
      wasExisting: contact.wasExisting,
      associationId: link.associationId,
    });
  } catch (err) {
    console.error("Create contact error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
