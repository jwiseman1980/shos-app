import { google } from "googleapis";

// ---------------------------------------------------------------------------
// Google Calendar API client using Google Workspace domain-wide delegation.
// Uses the same service account as Gmail + Drive.
//
// Environment variables:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL — the service account email
//   GOOGLE_SERVICE_ACCOUNT_KEY   — the private key (PEM format, with \n for newlines)
// ---------------------------------------------------------------------------

// 2-Calendar Architecture (established 2026-04-01)
// Primary = all human tasks (Joseph's schedule). Color codes distinguish functional areas.
// Ops = system/reference events only (anniversary markers, automated Cowork tasks).
const CALENDARS = {
  primary:  "joseph.wiseman@steel-hearts.org",
  ops:      "c_8bacccb6cfa706c95402f8ecd9d762313f448b50cc0e28b0f8e8b702e8f8bbc5@group.calendar.google.com",  // SHOS Operations (anniversary markers + automated tasks)
};

// Map SHOS app pages to colorId for functional categorization when creating events.
// All events go on Primary calendar — colorId distinguishes the domain.
const PAGE_TO_COLOR = {
  "/":              "6",   // Tangerine — Ops
  "/finance":       "5",   // Banana — Finance
  "/bracelets":     "6",   // Tangerine — Ops
  "/orders":        "6",
  "/shipping":      "6",
  "/inventory":     "6",
  "/laser":         "6",
  "/designs":       "6",
  "/comms":         "6",   // Tangerine — Ops
  "/comms/social":  "6",
  "/dev":           "9",   // Blueberry — Partnerships
  "/donors":        "9",
  "/family":        "10",  // Basil — Family
  "/families":      "10",
  "/anniversaries": "10",
  "/messages":      "10",
  "/volunteers":    "10",
  "/cos":           "3",   // Grape — Governance
  "/sops":          "3",
  "/org":           "3",
};


/**
 * Build an authenticated Calendar client that impersonates joseph.wiseman@steel-hearts.org.
 */
async function getCalendarClient() {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "")
    .replace(/^"|"$/g, "")  // Strip surrounding quotes if present
    .replace(/\\n/g, "\n"); // Convert literal \n to newlines


  if (!serviceEmail || !privateKey) {
    throw new Error(
      "Google service account not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY."
    );
  }

  const auth = new google.auth.JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: "joseph.wiseman@steel-hearts.org",
  });

  try {
    await auth.authorize();
  } catch (authErr) {
    console.error("[calendar] Auth failed:", authErr.code, authErr.message);
    throw authErr;
  }
  return google.calendar({ version: "v3", auth });
}

/**
 * Get the calendar ID for a given role key.
 * @param {string} role — domain key: primary, ops, cto, ed, cos, cfo, coo, comms, dev, family
 * @returns {string} calendar ID
 */
export function getCalendarId(role) {
  return CALENDARS[role] || CALENDARS.primary;
}

/**
 * Get the default role for a given SHOS app page path.
 * @param {string} pathname
 * @returns {string} role key
 */
export function getRoleForPage(pathname) {
  // All events now go on Primary. This function kept for backward compat.
  return "primary";
}

/**
 * Get the functional colorId for a given SHOS app page path.
 * @param {string} pathname
 * @returns {string} Google Calendar colorId
 */
export function getColorForPage(pathname) {
  if (PAGE_TO_COLOR[pathname]) return PAGE_TO_COLOR[pathname];
  for (const [prefix, colorId] of Object.entries(PAGE_TO_COLOR)) {
    if (pathname.startsWith(prefix) && prefix !== "/") return colorId;
  }
  return "6"; // Default: Tangerine (Ops)
}

/**
 * Get today's events across all role calendars (or specific ones).
 *
 * @param {object} [options]
 * @param {string[]} [options.roles] — which calendars to query (default: all)
 * @param {string} [options.timeMin] — ISO start (default: start of today ET)
 * @param {string} [options.timeMax] — ISO end (default: end of today ET)
 * @param {string} [options.timeZone] — IANA timezone (default: America/New_York)
 * @returns {Promise<Array>} sorted events with role tags
 */
export async function getTodayEvents({
  roles,
  timeMin,
  timeMax,
  timeZone = "America/New_York",
} = {}) {
  const cal = await getCalendarClient();

  // Default to today in ET
  if (!timeMin || !timeMax) {
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = etFormatter.format(now); // YYYY-MM-DD
    // Google Calendar API requires RFC3339 with timezone offset
    const etOffset = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(now).find(p => p.type === "timeZoneName")?.value || "GMT-5";
    // Convert "GMT-4" → "-04:00", "GMT-5" → "-05:00"
    const m = etOffset.match(/GMT([+-])(\d+)/);
    const tzSuffix = m ? `${m[1]}${m[2].padStart(2, "0")}:00` : "-05:00";
    timeMin = timeMin || `${todayStr}T00:00:00${tzSuffix}`;
    timeMax = timeMax || `${todayStr}T23:59:59${tzSuffix}`;
  }

  const rolesToQuery = roles || Object.keys(CALENDARS);
  const allEvents = [];

  // Fetch all calendars in parallel
  const results = await Promise.allSettled(
    rolesToQuery.map(async (role) => {
      const calendarId = CALENDARS[role];
      if (!calendarId) return [];

      try {
        const res = await cal.events.list({
          calendarId,
          timeMin,
          timeMax,
          timeZone,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 50,
        });

        return (res.data.items || []).map((event) => ({
          id: event.id,
          calendarId,
          role,
          summary: event.summary || "(no title)",
          description: event.description || "",
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          allDay: !!event.start?.date,
          status: event.status,
          colorId: event.colorId,
          htmlLink: event.htmlLink,
        }));
      } catch (err) {
        const detail = err.response?.data?.error || err.errors || err.message;
        console.error(`[calendar] Failed to fetch ${role}:`, JSON.stringify(detail));
        return [];
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allEvents.push(...result.value);
    }
  }

  // Sort by start time, all-day events first
  allEvents.sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return new Date(a.start) - new Date(b.start);
  });

  return allEvents;
}

