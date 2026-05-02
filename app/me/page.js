export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import MyAssignmentsClient from "@/components/MyAssignmentsClient";
import { getSessionUserWithId } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase";
import { getMonthName, getCurrentMonth, getCurrentYear, getDayOfMonth, yearsSince } from "@/lib/dates";

const ANNIVERSARY_OPEN = ["not_started", "prep", "assigned", "email_drafted", "in_progress"];
const ANNIVERSARY_DONE = ["sent", "email_sent", "scheduled", "complete", "completed", "social_posted"];

function normalizeAnnStatus(s) {
  return (s || "not_started").toLowerCase().replace(/\s+/g, "_");
}

export default async function MyAssignmentsPage() {
  const user = await getSessionUserWithId();
  if (!user) redirect("/login");

  const sb = getServerClient();
  const userId = user.userId;
  const userName = user.name;
  const userEmail = user.email;

  // --- Tasks assigned to me ---
  // assigned_to may hold uuid (FK), name, or email — match all three for legacy data.
  const orFilters = [];
  if (userId) orFilters.push(`assigned_to.eq.${userId}`);
  if (userName) orFilters.push(`assigned_to.eq.${userName.replace(/,/g, "")}`);
  if (userEmail) orFilters.push(`assigned_to.eq.${userEmail}`);

  let myTasks = [];
  if (orFilters.length > 0) {
    const { data } = await sb
      .from("tasks")
      .select("id, title, description, status, priority, role, domain, due_date, hero_id, tags, source_type, source_id, created_at, updated_at")
      .or(orFilters.join(","))
      .not("status", "in", '("done","cancelled")')
      .order("priority", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false });
    myTasks = data || [];
  }

  // --- Anniversary heroes assigned to me (by user_id FK) ---
  let myAnniversaries = [];
  if (userId) {
    const { data } = await sb
      .from("heroes")
      .select(`
        id, sf_id, name, rank, first_name, last_name, branch,
        memorial_date, memorial_month, memorial_day,
        anniversary_status, anniversary_notes, anniversary_completed_date,
        family_contact:contacts_legacy!family_contact_id(first_name, last_name, email)
      `)
      .eq("anniversary_assigned_to", userId)
      .eq("active_listing", true);

    myAnniversaries = (data || []).map((h) => {
      const fullName = [h.rank, h.first_name, h.last_name].filter(Boolean).join(" ").trim() || h.name;
      const fc = h.family_contact;
      return {
        id: h.id,
        sfId: h.sf_id,
        fullName,
        branch: h.branch,
        memorialDate: h.memorial_date,
        memorialMonth: h.memorial_month,
        memorialDay: h.memorial_day,
        dayOfMonth: getDayOfMonth(h.memorial_date) || h.memorial_day,
        years: yearsSince(h.memorial_date),
        status: normalizeAnnStatus(h.anniversary_status),
        notes: h.anniversary_notes,
        familyContactName: fc ? `${fc.first_name || ""} ${fc.last_name || ""}`.trim() : null,
        familyContactEmail: fc?.email || null,
        needsResearch: !fc?.email,
      };
    });
  }

  // Split anniversaries: open vs done
  const annOpen = myAnniversaries.filter((a) => !ANNIVERSARY_DONE.includes(a.status));
  const annDone = myAnniversaries.filter((a) => ANNIVERSARY_DONE.includes(a.status));

  // Sort tasks by domain for grouping
  const tasksByDomain = {};
  for (const t of myTasks) {
    const key = t.domain || "general";
    if (!tasksByDomain[key]) tasksByDomain[key] = [];
    tasksByDomain[key].push(t);
  }

  // For Chris Marti / anniversary-team folks: show this month's unassigned heroes available to claim
  const isAnniversaryTeam =
    user.domains?.includes("Anniversary Emails") || user.domains?.includes("All");
  let availableToClaim = [];
  if (isAnniversaryTeam) {
    const month = getCurrentMonth();
    const { data } = await sb
      .from("heroes")
      .select(`
        id, sf_id, name, rank, first_name, last_name, branch,
        memorial_date, memorial_month, memorial_day,
        anniversary_status, anniversary_assigned_to,
        family_contact:contacts_legacy!family_contact_id(first_name, last_name, email)
      `)
      .eq("active_listing", true)
      .eq("memorial_type", "individual")
      .eq("memorial_month", month)
      .is("anniversary_assigned_to", null);

    availableToClaim = (data || [])
      .filter((h) => !ANNIVERSARY_DONE.includes(normalizeAnnStatus(h.anniversary_status)))
      .map((h) => {
        const fullName = [h.rank, h.first_name, h.last_name].filter(Boolean).join(" ").trim() || h.name;
        const fc = h.family_contact;
        return {
          id: h.id,
          sfId: h.sf_id,
          fullName,
          branch: h.branch,
          memorialDate: h.memorial_date,
          dayOfMonth: getDayOfMonth(h.memorial_date) || h.memorial_day,
          years: yearsSince(h.memorial_date),
          status: normalizeAnnStatus(h.anniversary_status),
          familyContactName: fc ? `${fc.first_name || ""} ${fc.last_name || ""}`.trim() : null,
          familyContactEmail: fc?.email || null,
          needsResearch: !fc?.email,
        };
      })
      .sort((a, b) => (a.dayOfMonth || 0) - (b.dayOfMonth || 0));
  }

  const firstName = user.name?.split(" ")[0] || "there";
  const totalOpen = myTasks.length + annOpen.length;
  const monthName = getMonthName(getCurrentMonth());

  return (
    <PageShell
      title={`Hi ${firstName}`}
      subtitle={
        totalOpen > 0
          ? `You have ${totalOpen} open assignment${totalOpen === 1 ? "" : "s"}. Heads-up: you can also do all of this from Slack — this page is here for the details.`
          : "You're all caught up. New assignments will arrive in your Slack DMs."
      }
    >
      <div className="stat-grid">
        <StatBlock
          label="Open Assignments"
          value={totalOpen}
          accent="var(--gold)"
        />
        {annOpen.length > 0 && (
          <StatBlock
            label="Anniversary Emails"
            value={annOpen.length}
            note={`${monthName} & later`}
            accent="var(--status-blue)"
          />
        )}
        {myTasks.length > 0 && (
          <StatBlock
            label="Tasks"
            value={myTasks.length}
            accent="var(--status-purple)"
          />
        )}
        {annDone.length > 0 && (
          <StatBlock
            label="Sent / Scheduled"
            value={annDone.length}
            accent="var(--status-green)"
          />
        )}
      </div>

      <MyAssignmentsClient
        tasks={myTasks}
        annOpen={annOpen}
        annDone={annDone}
        availableToClaim={availableToClaim}
        currentUser={{ userId, name: userName, email: userEmail }}
        isAnniversaryTeam={isAnniversaryTeam}
        monthName={monthName}
      />

      {user.isFounder && (
        <DataCard title="Admin shortcuts">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
            <Link className="btn btn-ghost" href="/dashboard/today">Full triage feed</Link>
            <Link className="btn btn-ghost" href="/pipelines">Pipelines</Link>
            <Link className="btn btn-ghost" href="/anniversaries">All anniversaries</Link>
            <Link className="btn btn-ghost" href="/tasks">All tasks</Link>
          </div>
        </DataCard>
      )}
    </PageShell>
  );
}
