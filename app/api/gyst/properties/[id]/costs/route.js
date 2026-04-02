import { getServerClient } from "@/lib/supabase";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const sb = getServerClient();

  const { data, error } = await sb
    .from("gyst_property_costs")
    .select("*")
    .eq("property_id", id)
    .order("category")
    .order("item");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ costs: data });
}

export async function POST(request, { params }) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const sb = getServerClient();

  const { data, error } = await sb
    .from("gyst_property_costs")
    .insert({ ...body, property_id: id })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ cost: data }, { status: 201 });
}

export async function PATCH(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id: costId, ...updates } = body;

  if (!costId) {
    return Response.json({ error: "Missing cost id in body" }, { status: 400 });
  }

  const sb = getServerClient();

  const { data, error } = await sb
    .from("gyst_property_costs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", costId)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ cost: data });
}

export async function DELETE(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const costId = searchParams.get("costId");

  if (!costId) {
    return Response.json({ error: "Missing costId query parameter" }, { status: 400 });
  }

  const sb = getServerClient();

  const { error } = await sb
    .from("gyst_property_costs")
    .delete()
    .eq("id", costId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
