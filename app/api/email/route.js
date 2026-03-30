import { NextResponse } from "next/server";
import {
  listInbox,
  getMessage,
  archiveMessage,
  archiveMessages,
  markAsRead,
  starMessage,
} from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/email — list inbox messages
 * Query params: maxResults, pageToken, q (search query)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const maxResults = parseInt(searchParams.get("maxResults") || "50");
    const pageToken = searchParams.get("pageToken") || undefined;
    const query = searchParams.get("q") || undefined;

    const result = await listInbox({ maxResults, pageToken, query });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Email list error:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch emails", message: err.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/email — perform actions on messages
 * Body: { action, messageId, messageIds, starred }
 * Actions: archive, archiveMany, read, star
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { action, messageId, messageIds, starred } = body;

    switch (action) {
      case "archive": {
        if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });
        await archiveMessage(messageId);
        return NextResponse.json({ success: true, action: "archived", messageId });
      }
      case "archiveMany": {
        if (!messageIds?.length) return NextResponse.json({ error: "messageIds required" }, { status: 400 });
        const result = await archiveMessages(messageIds);
        return NextResponse.json({ success: true, action: "archivedMany", ...result });
      }
      case "read": {
        if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });
        await markAsRead(messageId);
        return NextResponse.json({ success: true, action: "read", messageId });
      }
      case "star": {
        if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });
        await starMessage(messageId, starred !== false);
        return NextResponse.json({ success: true, action: "starred", messageId, starred: starred !== false });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("Email action error:", err.message);
    return NextResponse.json(
      { error: "Email action failed", message: err.message },
      { status: 500 }
    );
  }
}
