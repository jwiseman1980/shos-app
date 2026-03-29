import { getServerClient } from "@/lib/supabase";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function checkAuth(request) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey === process.env.SHOS_API_KEY) return true;
  return await isAuthenticated();
}

export async function GET(request) {
  if (!(await checkAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();
  const { searchParams } = new URL(request.url);
  let query = sb.from("volunteers").select("*").order("last_name");

  const status = searchParams.get("status");
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ volunteers: data || [] });
}

export async function POST(request) {
  if (!(await checkAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();
  const body = await request.json();
  const { data, error } = await sb.from("volunteers").insert(body).select("id, first_name, last_name").single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ volunteer: data, result: `Volunteer added: ${data.first_name} ${data.last_name}` });
}

export async function PUT(request) {
  if (!(await checkAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();
  const { id, ...updates } = await request.json();
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const { data, error } = await sb.from("volunteers").update(updates).eq("id", id).select("id, first_name, last_name, status").single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ volunteer: data, result: `Updated ${data.first_name} ${data.last_name} → ${data.status}` });
}
