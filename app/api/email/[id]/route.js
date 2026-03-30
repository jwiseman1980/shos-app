import { NextResponse } from "next/server";
import { getMessage, markAsRead } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/email/[id] — get full message content
 * Auto-marks as read when fetched.
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const message = await getMessage(id);

    // Auto-mark as read when opened
    if (message.isUnread) {
      try {
        await markAsRead(id);
        message.isUnread = false;
      } catch {}
    }

    return NextResponse.json(message);
  } catch (err) {
    console.error("Email fetch error:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch email", message: err.message },
      { status: 500 }
    );
  }
}
