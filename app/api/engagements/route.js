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
  const { data, error } = await sb
    .from("engagements")
    .select("*")
    .order("engagement_date", { ascending: false })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ engagements: data || [] });
}

export async function POST(request) {
  if (!(await checkAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();
  const body = await request.json();
  const { data, error } = await sb.from("engagements").insert({
    ...body,
    engagement_date: body.engagement_date || new Date().toISOString().split("T")[0],
  }).select("id, subject, type").single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ engagement: data, result: `Engagement logged: [${data.type}] ${data.subject}` });
}
