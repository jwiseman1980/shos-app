import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { sendSlackDm, buildAnniversaryAssignedMessage } from "@/lib/slack-actions";

/**
 * POST /api/anniversaries/push-tasks
 * Pushes all pending anniversary email tasks to the assigned volunteer via Slack DM.
 * Runs server-side so signed action URLs use the correct SESSION_SECRET.
 *
 * Body: { volunteerEmail?: string }
 *   - If provided, pushes tasks for that volunteer only
 *   - If omitted, pushes tasks for ALL volunteers with pending assignments
 *
 * Auth: SHOS_API_KEY or CRON_SECRET
 */
export async function POST(request) {
  const apiKey = process.env.SHOS_API_KEY;
  const key = request.headers.get("x-api-key");
  if (!apiKey || key !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { volunteerEmail } = await request.json().catch(() => ({}));
    const sb = getServerClient();

    // Build query for heroes with pending anniversary tasks
    let query = sb
      .from("heroes")
      .select(`
        id, name, rank, branch, memorial_date, memorial_month, memorial_day,
        anniversary_status, anniversary_assigned_to,
        family_contact:contacts!family_contact_id(first_name, last_name, email),
        assigned_user:users!anniversary_assigned_to(id, name, email)
      `)
      .not("anniversary_status", "in", "(sent,scheduled)")
      .not("anniversary_assigned_to", "is", null)
      .order("memorial_month", { ascending: true })
      .order("memorial_day", { ascending: true });

    const { data: heroes, error } = await query;
    if (error) throw error;

    // Filter by volunteer if specified
    let filtered = heroes || [];
    if (volunteerEmail) {
      filtered = filtered.filter(
        (h) => h.assigned_user?.email?.toLowerCase() === volunteerEmail.toLowerCase()
      );
    }

    if (filtered.length === 0) {
      return NextResponse.json({ success: true, message: "No pending tasks found", pushed: 0 });
    }

    // Group by volunteer
    const byVolunteer = {};
    for (const h of filtered) {
      const vol = h.assigned_user;
      if (!vol?.email) continue;
      if (!byVolunteer[vol.email]) {
        byVolunteer[vol.email] = { name: vol.name, email: vol.email, heroes: [] };
      }
      byVolunteer[vol.email].heroes.push(h);
    }

    const results = [];

    for (const [email, vol] of Object.entries(byVolunteer)) {
      // Build summary message
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentDay = now.getDate();

      const overdue = vol.heroes.filter(
        (h) => h.memorial_month < currentMonth ||
          (h.memorial_month === currentMonth && h.memorial_day < currentDay)
      );
      const upcoming = vol.heroes.filter(
        (h) => h.memorial_month > currentMonth ||
          (h.memorial_month === currentMonth && h.memorial_day >= currentDay)
      );

      const lines = [`📋 *Your Anniversary Email Tasks* (${vol.heroes.length} pending)\n`];

      if (overdue.length > 0) {
        lines.push(`🚨 *OVERDUE (${overdue.length})*\n`);
        for (const h of overdue) {
          const familyContact = h.family_contact?.email
            ? `${h.family_contact.first_name || ""} ${h.family_contact.last_name || ""}`.trim() + ` (${h.family_contact.email})`
            : "⚠️ No family email on file";
          const dateStr = `${h.memorial_month}/${h.memorial_day}`;
          lines.push(buildAnniversaryAssignedMessage(
            h.name, h.memorial_date, familyContact, h.id, vol.name
          ));
          lines.push("");
        }
      }

      if (upcoming.length > 0) {
        lines.push(`\n📅 *UPCOMING (${upcoming.length})*\n`);
        for (const h of upcoming) {
          const familyContact = h.family_contact?.email
            ? `${h.family_contact.first_name || ""} ${h.family_contact.last_name || ""}`.trim() + ` (${h.family_contact.email})`
            : "⚠️ No family email on file";
          lines.push(buildAnniversaryAssignedMessage(
            h.name, h.memorial_date, familyContact, h.id, vol.name
          ));
          lines.push("");
        }
      }

      lines.push("_Click Create Draft for each hero. Review in Gmail, personalize, then Send or Schedule Send. Come back and mark as Sent or Scheduled._");

      const sent = await sendSlackDm(email, lines.join("\n"));
      results.push({ volunteer: vol.name, email, tasks: vol.heroes.length, sent });
    }

    return NextResponse.json({ success: true, results, pushed: results.length });
  } catch (err) {
    console.error("[push-tasks] Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
