import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { getAnniversariesNext } from "@/lib/data/heroes";
import volunteers from "@/data/volunteers.json";
import {
  buildAnniversaryAssignedMessage,
  sendSlackDm,
  postWebhook,
} from "@/lib/slack-actions";

/**
 * POST /api/anniversaries/auto-assign
 * Distributes unassigned anniversaries (within the lookahead window)
 * round-robin across available Anniversary-Emails volunteers.
 *
 * Body: { days?: number } — defaults to 30
 *
 * Auth: admin / manager / SHOS_API_KEY
 */
export async function POST(request) {
  const apiKey = process.env.SHOS_API_KEY;
  const headerKey = request.headers.get("x-api-key");
  let allowed = Boolean(apiKey && headerKey === apiKey);

  if (!allowed) {
    const user = await getSessionUser();
    allowed = Boolean(
      user && (user.isFounder || user.appRole === "admin" || user.appRole === "manager")
    );
  }

  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { days = 30 } = await request.json().catch(() => ({}));
    const sb = getServerClient();

    const upcoming = await getAnniversariesNext(days);
    const unassigned = upcoming.filter((h) => !h.anniversaryAssignedTo);

    if (unassigned.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nothing to assign — all upcoming anniversaries already have a volunteer.",
        assigned: 0,
      });
    }

    // Eligible volunteers: appRole volunteer or manager, with Anniversary Emails domain
    const pool = volunteers.filter(
      (v) =>
        (v.appRole === "volunteer" || v.appRole === "manager") &&
        (v.domains || []).some((d) => d === "Anniversary Emails" || d === "All")
    );

    if (pool.length === 0) {
      return NextResponse.json(
        { success: false, error: "No eligible volunteers configured" },
        { status: 400 }
      );
    }

    // Resolve / upsert each volunteer's users.id once
    const userMap = new Map();
    for (const v of pool) {
      let { data: user } = await sb
        .from("users")
        .select("id, email, name")
        .ilike("email", v.email)
        .limit(1)
        .single();
      if (!user) {
        const { data: created } = await sb
          .from("users")
          .upsert(
            {
              email: v.email,
              name: v.name,
              color: v.color || null,
              initials: v.initials || null,
            },
            { onConflict: "email" }
          )
          .select("id, email, name")
          .single();
        user = created;
      }
      if (user?.id) {
        userMap.set(v.email, { ...user, volunteer: v });
      }
    }

    const eligibleVolunteers = [...userMap.values()];
    if (eligibleVolunteers.length === 0) {
      return NextResponse.json(
        { success: false, error: "No volunteer users could be resolved" },
        { status: 500 }
      );
    }

    // Round-robin assignment, ordered by soonest anniversary first
    const assignments = [];
    let i = 0;
    for (const hero of unassigned) {
      const vol = eligibleVolunteers[i % eligibleVolunteers.length];
      assignments.push({ hero, vol });
      i += 1;
    }

    // Persist assignments to Supabase + create tasks
    const persistResults = [];
    for (const { hero, vol } of assignments) {
      try {
        const { error: heroErr } = await sb
          .from("heroes")
          .update({
            anniversary_assigned_to: vol.id,
            anniversary_status: "assigned",
            updated_at: new Date().toISOString(),
          })
          .eq("sf_id", hero.sfId);

        if (heroErr) throw new Error(heroErr.message);

        // Skip task creation if one is already open for this hero
        const heroPk = hero.id || null;
        if (heroPk) {
          const { data: existing } = await sb
            .from("tasks")
            .select("id")
            .eq("hero_id", heroPk)
            .eq("domain", "anniversary")
            .in("status", ["backlog", "todo", "in_progress"])
            .limit(1);

          if (!existing?.length) {
            const dueDate = (() => {
              const now = new Date();
              const m = Number(hero.anniversaryMonth);
              const d = Number(hero.anniversaryDay);
              let target = new Date(now.getFullYear(), m - 1, d);
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              if (target < today) target = new Date(now.getFullYear() + 1, m - 1, d);
              return target.toISOString().slice(0, 10);
            })();

            await sb.from("tasks").insert({
              title: `Anniversary email for ${hero.fullName || hero.name}`,
              description: `Auto-assigned. Anniversary on ${dueDate}. Draft, review in Gmail, send or schedule.`,
              status: "todo",
              priority: "high",
              role: "family",
              domain: "anniversary",
              hero_id: heroPk,
              assigned_to: vol.id,
              due_date: dueDate,
              tags: ["anniversary", "email", "auto-assigned"],
            });
          }
        }

        persistResults.push({
          hero: hero.fullName || hero.name,
          assignedTo: vol.name,
          email: vol.email,
          ok: true,
        });
      } catch (err) {
        persistResults.push({
          hero: hero.fullName || hero.name,
          assignedTo: vol.name,
          email: vol.email,
          ok: false,
          error: err.message,
        });
      }
    }

    // Slack DM each volunteer with their fresh assignments
    const byVolunteer = {};
    for (const r of persistResults) {
      if (!r.ok) continue;
      if (!byVolunteer[r.email]) byVolunteer[r.email] = { name: r.assignedTo, heroes: [] };
      byVolunteer[r.email].heroes.push(r.hero);
    }

    for (const [email, info] of Object.entries(byVolunteer)) {
      const lines = [
        `📋 *Anniversary auto-assignment* — ${info.heroes.length} new ${info.heroes.length === 1 ? "remembrance" : "remembrances"} for you`,
        "",
        ...info.heroes.map((n) => `• ${n}`),
        "",
        `Open the tracker to draft each one: ${process.env.NEXT_PUBLIC_APP_URL || "https://shos-app.vercel.app"}/anniversaries`,
      ];
      const ok = await sendSlackDm(email, lines.join("\n"));
      if (!ok && process.env.SLACK_SOP_WEBHOOK) {
        await postWebhook(
          process.env.SLACK_SOP_WEBHOOK,
          `⚠️ Could not DM ${info.name} their auto-assigned anniversaries`
        );
      }
    }

    const okCount = persistResults.filter((r) => r.ok).length;
    return NextResponse.json({
      success: true,
      assigned: okCount,
      total: unassigned.length,
      volunteers: eligibleVolunteers.length,
      results: persistResults,
    });
  } catch (err) {
    console.error("[auto-assign] Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
