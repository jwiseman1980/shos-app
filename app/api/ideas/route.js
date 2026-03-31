import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/ideas — Submit an idea/proposal to the Architect queue
 * Body: { idea, domain, details, energy, source, submittedBy }
 *
 * This endpoint accepts proposals from any source:
 * - The SHOS app Operator (via log_friction or direct)
 * - The Claude.ai Project (via user pasting into the ideas page)
 * - Manual submission from the /ideas page
 *
 * Writes to friction_logs with type="idea" for Architect pickup.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { idea, domain, details, energy, source, submittedBy } = body;

    if (!idea) {
      return NextResponse.json({ error: "idea is required" }, { status: 400 });
    }

    const sb = getServerClient();
    const description = [
      idea,
      details ? `\nDetails: ${details}` : "",
      domain ? `\nDomain: ${domain}` : "",
      energy ? `\nEnergy: ${energy}` : "",
      submittedBy ? `\nSubmitted by: ${submittedBy}` : "",
      source ? `\nSource: ${source}` : "",
    ].join("");

    const priority = energy === "hot" ? "high" : energy === "warm" ? "medium" : "low";

    const { data, error } = await sb.from("friction_logs").insert({
      role: "architect",
      type: "idea",
      priority,
      description,
      status: "open",
      logged_date: new Date().toISOString().split("T")[0],
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/ideas — List open ideas/proposals for the Architect
 */
export async function GET() {
  try {
    const sb = getServerClient();
    const { data, error } = await sb
      .from("friction_logs")
      .select("*")
      .eq("status", "open")
      .order("logged_date", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ideas: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
