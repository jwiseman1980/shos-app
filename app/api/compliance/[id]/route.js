import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const sb = getServerClient();
    const updateData = { ...body, updated_at: new Date().toISOString() };
    if (body.status === 'filed' || body.status === 'confirmed') {
      updateData.last_filed_date = new Date().toISOString().split('T')[0];
    }
    const { data, error } = await sb
      .from("compliance_items")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
