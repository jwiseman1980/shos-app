import { getTodayEvents } from "@/lib/calendar";
import { listInbox } from "@/lib/gmail";

export async function GET(request) {
  // Verify API key
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.SHOS_API_KEY;
  if (expectedKey && apiKey !== expectedKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let calendar = {};
  let emails = {};

  // Fetch calendar and email data in parallel using shared libs
  const [calResult, emailResult] = await Promise.allSettled([
    getTodayEvents({ roles: ["primary", "ops"] }),
    listInbox({ maxResults: 30, query: "is:unread newer_than:1d" }),
  ]);

  // Process calendar results
  if (calResult.status === "fulfilled") {
    const events = calResult.value;
    calendar = {
      personal: events.filter(e => e.role === "primary").map(mapEvent),
      shos: events.filter(e => e.role !== "primary").map(mapEvent),
    };
  } else {
    calendar = { error: `Calendar: ${calResult.reason?.message || "Unknown error"}` };
  }

  // Process email results
  if (emailResult.status === "fulfilled") {
    const { messages } = emailResult.value;
    // Filter out promos/social (already done by listInbox) and classify
    const classified = (messages || []).map(msg => {
      const from = msg.from || "";
      const subject = msg.subject || "";
      let category = "OTHER";

      if (/tracy|hutter-cpa/i.test(from)) category = "FINANCIAL-CPA";
      else if (/sara|bookkeeper/i.test(from)) category = "FINANCIAL-BOOKKEEPER";
      else if (/rentvine|tailored|abshure|rpm/i.test(from)) category = "PROPERTY";
      else if (/bracelet|memorial.*order/i.test(subject)) category = "BRACELET-REQUEST";
      else if (/gold.star|family.*contact|remembrance/i.test(subject)) category = "FAMILY";
      else if (/squarespace.*donat|donor/i.test(subject)) category = "DONOR";
      else if (/quickbooks|payroll|intuit/i.test(from)) category = "FINANCIAL";
      else if (/usps|ups|fedex|shipstation/i.test(from)) category = "SHIPPING";
      else if (/sagesure|insurance|mortgage|freedom.*mortgage|chase.*mortgage/i.test(from)) category = "INSURANCE-MORTGAGE";
      else if (/york.*electric|utility/i.test(from)) category = "UTILITY";

      return {
        id: msg.id,
        from: from.replace(/<[^>]+>/, "").trim(),
        subject,
        date: msg.date,
        category,
        labels: msg.labels,
      };
    });

    emails = {
      totalUnread: messages?.length || 0,
      emails: classified,
    };
  } else {
    emails = { error: `Gmail: ${emailResult.reason?.message || "Unknown error"}` };
  }

  return Response.json({
    success: true,
    calendar,
    emails,
    generated: new Date().toISOString(),
  });
}

function mapEvent(e) {
  return {
    id: e.id,
    summary: e.summary,
    description: e.description?.substring(0, 200),
    location: e.location,
    start: { dateTime: e.start },
    end: { dateTime: e.end },
    allDay: e.allDay,
    calendar: e.role === "primary" ? "Personal" : "Steel Hearts",
  };
}
