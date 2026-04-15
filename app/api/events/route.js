import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const sb = getServerClient();
    const { data, error } = await sb
      .from("events")
      .select("*, event_sponsors(count), event_tasks(count)")
      .order("event_date", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ events: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const sb = getServerClient();
    const { data, error } = await sb.from("events").insert(body).select().single();
    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
