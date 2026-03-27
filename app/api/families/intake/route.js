import { NextResponse } from "next/server";
import { createHeroRecord, getActiveIntakes } from "@/lib/data/families";

const SLACK_WEBHOOK = process.env.SLACK_SOP_WEBHOOK;

async function postSlack(text) {
  if (!SLACK_WEBHOOK) return;
  try {
    await fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.warn("Slack failed:", e.message);
  }
}

/** GET — List active intakes */
export async function GET() {
  try {
    const intakes = await getActiveIntakes();
    return NextResponse.json({ success: true, intakes });
  } catch (err) {
    console.error("Get intakes error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/** POST — Step 1: Create hero record */
export async function POST(req) {
  try {
    const body = await req.json();
    const { firstName, lastName, rank, branch, memorialDate, middleInitial, quote } = body;

    if (!firstName || !lastName || !rank || !branch || !memorialDate) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: firstName, lastName, rank, branch, memorialDate" },
        { status: 400 }
      );
    }

    const result = await createHeroRecord({
      firstName,
      lastName,
      middleInitial,
      rank,
      branch,
      memorialDate,
      quote,
    });

    if (result.success) {
      await postSlack(`\u2728 New hero added: ${result.name} (${branch}) — intake started`);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Create hero error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
