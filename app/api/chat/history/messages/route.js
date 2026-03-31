import { NextResponse } from "next/server";
import { addMessage } from "@/lib/data/chat";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { sessionId, role, content, toolCalls, isAuto } = await request.json();

    if (!sessionId || !role || content === undefined) {
      return NextResponse.json(
        { error: "sessionId, role, and content are required" },
        { status: 400 }
      );
    }

    const message = await addMessage({ sessionId, role, content, toolCalls, isAuto });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("POST /api/chat/history/messages error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save message" },
      { status: 500 }
    );
  }
}
