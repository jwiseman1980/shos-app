import { NextResponse } from "next/server";
import { getMessageAttachments, downloadAttachment } from "@/lib/gmail-attachments";

/**
 * GET /api/gmail/attachment?messageId=...&attachmentId=...
 *
 * Optional query params:
 *   - filename: override download filename
 *   - mimeType: override Content-Type (default application/octet-stream)
 *   - mailbox:  mailbox key (default "joseph")
 *   - list=1:   list all attachments on the message instead of downloading one
 *
 * Returns the decoded attachment bytes (or JSON list if list=1).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("messageId");
  const attachmentId = searchParams.get("attachmentId");
  const list = searchParams.get("list");
  const mailbox = searchParams.get("mailbox") || undefined;

  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  try {
    if (list) {
      const attachments = await getMessageAttachments(messageId, { mailbox });
      return NextResponse.json({ messageId, attachments });
    }

    if (!attachmentId) {
      return NextResponse.json(
        { error: "attachmentId required (or pass list=1 to enumerate)" },
        { status: 400 }
      );
    }

    const buffer = await downloadAttachment(messageId, attachmentId, { mailbox });
    const filename = searchParams.get("filename") || `attachment-${attachmentId.slice(0, 12)}`;
    const mimeType = searchParams.get("mimeType") || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("[gmail/attachment] error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
