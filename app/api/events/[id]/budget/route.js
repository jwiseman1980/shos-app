import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const sb = getServerClient();

    if (body._action === "update") {
      const { data, error } = await sb
        .from("event_budget_items")
        .update(body.updates)
        .eq("id", body.itemId)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ item: data });
    }

    const { _action, ...insertData } = body;
    const { data, error } = await sb
      .from("event_budget_items")
      .insert({ event_id: id, ...insertData })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
