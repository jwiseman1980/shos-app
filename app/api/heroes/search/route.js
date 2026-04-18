import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

/**
 * GET /api/heroes/search?q=...&limit=10
 *
 * Fuzzy search heroes by name or SKU. Used for the inline order form in Inbox.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "8", 10), 20);

    if (q.length < 2) {
      return NextResponse.json({ heroes: [] });
    }

    const sb = getServerClient();

    const { data, error } = await sb
      .from("heroes")
      .select("id, sf_id, name, lineitem_sku, design_status, branch, has_graphic_design, bracelet_design_created")
      .or(`name.ilike.%${q}%,lineitem_sku.ilike.%${q}%`)
      .order("name", { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      heroes: (data || []).map((h) => ({
        id: h.id,
        sfId: h.sf_id,
        name: h.name || "",
        sku: h.lineitem_sku || "",
        designStatus: h.design_status || "not_started",
        branch: h.branch || "",
        hasDesign: h.has_graphic_design || h.bracelet_design_created || false,
      })),
    });
  } catch (err) {
    console.error("[heroes/search] error:", err.message);
    return NextResponse.json({ heroes: [] });
  }
}