/**
 * Get upcoming events (next N hours) for dashboard "what's next" widget.
 *
 * @param {number} [hours=4] — how far ahead to look
 * @returns {Promise<Array>} upcoming events
 */
export async function getUpcomingEvents(hours = 4) {
  const now = new Date();
  const future = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return getTodayEvents({
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
  });
}

/**
 * Create a calendar event.
 *
 * @param {object} params
 * @param {string} params.role — role key (determines which calendar)
 * @param {string} params.summary — event title
 * @param {string} params.description — event description (context, follow-ups, etc.)
 * @param {string} params.startTime — ISO datetime or YYYY-MM-DD for all-day
 * @param {string} params.endTime — ISO datetime or YYYY-MM-DD for all-day
 * @param {string} [params.timeZone] — IANA timezone (default: America/New_York)
 * @param {string} [params.colorId] — Google Calendar color ID (1-11)
 * @returns {Promise<object>} created event
 */
export async function createEvent({
  role,
  summary,
  description,
  startTime,
  endTime,
  timeZone = "America/New_York",
  colorId,
}) {
  const cal = await getCalendarClient();
  // All human tasks go on Primary. Only system events go on Ops.
  const calendarId = (role === "ops") ? CALENDARS.ops : CALENDARS.primary;

  const isAllDay = startTime.length === 10; // YYYY-MM-DD

  const eventBody = {
    summary,
    description,
    start: isAllDay
      ? { date: startTime }
      : { dateTime: startTime, timeZone },
    end: isAllDay
      ? { date: endTime }
      : { dateTime: endTime, timeZone },
  };

  if (colorId) eventBody.colorId = colorId;

  const res = await cal.events.insert({
    calendarId,
    requestBody: eventBody,
  });

  return {
    id: res.data.id,
    calendarId,
    role,
    summary: res.data.summary,
    htmlLink: res.data.htmlLink,
    start: res.data.start?.dateTime || res.data.start?.date,
    end: res.data.end?.dateTime || res.data.end?.date,
  };
}

/**
 * Update a calendar event's description (for session closeout, accomplishment logging).
 *
 * @param {object} params
 * @param {string} params.calendarId — calendar ID
 * @param {string} params.eventId — event ID
 * @param {object} params.updates — fields to update (summary, description, colorId)
 * @returns {Promise<object>} updated event
 */
export async function updateEvent({ calendarId, eventId, updates }) {
  const cal = await getCalendarClient();

  const res = await cal.events.patch({
    calendarId,
    eventId,
    requestBody: updates,
  });

  return {
    id: res.data.id,
    summary: res.data.summary,
    htmlLink: res.data.htmlLink,
  };
}

/**
 * Log a completed execution as a calendar event.
 * Creates a past event on the appropriate role calendar with accomplishment context.
 *
 * @param {object} params
 * @param {string} params.domain — family, finance, operations, comms, development, governance
 * @param {string} params.title — what was accomplished
 * @param {string} params.outcome — detailed description of results
 * @param {string} params.startedAt — ISO timestamp when work started
 * @param {string} params.completedAt — ISO timestamp when work finished
 * @param {number} [params.durationMinutes] — actual duration
 * @returns {Promise<object>} created event
 */
export async function logExecutionToCalendar({
  domain,
  title,
  outcome,
  startedAt,
  completedAt,
  durationMinutes,
}) {
  // All execution logs go on Primary calendar with functional colorId
  const domainToColor = {
    family: "10",      // Basil
    finance: "5",      // Banana
    operations: "6",   // Tangerine
    comms: "6",        // Tangerine
    development: "9",  // Blueberry
    governance: "3",   // Grape
  };

  const role = "primary";

  const description = [
    `COMPLETED: ${title}`,
    "",
    outcome || "",
    "",
    durationMinutes ? `Duration: ${durationMinutes} minutes` : "",
    `Logged: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  return createEvent({
    role,
    summary: `\u2714 ${title}`,
    description,
    startTime: startedAt || completedAt,
    endTime: completedAt,
    colorId: domainToColor[domain] || "2", // Functional color, fallback Sage
  });
}

// Export calendar map for external use
export { CALENDARS, PAGE_TO_COLOR };
