import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const sb = getServerClient();
    const { data, error } = await sb
      .from("compliance_documents")
      .select("*")
      .eq("compliance_item_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ documents: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const sb = getServerClient();
    const { data, error } = await sb
      .from("compliance_documents")
      .insert({ compliance_item_id: id, ...body })
      .select()
      .single();
    if (error) throw error;
    if (body.document_type === 'filing' || body.document_type === 'confirmation') {
      await sb.from("compliance_items").update({
        last_filed_date: body.filed_date || new Date().toISOString().split('T')[0],
        status: 'filed',
        updated_at: new Date().toISOString(),
      }).eq("id", id);
    }
    return NextResponse.json({ document: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
