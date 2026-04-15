import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const sb = getServerClient();

    if (body._action === "toggle") {
      const { data, error } = await sb
        .from("event_tasks")
        .update({ completed: body.completed, completed_at: body.completed ? new Date().toISOString() : null })
        .eq("id", body.taskId)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ task: data });
    }

    const { data, error } = await sb
      .from("event_tasks")
      .insert({
        event_id: id,
        title: body.title,
        category: body.category || "general",
        due_date: body.due_date || null,
        sort_order: body.sort_order || 0,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ task: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
