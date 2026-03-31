import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { buildMessagePacket } from "@/lib/message-packet";
import { createGmailDraft } from "@/lib/gmail";

/**
 * POST /api/messages/draft-batch
 * Creates Gmail drafts for all eligible families (or a specific list).
 * Each family with ready-to-send messages gets one draft email.
 *
 * Body: { heroIds?: string[] }
 *   - heroIds: optional list of specific hero IDs. If omitted, drafts all eligible.
 *
 * Returns: { success, drafted: number, results: [...], errors: [...] }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { heroIds } = body;

    const sb = getServerClient();

    // Fetch all ready-to-send messages with hero + family contact info
    let query = sb
      .from("family_messages")
      .select(`
        id, sf_id, message, from_name, from_email, status, consent_to_share,
        hero:heroes!hero_id(
          id, name, lineitem_sku,
          family_contact:contacts!family_contact_id(first_name, last_name, email)
        )
      `)
      .in("status", ["ready_to_send", "new"]);

    if (heroIds?.length) {
      query = query.in("hero_id", heroIds);
    }

    const { data: messages, error } = await query;
    if (error) throw new Error(`Failed to fetch messages: ${error.message}`);

    // Group by hero
    const heroGroups = new Map();
    for (const msg of (messages || [])) {
      if (!msg.hero?.id) continue;
      const heroId = msg.hero.id;
      if (!heroGroups.has(heroId)) {
        heroGroups.set(heroId, {
          heroId,
          heroName: msg.hero.name,
          heroSku: msg.hero.lineitem_sku,
          familyContact: msg.hero.family_contact,
          messages: [],
        });
      }
      heroGroups.get(heroId).messages.push(msg);
    }

    const results = [];
    const errors = [];

    for (const [heroId, group] of heroGroups) {
      const contact = group.familyContact;
      if (!contact?.email) {
        errors.push({ heroId, heroName: group.heroName, error: "No family email on file" });
        continue;
      }

      // Build family name
      const familyName = contact.last_name
        ? `${contact.first_name || ""} ${contact.last_name}`.trim()
        : contact.first_name || "Family";

      // Map messages to packet format
      const packetMessages = group.messages.map(m => ({
        sfId: m.sf_id || m.id,
        message: m.message,
        fromName: m.from_name,
        fromEmail: m.from_email,
        consentToShare: m.consent_to_share,
      }));

      try {
        // Build email packet
        const packet = buildMessagePacket({
          heroName: group.heroName,
          familyName,
          familyEmail: contact.email,
          messages: packetMessages,
          senderName: "Joseph Wiseman",
          senderEmail: "joseph.wiseman@steel-hearts.org",
        });

        // Create Gmail draft
        const draft = await createGmailDraft({
          senderEmail: "joseph.wiseman@steel-hearts.org",
          senderName: "Joseph Wiseman",
          to: contact.email,
          subject: packet.subject,
          body: packet.body,
        });

        // Mark messages as sent in Supabase
        const messageIds = group.messages.map(m => m.id);
        await sb
          .from("family_messages")
          .update({ status: "sent" })
          .in("id", messageIds);

        results.push({
          heroId,
          heroName: group.heroName,
          familyEmail: contact.email,
          familyName,
          messageCount: group.messages.length,
          draftId: draft.draftId || draft.id,
        });
      } catch (err) {
        errors.push({ heroId, heroName: group.heroName, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      drafted: results.length,
      totalMessages: results.reduce((sum, r) => sum + r.messageCount, 0),
      results,
      errors,
    });
  } catch (error) {
    console.error("Batch draft error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
