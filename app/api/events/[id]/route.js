import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const sb = getServerClient();
    const [eventRes, tasksRes, sponsorsRes, budgetRes] = await Promise.all([
      sb.from("events").select("*").eq("id", id).single(),
      sb.from("event_tasks").select("*").eq("event_id", id).order("sort_order"),
      sb.from("event_sponsors").select("*").eq("event_id", id).order("amount_pledged", { ascending: false }),
      sb.from("event_budget_items").select("*").eq("event_id", id).order("category"),
    ]);
    if (eventRes.error) throw eventRes.error;
    return NextResponse.json({
      event: eventRes.data,
      tasks: tasksRes.data || [],
      sponsors: sponsorsRes.data || [],
      budgetItems: budgetRes.data || [],
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const sb = getServerClient();
    const { data, error } = await sb
      .from("events")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
