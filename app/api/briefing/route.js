import { getTodayEvents } from "@/lib/calendar";
import { listInbox } from "@/lib/gmail";
import { classifyEmail } from "@/lib/email-classifier";

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
    const classified = (messages || []).map(msg => ({
      id: msg.id,
      from: (msg.from || "").replace(/<[^>]+>/, "").trim(),
      subject: msg.subject || "",
      date: msg.date,
      category: classifyEmail(msg.from, msg.subject),
      labels: msg.labels,
    }));

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
