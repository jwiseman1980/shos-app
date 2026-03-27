import { NextResponse } from "next/server";
import { setCharityDesignation } from "@/lib/data/families";

/** POST — Step 4: Set charity designation */
export async function POST(req) {
  try {
    const { heroId, orgName } = await req.json();

    if (!heroId || !orgName) {
      return NextResponse.json(
        { success: false, error: "Missing required: heroId, orgName" },
        { status: 400 }
      );
    }

    const result = await setCharityDesignation(heroId, orgName);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Set charity error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
