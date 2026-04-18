import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const client = new Anthropic();

export async function POST(request) {
  try {
    const { draft, instruction, context } = await request.json();

    if (!draft || !instruction) {
      return Response.json({ error: "draft and instruction required" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are helping Joseph Wiseman (Executive Director, Steel Hearts Foundation) refine an email draft. Joseph runs a military memorial nonprofit. His emails are warm but direct, never corporate.

Email context:
- To: ${context?.to || "recipient"}
- Subject: ${context?.subject || ""}
- Category: ${context?.category || "general"}

Current draft:
${draft}

Instruction: ${instruction}

Return ONLY the revised draft text. No explanation, no preamble, no "Here is the revised draft:" — just the draft itself.`,
        },
      ],
    });

    const revised = message.content[0]?.text || draft;
    return Response.json({ draft: revised });
  } catch (err) {
    console.error("[adjust-draft] Error:", err.message);
    return Response.json({ error: "Adjustment failed", message: err.message }, { status: 500 });
  }
}
