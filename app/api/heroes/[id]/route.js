import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

const ALLOWED_FIELDS = new Set([
  "name",
  "first_name",
  "last_name",
  "rank",
  "branch",
  "lineitem_sku",
  "memorial_month",
  "memorial_day",
  "memorial_date",
  "incident",
  "bio_page_url",
  "design_status",
  "design_brief",
  "anniversary_status",
  "anniversary_outreach_status",
  "anniversary_notes",
]);

export async function GET(_request, { params }) {
  const { id } = await params;
  const sb = getServerClient();
  const { data, error } = await sb
    .from("heroes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Hero not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) update[key] = value === "" ? null : value;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No allowed fields to update" }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const sb = getServerClient();
  const { data, error } = await sb
    .from("heroes")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
