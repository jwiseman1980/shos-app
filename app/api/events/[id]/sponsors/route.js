import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const sb = getServerClient();

    if (body._action === "update") {
      const { data, error } = await sb
        .from("event_sponsors")
        .update(body.updates)
        .eq("id", body.sponsorId)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ sponsor: data });
    }

    const { _action, ...insertData } = body;
    const { data, error } = await sb
      .from("event_sponsors")
      .insert({ event_id: id, ...insertData })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ sponsor: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
