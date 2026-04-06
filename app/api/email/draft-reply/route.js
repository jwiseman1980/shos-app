import { NextResponse } from "next/server";
import { getMessage, getGmailClient, MAILBOXES } from "@/lib/gmail";

/**
 * POST /api/email/draft-reply
 * Body: { messageId, subject, from, body, snippet, mailbox }
 * Returns: { draft: string } — AI-generated reply text
 */
export async function POST(request) {
  try {
    const { messageId, subject, from, body, snippet, mailbox } = await request.json();
    const mb = MAILBOXES[mailbox] || MAILBOXES.joseph;

    // Fetch full body if we only have a snippet
    let emailBody = body || snippet || "";
    if (!body && messageId) {
      try {
        const msg = await getMessage(messageId, { mailbox });
        emailBody = msg.body || msg.snippet || snippet || "";
      } catch {}
    }

    const senderIdentity = mailbox === "contact"
      ? "the Steel Hearts Customer Service team"
      : "Joseph Wiseman, Executive Director of Steel Hearts Foundation";
    const signOff = mailbox === "contact"
      ? "Steel Hearts Customer Service"
      : "Joseph Wiseman, Steel Hearts Foundation";

    const prompt = `You are drafting an email reply on behalf of ${senderIdentity} — a 501(c)(3) nonprofit that honors fallen military service members through memorial bracelets, family remembrance, and charitable giving.

Write a reply to the following email. Be warm, professional, and genuine. Match the tone of the original. Keep it concise. Sign off as ${signOff}.

Do not include a subject line. Just write the body of the reply.

---
FROM: ${from}
SUBJECT: ${subject}
---
${emailBody}
---

Write the reply now:`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const json = await response.json();
    const draft = json.content?.[0]?.text || "";
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("[draft-reply] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/email/draft-reply
 * Body: { to, subject, body, threadId?, messageId? }
 * Saves to Gmail drafts with proper threading. Returns { draftId }
 */
export async function PUT(request) {
  try {
    const { to, subject, body, threadId, messageId, mailbox } = await request.json();
    if (!to || !body) {
      return NextResponse.json({ error: "to and body required" }, { status: 400 });
    }

    const mb = MAILBOXES[mailbox] || MAILBOXES.joseph;
    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

    const headers = [
      `From: ${mb.name} <${mb.email}>`,
      `To: ${to}`,
      `Subject: ${replySubject}`,
      `Content-Type: text/plain; charset=UTF-8`,
    ];
    if (messageId) headers.push(`In-Reply-To: ${messageId}`, `References: ${messageId}`);

    const rawMessage = [...headers, "", body].join("\r\n");
    const encoded = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const gmail = await getGmailClient(mb.email);
    const draft = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encoded,
          ...(threadId ? { threadId } : {}),
        },
      },
    });

    return NextResponse.json({ draftId: draft.data.id, ok: true });
  } catch (err) {
    console.error("[draft-reply] Save error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
