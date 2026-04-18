import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

const MMMM_EVENT = {
  name: "Mountain Man Memorial March 2026",
  event_date: "2026-04-10",
  notes:
    "50% of net proceeds go to Legacies Alive. Total raised: $416. Annual ruck march honoring fallen heroes.",
  status: "completed",
};

export async function POST() {
  try {
    const sb = getServerClient();

    const { data: existing } = await sb
      .from("events")
      .select("id, name")
      .ilike("name", "%Mountain Man Memorial March 2026%")
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json({ seeded: false, existing, message: "Event already exists" });
    }

    const { data, error } = await sb.from("events").insert(MMMM_EVENT).select().single();
    if (error) throw error;

    return NextResponse.json({ seeded: true, event: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
