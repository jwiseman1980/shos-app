import { NextResponse } from "next/server";
import { isAuthenticated, getSessionUser } from "@/lib/auth";
import { logExecution } from "@/lib/execution-logger";
import { getServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/execution-log — fetch today's accomplishments
 */
export async function GET() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await sb
    .from("execution_log")
    .select("id, title, item_type, domain, user_name, duration_minutes, outcome, completed_at")
    .gte("completed_at", today + "T00:00:00")
    .order("completed_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data || [] });
}

export async function POST(request) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getSessionUser();
  const body = await request.json();

  const result = await logExecution({
    userName: user?.name || body.userName,
    ...body,
  });

  return NextResponse.json(result);
}
