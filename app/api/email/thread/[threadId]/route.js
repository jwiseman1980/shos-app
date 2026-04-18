import { NextResponse } from "next/server";
import { getThread, markAsRead, archiveThread } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/email/thread/[threadId] — full thread with all messages
 * Auto-marks unread messages as read.
 */
export async function GET(request, { params }) {
  try {
    const { threadId } = await params;
    const { searchParams } = new URL(request.url);
    const mailbox = searchParams.get("mailbox") || undefined;

    const thread = await getThread(threadId, { mailbox });

    // Mark unread non-draft messages as read
    for (const msg of thread.messages) {
      if (msg.isUnread && !msg.isDraft) {
        markAsRead(msg.id, { mailbox }).catch(() => {});
      }
    }

    return NextResponse.json(thread);
  } catch (err) {
    console.error("Thread fetch error:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch thread", message: err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/email/thread/[threadId] — archive thread (remove from inbox)
 */
export async function DELETE(request, { params }) {
  try {
    const { threadId } = await params;
    const { searchParams } = new URL(request.url);
    const mailbox = searchParams.get("mailbox") || undefined;

    await archiveThread(threadId, { mailbox });
    return NextResponse.json({ success: true, threadId });
  } catch (err) {
    console.error("Thread archive error:", err.message);
    return NextResponse.json(
      { error: "Failed to archive thread", message: err.message },
      { status: 500 }
    );
  }
}
