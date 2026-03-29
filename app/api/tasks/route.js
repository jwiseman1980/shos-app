/**
 * Tasks API
 *
 * Task management in Supabase. Supports two auth modes:
 * - Session cookie (in-app client calls from TaskBoard)
 * - API key header (external calls from Claude Code, scheduled tasks)
 *
 * GET  /api/tasks?role=ed&status=todo  → query tasks
 * POST /api/tasks                       → create a task
 * PUT  /api/tasks                       → update a task
 */

import { createTask, updateTask, queryTasks } from "@/lib/storage/supabase-tools.js";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function checkAuth(request) {
  // Check API key first (external integrations)
  const apiKey = request.headers.get("x-api-key");
  if (apiKey === process.env.SHOS_API_KEY) return true;
  // Fall back to session cookie (in-app calls)
  return await isAuthenticated();
}

export async function GET(request) {
  if (!(await checkAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filters = {};
  if (searchParams.get("role")) filters.role = searchParams.get("role");
  if (searchParams.get("status")) filters.status = searchParams.get("status");
  if (searchParams.get("priority")) filters.priority = searchParams.get("priority");
  if (searchParams.get("due_before")) filters.due_before = searchParams.get("due_before");
  if (searchParams.get("limit")) filters.limit = parseInt(searchParams.get("limit"));

  const result = await queryTasks(filters);
  try {
    const data = JSON.parse(result);
    return Response.json({ tasks: data });
  } catch {
    return Response.json({ tasks: [], message: result });
  }
}

export async function POST(request) {
  if (!(await checkAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = await createTask(body);
  return Response.json({ result });
}

export async function PUT(request) {
  if (!(await checkAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = await updateTask(body);
  return Response.json({ result });
}
