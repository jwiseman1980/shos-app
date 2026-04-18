import { buildTriageGmailClient, triageInbox } from "@/lib/email-triage";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const gmail = await buildTriageGmailClient();
    const threads = await triageInbox(gmail);
    return Response.json({
      threads,
      count: threads.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[email-triage]", err.message);
    return Response.json({ error: err.message, threads: [] }, { status: 500 });
  }
}
