import { NextResponse } from "next/server";
import { getTodayEvents, getUpcomingEvents, createEvent, updateEvent, logExecutionToCalendar, CALENDARS } from "@/lib/calendar";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar — Get today's events across all role calendars.
 *
 * Query params:
 *   ?upcoming=4  — get events in the next N hours instead of full day
 *   ?roles=cto,cfo — filter to specific role calendars
 *   ?date=2026-04-01 — get events for a specific date
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get("upcoming");
    const rolesParam = searchParams.get("roles");
    const date = searchParams.get("date");

    let events;

    if (upcoming) {
      events = await getUpcomingEvents(parseInt(upcoming, 10) || 4);
    } else {
      const options = {};
      if (rolesParam) {
        options.roles = rolesParam.split(",").map((r) => r.trim());
      }
      if (date) {
        options.timeMin = `${date}T00:00:00`;
        options.timeMax = `${date}T23:59:59`;
      }
      events = await getTodayEvents(options);
    }

    return NextResponse.json({
      success: true,
      count: events.length,
      events,
      calendars: Object.keys(CALENDARS),
    });
  } catch (error) {
    console.error("[api/calendar] GET error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar — Create or update a calendar event.
 *
 * Body for create:
 *   { action: "create", role, summary, description, startTime, endTime, colorId }
 *
 * Body for update:
 *   { action: "update", calendarId, eventId, updates: { summary, description, colorId } }
 *
 * Body for log execution:
 *   { action: "log", domain, title, outcome, startedAt, completedAt, durationMinutes }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "create") {
      const event = await createEvent({
        role: body.role,
        summary: body.summary,
        description: body.description,
        startTime: body.startTime,
        endTime: body.endTime,
        timeZone: body.timeZone,
        colorId: body.colorId,
      });
      return NextResponse.json({ success: true, event });
    }

    if (action === "update") {
      const event = await updateEvent({
        calendarId: body.calendarId,
        eventId: body.eventId,
        updates: body.updates,
      });
      return NextResponse.json({ success: true, event });
    }

    if (action === "log") {
      const event = await logExecutionToCalendar({
        domain: body.domain,
        title: body.title,
        outcome: body.outcome,
        startedAt: body.startedAt,
        completedAt: body.completedAt,
        durationMinutes: body.durationMinutes,
      });
      return NextResponse.json({ success: true, event });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("[api/calendar] POST error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
