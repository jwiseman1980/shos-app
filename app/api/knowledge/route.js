/**
 * Knowledge File API
 *
 * External access to role knowledge files stored in Supabase.
 * Used by Claude Code sessions and other integrations.
 *
 * GET /api/knowledge?role=ed  → read a role's knowledge file
 * PUT /api/knowledge          → update a role's knowledge file
 */

import { readKnowledge, writeKnowledge } from "@/lib/storage/index.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== process.env.SHOS_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  if (!role) {
    return Response.json({ error: "Missing role parameter" }, { status: 400 });
  }

  const validRoles = ["ed", "cos", "cfo", "coo", "comms", "dev", "family"];
  if (!validRoles.includes(role)) {
    return Response.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }

  const content = await readKnowledge(role);
  return Response.json({ role, content });
}

export async function PUT(request) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== process.env.SHOS_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, content } = await request.json();

  if (!role || !content) {
    return Response.json({ error: "Missing role or content" }, { status: 400 });
  }

  const validRoles = ["ed", "cos", "cfo", "coo", "comms", "dev", "family"];
  if (!validRoles.includes(role)) {
    return Response.json({ error: `Invalid role: ${role}` }, { status: 400 });
  }

  const result = await writeKnowledge(role, content);
  return Response.json({ role, result });
}
