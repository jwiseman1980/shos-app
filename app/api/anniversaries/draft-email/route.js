import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

/**
 * POST /api/anniversaries/draft-email
 *
 * Creates an anniversary remembrance email draft using the approved
 * v2026.3 templates (`notion-export/Templates/Anniversary_Email_Template_v2026.3.md`).
 *
 * Auto-selects:
 *   - Template A — On-Date: anniversary date this year is today or in the future.
 *     Subject: "Thinking of [HERO FULL NAME] Today — Steel Hearts Remembrance"
 *     Volunteer should use Gmail's Schedule Send to deliver on the actual date.
 *   - Template B — Monthly Honor: anniversary date this year has already passed.
 *     Subject: "Honoring [HERO FULL NAME] This Month — Steel Hearts Remembrance"
 *     Volunteer reviews and sends immediately.
 *
 * Caller may force a template by passing `templateChoice: "A" | "B"`.
 *
 * Body: {
 *   heroName: "SSG John Smith",          // "[RANK] [HERO FULL NAME]" combined; required
 *   heroRank?: "SSG",                    // optional, improves rank-stripping for first-name parsing
 *   heroFirstName?: "John",              // optional override; otherwise derived from heroName
 *   familyEmail: "family@example.com",
 *   familyName: "Jane Smith",            // family contact full name
 *   familyFirstName?: "Jane",            // optional override; otherwise first token of familyName
 *   senderEmail: "kristin@steel-hearts.org",
 *   senderName: "Kristin Hughes",
 *   memorialDate: "2021-03-15",
 *   sfId?: string,                       // hero sf_id for status update
 *   templateChoice?: "A" | "B",          // optional manual override
 * }
 */

// Common military rank abbreviations used to strip a rank prefix from heroName
// when no explicit `heroRank` is provided. Compared case-insensitively after
// stripping a trailing period (e.g. "Capt." -> "CAPT").
const RANK_PREFIXES = new Set([
  // Army / Marines enlisted
  "PVT", "PFC", "PV2", "SPC", "CPL", "LCPL", "SGT", "SSG", "SFC", "MSG",
  "1SG", "SGM", "CSM", "GYSGT", "1STSGT", "MGYSGT",
  // Army / Marines officers
  "2LT", "1LT", "CPT", "MAJ", "LTC", "COL", "BG", "MG", "LG", "GEN",
  // Warrant officers
  "WO1", "CW2", "CW3", "CW4", "CW5",
  // Navy enlisted
  "SR", "SA", "SN", "PO3", "PO2", "PO1", "CPO", "SCPO", "MCPO",
  // Navy officers
  "ENS", "LTJG", "LT", "LCDR", "CDR", "CAPT", "RDML", "RADM", "VADM", "ADM",
  // Air Force enlisted
  "AB", "AMN", "A1C", "SRA", "SSGT", "TSGT", "MSGT", "SMSGT", "CMSGT",
  // Air Force officers
  "LTCOL", "BRIGGEN", "MAJGEN", "LTGEN",
]);

function deriveHeroParts({ heroName, heroRank, heroFirstName }) {
  const fullDisplay = (heroName || "").trim();
  const tokens = fullDisplay.split(/\s+/).filter(Boolean);

  // Default: no rank detected — fullDisplay IS the name without rank.
  let rankAndName = fullDisplay;
  let fullName = fullDisplay;
  let firstName = heroFirstName || tokens[0] || "";

  if (heroRank && fullDisplay.toUpperCase().startsWith(heroRank.toUpperCase() + " ")) {
    fullName = fullDisplay.substring(heroRank.length + 1);
    if (!heroFirstName) firstName = fullName.split(/\s+/)[0] || "";
  } else if (tokens.length > 1) {
    const firstTokenKey = tokens[0].replace(/\.$/, "").toUpperCase();
    if (RANK_PREFIXES.has(firstTokenKey)) {
      fullName = tokens.slice(1).join(" ");
      if (!heroFirstName) firstName = tokens[1];
    }
  }

  return { rankAndName, fullName, firstName };
}

function deriveFamilyFirstName({ familyName, familyFirstName }) {
  if (familyFirstName) return familyFirstName.trim();
  const trimmed = (familyName || "").trim();
  if (!trimmed) return "Friend";
  return trimmed.split(/\s+/)[0];
}

function pickTemplate({ memorialDate, templateChoice }) {
  if (templateChoice === "A" || templateChoice === "B") return templateChoice;
  if (!memorialDate) return "A";
  const md = new Date(memorialDate);
  if (isNaN(md.getTime())) return "A";
  const today = new Date();
  const annivThisYear = new Date(today.getFullYear(), md.getUTCMonth(), md.getUTCDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return todayDate <= annivThisYear ? "A" : "B";
}

function buildEmail({ template, heroParts, familyFirst, senderName, senderEmail }) {
  const { rankAndName, fullName, firstName } = heroParts;
  const sig = `${senderName}\nSteel Hearts Foundation 501(c)(3)\n${senderEmail}\nsteelhearts.org/donate`;

  if (template === "A") {
    const subject = `Thinking of ${fullName} Today — Steel Hearts Remembrance`;
    const body =
      `Dear ${familyFirst},\n\n` +
      `Today marks ${rankAndName}'s anniversary, and we wanted you to know — we remember. ${firstName} matters to us, and so do you.\n\n` +
      `If you ever feel like sharing a story or a memory about ${firstName}, we'd love to hear it.\n\n` +
      `Thinking of your family today.\n\n` +
      sig;
    return { subject, body };
  }

  const subject = `Honoring ${fullName} This Month — Steel Hearts Remembrance`;
  const body =
    `Dear ${familyFirst},\n\n` +
    `This month we're honoring ${rankAndName}, and I wanted to reach out personally. ${firstName}'s sacrifice hasn't been forgotten — not by us, and not by the families and supporters who make up this community.\n\n` +
    `If you'd ever like to share a memory or tell us something about ${firstName}, we'd really welcome that.\n\n` +
    `You and your family are in our thoughts.\n\n` +
    sig;
  return { subject, body };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      heroName,
      heroRank,
      heroFirstName,
      memorialDate,
      familyEmail,
      familyName,
      familyFirstName,
      senderEmail,
      senderName,
      sfId,
      templateChoice,
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

    if (!heroName) {
      return NextResponse.json(
        { error: "heroName is required" },
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

    const heroParts = deriveHeroParts({ heroName, heroRank, heroFirstName });
    const familyFirst = deriveFamilyFirstName({ familyName, familyFirstName });
    const template = pickTemplate({ memorialDate, templateChoice });
    const resolvedSenderName = senderName || "Steel Hearts";

    const { subject, body: emailBody } = buildEmail({
      template,
      heroParts,
      familyFirst,
      senderName: resolvedSenderName,
      senderEmail,
    });

    const { createGmailDraft } = await import("@/lib/gmail");
    const draft = await createGmailDraft({
      senderEmail,
      senderName: resolvedSenderName,
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
      template,
      subject,
      message:
        template === "A"
          ? `Draft created in ${senderEmail} inbox. Use Gmail Schedule Send to deliver on the anniversary date.`
          : `Draft created in ${senderEmail} inbox. Review and send immediately.`,
    });
  } catch (error) {
    console.error("Failed to create anniversary email draft:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
