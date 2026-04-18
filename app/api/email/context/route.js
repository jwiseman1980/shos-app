import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

/**
 * GET /api/email/context?email=...&subject=...&snippet=...
 *
 * Identifies who sent the email and what it's about.
 * Returns: matched contact (from contacts table), matched heroes, order count, donation total.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawEmail = searchParams.get("email") || "";
    const subject = searchParams.get("subject") || "";
    const snippet = searchParams.get("snippet") || "";

    // Parse email address from "Name <addr>" format
    const addrMatch = rawEmail.match(/<([^>]+)>/);
    const emailAddr = (addrMatch ? addrMatch[1] : rawEmail).toLowerCase().trim();
    const combined = `${subject} ${snippet}`.toLowerCase();

    const sb = getServerClient();

    // ── 1. Contact lookup ──────────────────────────────────────────────────────
    const contactPromise = emailAddr
      ? sb
          .from("contacts")
          .select("id, name, email, phone, city, state")
          .ilike("email", emailAddr)
          .limit(1)
          .then((r) => r.data?.[0] || null)
          .catch(() => null)
      : Promise.resolve(null);

    // ── 2. Hero lookup (SKU pattern → name match) ──────────────────────────────
    const heroPromise = (async () => {
      // Try SKU pattern first: e.g. USMA23-MORTON
      const skuMatch = combined.match(/\b([A-Z]{2,6}\d{2,4}-[A-Z]{2,15})\b/i);
      if (skuMatch) {
        const { data } = await sb
          .from("heroes")
          .select("id, sf_id, name, lineitem_sku, design_status, branch, memorial_date, has_graphic_design, bracelet_design_created")
          .ilike("lineitem_sku", `%${skuMatch[1].toUpperCase()}%`)
          .limit(3);
        if (data?.length) return data;
      }

      // Military rank + name patterns: "SGT Smith", "CPT Jones", etc.
      const rankPattern = /\b(?:pvt|pfc|spc|cpl|sgt|ssc|ssgt|sfc|msg|1sg|sgm|csm|wol|wo1|wo2|cw2|cw3|cw4|cw5|2lt|1lt|cpt|maj|ltc|col|bg|mg|ltg|gen|ens|ltjg|lt|lcdr|cdr|capt|rdml|radm|vadm|adm|amn|a1c|sra|ssgt|tsgt|msgt|smsgt|cmsgt|2nd lt|1st lt)\b/i;
      const afterRank = combined.match(new RegExp(rankPattern.source + "\\s+([a-z]+)", "i"));
      if (afterRank) {
        const lastName = afterRank[1];
        if (lastName.length >= 3) {
          const { data } = await sb
            .from("heroes")
            .select("id, sf_id, name, lineitem_sku, design_status, branch, memorial_date, has_graphic_design, bracelet_design_created")
            .ilike("name", `%${lastName}%`)
            .limit(3);
          if (data?.length) return data;
        }
      }

      // Fallback: look for multi-word capitalized sequences as name hints
      const words = subject.split(/\s+/).filter((w) => /^[A-Z][a-z]{2,}$/.test(w) && !["The","For","From","Your","Our","Dear","Hello","Thanks","Thank","Best"].includes(w));
      if (words.length >= 1) {
        const { data } = await sb
          .from("heroes")
          .select("id, sf_id, name, lineitem_sku, design_status, branch, memorial_date, has_graphic_design, bracelet_design_created")
          .or(words.slice(0, 2).map((w) => `name.ilike.%${w}%`).join(","))
          .limit(3);
        if (data?.length) return data;
      }

      return [];
    })();

    // ── 3. Order + donation counts ─────────────────────────────────────────────
    const orderCountPromise = emailAddr
      ? sb
          .from("orders")
          .select("id", { count: "exact", head: true })
          .ilike("billing_email", emailAddr)
          .then((r) => r.count || 0)
          .catch(() => 0)
      : Promise.resolve(0);

    const donationPromise = emailAddr
      ? sb
          .from("donations")
          .select("donation_amount")
          .ilike("donor_email", emailAddr)
          .then((r) => (r.data || []).reduce((s, d) => s + (d.donation_amount || 0), 0))
          .catch(() => 0)
      : Promise.resolve(0);

    const [contact, heroes, orderCount, donationTotal] = await Promise.all([
      contactPromise,
      heroPromise,
      orderCountPromise,
      donationPromise,
    ]);

    return NextResponse.json({
      contact,
      heroes: heroes.slice(0, 3),
      orderCount,
      donationTotal,
      emailAddr,
    });
  } catch (err) {
    console.error("[email/context] error:", err.message);
    return NextResponse.json({ contact: null, heroes: [], orderCount: 0, donationTotal: 0, emailAddr: "" });
  }
}
