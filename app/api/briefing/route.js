import { google } from "googleapis";

const PERSONAL_CAL = "primary";
const SHOS_CAL = "c_8bacccb6cfa706c95402f8ecd9d762313f448b50cc0e28b0f8e8b702e8f8bbc5@group.calendar.google.com";
const USER_EMAIL = "joseph.wiseman@steel-hearts.org";

function getAuth(scopes) {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "").replace(/\\n/g, "\n");
  if (!serviceEmail || !privateKey) return null;
  return new google.auth.JWT({
    email: serviceEmail,
    key: privateKey,
    scopes,
    subject: USER_EMAIL,
  });
}

async function getCalendarEvents() {
  const auth = getAuth(["https://www.googleapis.com/auth/calendar.readonly"]);
  if (!auth) return { error: "Google service account not configured" };

  try {
    await auth.authorize();
    const cal = google.calendar({ version: "v3", auth });

    const now = new Date();
    const startOfDay = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const [personalRes, shosRes] = await Promise.all([
      cal.events.list({
        calendarId: PERSONAL_CAL,
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        timeZone: "America/New_York",
      }),
      cal.events.list({
        calendarId: SHOS_CAL,
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        timeZone: "America/New_York",
      }),
    ]);

    const mapEvent = (e, cal) => ({
      id: e.id,
      summary: e.summary,
      description: e.description?.substring(0, 200),
      location: e.location,
      start: e.start,
      end: e.end,
      allDay: !!e.start?.date,
      calendar: cal,
    });

    return {
      personal: (personalRes.data.items || []).map((e) => mapEvent(e, "Personal")),
      shos: (shosRes.data.items || []).map((e) => mapEvent(e, "Steel Hearts")),
    };
  } catch (err) {
    return { error: `Calendar: ${err.message}` };
  }
}

async function getUnreadEmails() {
  const auth = getAuth(["https://www.googleapis.com/auth/gmail.readonly"]);
  if (!auth) return { error: "Google service account not configured" };

  try {
    await auth.authorize();
    const gmail = google.gmail({ version: "v1", auth });

    const res = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread newer_than:1d",
      maxResults: 30,
    });

    const messages = res.data.messages || [];
    const emails = [];

    // Fetch headers for each message (batch of first 20)
    for (const msg of messages.slice(0, 20)) {
      try {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const headers = {};
        for (const h of detail.data.payload?.headers || []) {
          headers[h.name] = h.value;
        }

        const labels = detail.data.labelIds || [];
        const isPromo = labels.includes("CATEGORY_PROMOTIONS");
        const isSocial = labels.includes("CATEGORY_SOCIAL");

        // Skip promotions and social
        if (isPromo || isSocial) continue;

        // Classify
        const from = headers.From || "";
        const subject = headers.Subject || "";
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

        emails.push({
          id: msg.id,
          from: from.replace(/<[^>]+>/, "").trim(),
          subject,
          date: headers.Date,
          category,
          labels,
        });
      } catch {
        // skip individual message errors
      }
    }

    return {
      totalUnread: messages.length,
      emails,
    };
  } catch (err) {
    return { error: `Gmail: ${err.message}` };
  }
}

export async function GET(request) {
  // Verify API key
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.SHOS_API_KEY;
  if (expectedKey && apiKey !== expectedKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [calendar, emails] = await Promise.all([
    getCalendarEvents(),
    getUnreadEmails(),
  ]);

  return Response.json({
    success: true,
    calendar,
    emails,
    generated: new Date().toISOString(),
  });
}
