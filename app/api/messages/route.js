import { NextResponse } from "next/server";

/**
 * GET /api/messages?action=stats|grouped|duplicates|list
 * Family Message data endpoint — reads from Salesforce Family_Message__c
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "stats";

    // Optional API key check (same pattern as anniversaries)
    const apiKey = request.headers.get("x-api-key");
    if (process.env.SHOS_API_KEY && apiKey !== process.env.SHOS_API_KEY) {
      // Allow unauthenticated access from the app itself (no key header)
      // but reject wrong keys
      if (apiKey) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
      }
    }

    const {
      getAllMessages,
      getMessagesGroupedByHero,
      getMessageStats,
      findDuplicates,
    } = await import("@/lib/data/messages");

    switch (action) {
      case "stats": {
        const stats = await getMessageStats();
        return NextResponse.json({ success: true, ...stats });
      }

      case "grouped": {
        const groups = await getMessagesGroupedByHero();
        return NextResponse.json({
          success: true,
          count: groups.length,
          data: groups,
        });
      }

      case "duplicates": {
        const dupes = await findDuplicates();
        return NextResponse.json({ success: true, ...dupes });
      }

      case "list": {
        const all = await getAllMessages();
        const status = searchParams.get("status");
        const source = searchParams.get("source");
        let filtered = all;
        if (status) filtered = filtered.filter((m) => m.status === status);
        if (source) filtered = filtered.filter((m) => m.source === source);
        return NextResponse.json({
          success: true,
          count: filtered.length,
          data: filtered,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Messages API error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
