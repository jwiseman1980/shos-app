import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a research assistant for the Steel Hearts Foundation, a nonprofit that creates memorial bracelets for fallen U.S. service members and first responders.

You will be given a hero's name and any available context. Your job is to identify the person and return what you can determine about them, drawing on your training knowledge. Use the web_search tool to fill gaps when needed.

Return a single JSON object with these fields (omit any field you cannot confirm — never guess):
{
  "name": "Full display name with rank, e.g. CPT Brandon Stevenson",
  "rank": "CPT",
  "first_name": "Brandon",
  "last_name": "Stevenson",
  "branch": "USA | USN | USMC | USAF | USSF | USCG | FIRE | Other",
  "academy": "USMA | USNA | USAFA | USCGA | USMMA | None",
  "grad_year": "2008",
  "memorial_month": 4,
  "memorial_day": 17,
  "memorial_year": 2009,
  "incident": "Brief one-line description of how/where they fell",
  "location": "Helmand Province, Afghanistan",
  "unit": "10th Mountain Division",
  "design_notes": "1-2 sentence brief for the bracelet designer about distinguishing details — academy seal, unit patch, memorial wall reference, etc."
}

Rules:
- Return ONLY valid JSON. No prose, no preamble, no markdown fences.
- If you cannot identify the hero with reasonable confidence, return {"error": "Could not identify hero", "suggestions": "what additional info would help"}.
- "branch" must be one of the listed enum values. Use "FIRE" for firefighters, "Other" if uncertain.
- "academy" should be "None" unless they're a service academy graduate.
- Months are 1-12, days 1-31.`;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, context } = body;
  if (!name || !name.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const userMessage = [
    `Name: ${name.trim()}`,
    context && context.trim() ? `Context: ${context.trim()}` : null,
    "",
    "Return the JSON object as instructed.",
  ]
    .filter(Boolean)
    .join("\n");

  let message;
  try {
    message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    console.error("[heroes/research] Anthropic error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }

  let text = "";
  for (const block of message.content || []) {
    if (block.type === "text" && block.text) text += block.text;
  }

  text = text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
  }

  let parsed;
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON object in response");
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    console.warn("[heroes/research] parse failed:", err.message, "raw:", text.slice(0, 300));
    return Response.json({
      error: "Could not parse research result",
      raw: text.slice(0, 800),
    }, { status: 502 });
  }

  if (parsed.error) {
    return Response.json(parsed, { status: 200 });
  }

  return Response.json({
    success: true,
    research: parsed,
    usage: {
      input_tokens: message.usage?.input_tokens,
      output_tokens: message.usage?.output_tokens,
    },
  });
}
