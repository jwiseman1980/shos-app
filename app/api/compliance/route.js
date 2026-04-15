import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

export async function GET() {
  try {
    const sb = getServerClient();
    const { data, error } = await sb
      .from("compliance_items")
      .select("*, compliance_documents(count)")
      .order("sort_order")
      .order("due_date", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const sb = getServerClient();
    const { data, error } = await sb.from("compliance_items").insert(body).select().single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
