import { NextResponse } from "next/server";
import {
  createSession,
  endSession,
  getSession,
  getRecentSessions,
  getSessionMessages,
} from "@/lib/data/chat";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const messages = await getSessionMessages(id);
    return NextResponse.json({ session, messages });
  }

  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const search = searchParams.get("search") ?? undefined;
  const sessions = await getRecentSessions({ limit, search });
  return NextResponse.json({ sessions });
}

export async function POST(request) {
  const { userName, userEmail, pageContext } = await request.json();
  const session = await createSession({ userName, userEmail, pageContext });
  return NextResponse.json({ session }, { status: 201 });
}

export async function PATCH(request) {
  const { sessionId, summary, toolsUsed } = await request.json();
  const session = await endSession({ sessionId, summary, toolsUsed });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json({ session });
}
