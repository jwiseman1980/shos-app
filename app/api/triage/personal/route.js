import { getServerClient } from "@/lib/supabase";
import { getTasks } from "@/lib/data/tasks";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function urgencyFromDate(dateStr) {
  if (!dateStr) return { priority: 1, section: "TRACKED", urgency: "SOMEDAY" };
  const d = new Date(dateStr);
  const diffDays = Math.ceil((d - new Date()) / 86400000);
  if (diffDays < 0) return { priority: 4, section: "TODAY", urgency: "OVERDUE" };
  if (diffDays === 0) return { priority: 3, section: "TODAY", urgency: "TODAY" };
  if (diffDays <= 7) return { priority: 2, section: "WEEK", urgency: "WEEK" };
  return { priority: 1, section: "TRACKED", urgency: "SOMEDAY" };
}

function getHardcodedPersonal() {
  return [
    {
      id: "personal-haith-lease",
      type: "PROPERTY",
      priority: 3,
      section: "TODAY",
      urgency: "TODAY",
      accentColor: "#3b82f6",
      icon: "🏠",
      title: "Haith lease — Schoolfield Drive",
      subtitle: "$3,000/mo · starts Jul 1, 2026 · pending review",
      badgeLabel: "PENDING",
      badgeClass: "badge-today",
      brief: "Lease sent to Kim Haith Apr 18 for Schoolfield Drive — $3K/mo, Jul 1, 2026 start. Awaiting her review and pet details before signing.",
      context: {
        address: "Schoolfield Drive",
        tenant: "Kim Haith",
        rentAmount: 3000,
        leaseEnd: null,
        status: "pending_review",
        notes: "Sent Apr 18. Awaiting review + pet details from Kim. Move-in target Jul 1, 2026.",
      },
    },
    {
      id: "personal-cary-vacancy",
      type: "PROPERTY",
      priority: 3,
      section: "TODAY",
      urgency: "TODAY",
      accentColor: "#3b82f6",
      icon: "🏠",
      title: "Cary — vacancy timeline",
      subtitle: "Vacant · need tenant placement plan",
      badgeLabel: "VACANT",
      badgeClass: "badge-today",
      brief: "Cary property is currently vacant. No active tenant pipeline. Need to set a placement timeline (listing, showings, target close) to stop carrying costs.",
      context: {
        address: "Cary",
        tenant: null,
        rentAmount: null,
        status: "vacant",
        notes: "No tenant pipeline yet. Decide list price + timeline to avoid extended vacancy cost.",
      },
    },
  ];
}

async function getOpenTasksFromSupabase() {
  try {
    const tasks = await getTasks({ includeCompleted: false });
    const filtered = tasks.filter((t) => t.status !== "complete" && t.status !== "done" && t.status !== "cancelled");

    return filtered.slice(0, 15).map((t) => {
      const { priority, section, urgency } = urgencyFromDate(t.due_date);
      const finalPriority = t.priority === "critical" ? 4 : t.priority === "high" ? 3 : priority;
      const finalSection = t.priority === "critical" || t.priority === "high" ? "TODAY" : section;

      const dueLabel = t.due_date
        ? `Due ${new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : null;

      return {
        id: `task-${t.id}`,
        type: "TASK",
        priority: finalPriority,
        section: finalSection,
        urgency: finalSection === "TODAY" ? (finalPriority >= 4 ? "OVERDUE" : "TODAY") : urgency,
        accentColor: "#6b7280",
        icon: "✅",
        title: t.title || t.name || "(untitled task)",
        subtitle: [t.role, dueLabel].filter(Boolean).join(" · "),
        badgeLabel: (t.priority || "").toUpperCase() || "TASK",
        badgeClass: t.priority === "critical" ? "badge-overdue" : t.priority === "high" ? "badge-today" : "badge-week",
        brief: t.description || t.notes || `${t.title || "Task"} — ${(t.priority || "medium")} priority${dueLabel ? `, ${dueLabel.toLowerCase()}` : ""}.`,
        context: {
          taskId: t.id,
          role: t.role,
          dueDate: t.due_date,
          status: t.status,
          notes: t.notes || t.description,
          source: "Supabase tasks",
        },
      };
    });
  } catch {
    return [];
  }
}

async function getPropertiesNeedingAttention() {
  const sb = getServerClient();
  const items = [];
  try {
    const { data } = await sb.from("properties").select("*");
    for (const p of data || []) {
      if (!p) continue;
      const isVacant = !p.tenant_name && !p.tenant;
      const negativeCashflow = (p.monthly_cash_flow || 0) < 0;
      if (!isVacant && !negativeCashflow) continue;

      items.push({
        id: `prop-${p.id}`,
        type: "PROPERTY",
        priority: negativeCashflow ? 3 : 2,
        section: negativeCashflow ? "TODAY" : "WEEK",
        urgency: negativeCashflow ? "TODAY" : "WEEK",
        accentColor: "#3b82f6",
        icon: "🏠",
        title: p.address || p.name || "Property",
        subtitle: isVacant ? "Vacant" : `Tenant: ${p.tenant_name || p.tenant}`,
        badgeLabel: negativeCashflow ? "CASH DRAIN" : isVacant ? "VACANT" : "TRACKED",
        badgeClass: negativeCashflow ? "badge-overdue" : "badge-today",
        brief: p.notes || `${p.address || p.name}: ${isVacant ? "vacant" : "occupied"}${negativeCashflow ? `, monthly cash flow ${p.monthly_cash_flow}` : ""}.`,
        context: {
          address: p.address,
          tenant: p.tenant_name || p.tenant,
          rentAmount: p.rent_amount || p.monthly_rent,
          leaseEnd: p.lease_end_date,
          status: p.status,
          notes: p.notes,
          monthlyCashFlow: p.monthly_cash_flow,
        },
      });
    }
  } catch {}
  return items;
}

export async function GET() {
  const [tasks, properties] = await Promise.allSettled([
    getOpenTasksFromSupabase(),
    getPropertiesNeedingAttention(),
  ]);

  const items = [
    ...getHardcodedPersonal(),
    ...(tasks.status === "fulfilled" ? tasks.value : []),
    ...(properties.status === "fulfilled" ? properties.value : []),
  ];

  return Response.json({
    items,
    counts: {
      hardcoded: 2,
      tasks: tasks.status === "fulfilled" ? tasks.value.length : 0,
      properties: properties.status === "fulfilled" ? properties.value.length : 0,
    },
  });
}
