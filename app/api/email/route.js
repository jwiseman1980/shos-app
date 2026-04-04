import { NextResponse } from "next/server";
import {
  listInbox,
  getMessage,
  archiveMessage,
  archiveMessages,
  markAsRead,
  starMessage,
  sendGmailMessage,
  MAILBOXES,
} from "@/lib/gmail";
import { getServerClient } from "@/lib/supabase";

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
    const mailbox = searchParams.get("mailbox") || undefined;

    console.log(`[email] listInbox mailbox=${mailbox}, resolved=${mailbox || "joseph (default)"}`);
    const result = await listInbox({ maxResults, pageToken, query, mailbox });
    return NextResponse.json({ ...result, _mailbox: mailbox || "joseph" });
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
    const { action, messageId, messageIds, starred, mailbox } = body;

    switch (action) {
      case "archive": {
        if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });
        await archiveMessage(messageId, { mailbox });
        return NextResponse.json({ success: true, action: "archived", messageId });
      }
      case "archiveMany": {
        if (!messageIds?.length) return NextResponse.json({ error: "messageIds required" }, { status: 400 });
        const result = await archiveMessages(messageIds, { mailbox });
        return NextResponse.json({ success: true, action: "archivedMany", ...result });
      }
      case "read": {
        if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });
        await markAsRead(messageId, { mailbox });
        return NextResponse.json({ success: true, action: "read", messageId });
      }
      case "star": {
        if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });
        await starMessage(messageId, starred !== false, { mailbox });
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

/**
 * POST /api/email — convert email to task
 * Body: { action: "convert_to_task", messageId, subject, from, snippet }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, messageId, subject, from, snippet, mailbox } = body;

    if (action === "send") {
      const { to, subject: sendSubject, body: sendBody, threadId, inReplyTo } = body;
      if (!to || !sendSubject || !sendBody) {
        return NextResponse.json({ error: "to, subject, and body required" }, { status: 400 });
      }

      const mb = MAILBOXES[mailbox] || MAILBOXES.joseph;
      const result = await sendGmailMessage({
        senderEmail: mb.email,
        senderName: mb.name,
        to,
        subject: sendSubject,
        body: sendBody,
        threadId,
        inReplyTo,
      });

      return NextResponse.json({ success: true, action: "sent", ...result });
    }

    if (action !== "convert_to_task") {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Create task in Supabase
    const sb = getServerClient();
    const taskData = {
      title: subject || "Email task",
      description: `From: ${from || "unknown"}\n${snippet || ""}`.trim(),
      domain: "general",
      status: "todo",
      priority: "medium",
      item_type: "task",
      source: "email",
      source_id: messageId,
      due_date: new Date().toISOString().split("T")[0],
    };

    const { data: result, error: taskErr } = await sb.from("tasks").insert(taskData).select().single();
    if (taskErr) throw new Error(taskErr.message);

    // Archive the email after converting
    if (messageId) {
      await archiveMessage(messageId, { mailbox }).catch(() => {});
      await markAsRead(messageId, { mailbox }).catch(() => {});
    }

    const task = {
      id: result?.id || `email-task-${messageId}`,
      title: taskData.title,
      description: taskData.description,
      date: taskData.due_date,
      source: "email",
      sourceType: "task",
      domain: "general",
      status: "todo",
      estimatedMinutes: 10,
    };

    return NextResponse.json({ success: true, task });
  } catch (err) {
    console.error("Email convert-to-task error:", err.message);
    return NextResponse.json(
      { error: "Convert to task failed", message: err.message },
      { status: 500 }
    );
  }
}
