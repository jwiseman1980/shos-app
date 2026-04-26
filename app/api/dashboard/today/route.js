import { getServerClient } from "@/lib/supabase";
import { buildTriageGmailClient, triageInbox } from "@/lib/email-triage";
import { getTodayEvents } from "@/lib/calendar";
import { classifyEmail } from "@/lib/email-classifier";
import { getTasks } from "@/lib/data/tasks";
import { getComplianceItems } from "@/lib/data/compliance";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

// ---------------------------------------------------------------------------
// Pipeline stage definitions
// ---------------------------------------------------------------------------

export const ORDER_STAGES = ["Intake", "Design Check", "Ready to Laser", "In Production", "QC / Pack", "Shipped"];
export const ORDER_STAGE_MAP = {
  not_started:    { idx: 0, label: "Intake" },
  design_needed:  { idx: 1, label: "Design Check" },
  ready_to_laser: { idx: 2, label: "Ready to Laser" },
  in_production:  { idx: 3, label: "In Production" },
  ready_to_ship:  { idx: 4, label: "QC / Pack" },
  shipped:        { idx: 5, label: "Shipped" },
  delivered:      { idx: 5, label: "Delivered" },
  complete:       { idx: 5, label: "Complete" },
  completed:      { idx: 5, label: "Complete" },
};

export const DESIGN_STAGES = ["Brief Needed", "Brief Sent", "In Progress", "Proof Ready", "Approved"];
export const DESIGN_STAGE_MAP = {
  pending:        { idx: 0, label: "Brief Needed" },
  brief_created:  { idx: 1, label: "Brief Sent" },
  assigned:       { idx: 2, label: "In Progress" },
  in_progress:    { idx: 2, label: "In Progress" },
  proof_ready:    { idx: 3, label: "Proof Ready" },
  review:         { idx: 3, label: "Proof Ready" },
  approved:       { idx: 4, label: "Approved" },
  complete:       { idx: 4, label: "Complete" },
  laser_ready:    { idx: 4, label: "Laser Ready" },
};

export const ANNIVERSARY_STAGES = ["Not Started", "Prep", "Drafted", "Sent", "Complete"];
export const ANNIVERSARY_STAGE_MAP = {
  not_started:    { idx: 0, label: "Not Started" },
  prep:           { idx: 1, label: "Prep" },
  assigned:       { idx: 1, label: "Assigned" },
  email_drafted:  { idx: 2, label: "Drafted" },
  email_sent:     { idx: 3, label: "Sent" },
  sent:           { idx: 3, label: "Sent" },
  scheduled:      { idx: 3, label: "Scheduled" },
  social_posted:  { idx: 3, label: "Posted" },
  complete:       { idx: 4, label: "Complete" },
  skipped:        { idx: 4, label: "Skipped" },
};

// ---------------------------------------------------------------------------
// Mock email data — fallback when Gmail API unavailable
// ---------------------------------------------------------------------------

const MOCK_EMAILS = [
  {
    id: "mock-connor",
    type: "EMAIL",
    priority: 4,
    section: "TODAY",
    urgency: "OVERDUE",
    accentColor: "#c4a237",
    icon: "📧",
    title: "Connor McKinley — FIRE-ALTMAN bracelets",
    subtitle: "Design proof ready · 10 bracelets",
    badgeLabel: "SEND",
    badgeClass: "badge-today",
    brief: "Bracelet request from Connor McKinley. Following up on the FIRE-ALTMAN bracelet order — design proof ready for review.",
    context: {
      from: "Connor McKinley",
      fromEmail: "connor.mckinley@example.com",
      subject: "Re: FIRE-ALTMAN bracelet order",
      snippet: "Following up on the bracelet order — do you have a design proof ready to review?",
      draftText: "Hi Connor,\n\nThe design proof for the FIRE-ALTMAN bracelet is ready for your review. Please let me know if you'd like any changes before we go to production.\n\nOnce you give approval, standard lead time is 2–3 weeks for the 10-unit order.\n\nBest,\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
      suggestedPipelines: ["create_order"],
    },
  },
  {
    id: "mock-katie",
    type: "EMAIL",
    priority: 4,
    section: "TODAY",
    urgency: "OVERDUE",
    accentColor: "#c4a237",
    icon: "📧",
    title: "Katie Dobron — TMF Travis Manning order",
    subtitle: "100 bracelets · $1,800 · awaiting approval",
    badgeLabel: "SEND",
    badgeClass: "badge-today",
    brief: "Bracelet request from Katie Dobron (Travis Manning Foundation). 100-unit order at $1,800 total, pending her approval to go to production.",
    context: {
      from: "Katie Dobron",
      fromEmail: "katie.dobron@travismanion.org",
      subject: "Travis Manning Foundation bracelet order",
      snippet: "Just checking in on the order status for the TMF bracelets.",
      draftText: "Hi Katie,\n\nI wanted to circle back on the Travis Manning Foundation order. The design proof is ready — 100 bracelets at $1,800 total.\n\nCan you confirm approval so we can begin production? I'll get them moving as soon as you give the green light.\n\nThank you,\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
      suggestedPipelines: ["create_order"],
    },
  },
  {
    id: "mock-megan",
    type: "EMAIL",
    priority: 4,
    section: "TODAY",
    urgency: "OVERDUE",
    accentColor: "#c4a237",
    icon: "📧",
    title: "Megan Moore — ODU / LTC Shah bracelets",
    subtitle: "150 donated · need size breakdown",
    badgeLabel: "SEND",
    badgeClass: "badge-today",
    brief: "Bracelet request from Megan Moore (ODU). 150 donated units for LTC Shah program — need the 6\"/7\" size breakdown before production can start.",
    context: {
      from: "Megan Moore",
      fromEmail: "megan.moore@odu.edu",
      subject: "LTC Shah memorial bracelet program — ODU",
      snippet: "Thank you for the generous donation. We're excited to distribute these to our students.",
      draftText: "Hi Megan,\n\nThank you for partnering with us on the LTC Shah memorial bracelet program for ODU — 150 units donated.\n\nBefore we go to production, I need one thing: the size breakdown between 6\" and 7\" bracelets. Could you provide a rough split? (e.g., 75/75, or 100 of one size)\n\nOnce I have that, we'll get into production immediately.\n\nWith gratitude,\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
      suggestedPipelines: ["create_order"],
    },
  },
  {
    id: "mock-mclaughlin",
    type: "EMAIL",
    priority: 3,
    section: "TODAY",
    urgency: "TODAY",
    accentColor: "#c4a237",
    icon: "📧",
    title: "McLaughlin — Father Capodanno bracelet",
    subtitle: "Confirm bracelet exists",
    badgeLabel: "SEND",
    badgeClass: "badge-today",
    brief: "Inquiry from McLaughlin about Father Capodanno bracelet. Quick confirm-and-link reply — draft ready to send.",
    context: {
      from: "McLaughlin",
      fromEmail: "mclaughlin@example.com",
      subject: "Father Capodanno bracelet inquiry",
      snippet: "Do you have a bracelet for Father Vincent Capodanno?",
      draftText: "Yes — we do have a Father Capodanno memorial bracelet in our catalog. You can order directly at steelhearts.org.\n\nPlease don't hesitate to reach out with any questions about sizing or bulk orders.\n\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
      suggestedPipelines: [],
    },
  },
  {
    id: "mock-kim",
    type: "EMAIL",
    priority: 3,
    section: "TODAY",
    urgency: "TODAY",
    accentColor: "#c4a237",
    icon: "🏠",
    title: "Kim Haith — Schoolfield lease",
    subtitle: "Send signed lease",
    badgeLabel: "DO",
    badgeClass: "badge-today",
    brief: "Property matter from Kim Haith. Lease agreement for Schoolfield Drive is ready to attach and send. Action required today.",
    context: {
      from: "Kim Haith",
      fromEmail: "kim.haith@example.com",
      subject: "Schoolfield Drive lease",
      snippet: "Wanted to follow up on the lease for Schoolfield.",
      draftText: "Hi Kim,\n\nPlease find attached the lease agreement for Schoolfield Drive. Everything looks good on our end — please review, sign, and return a copy.\n\nFeel free to reach out with any questions.\n\nJoseph",
      threadId: null,
      messageId: null,
      category: "PROPERTY",
      suggestedPipelines: [],
    },
  },
  {
    id: "mock-terrie",
    type: "EMAIL",
    priority: 2,
    section: "WEEK",
    urgency: "WEEK",
    accentColor: "#c4a237",
    icon: "📧",
    title: "Terrie Lawrence — 10 bracelets",
    subtitle: "Wants to purchase · needs pricing",
    badgeLabel: "DRAFT",
    badgeClass: "badge-week",
    brief: "Bracelet request from Terrie Lawrence — mother of Lance Cpl Lawrence (USMC). Inquiring about purchasing 10 bracelets. Draft with pricing ready.",
    context: {
      from: "Terrie Lawrence",
      fromEmail: "terrie.lawrence@example.com",
      subject: "Bracelet purchase inquiry",
      snippet: "I'd like to order 10 bracelets. What's the pricing?",
      draftText: "Hi Terrie,\n\nThank you for your interest. Here's our current pricing:\n\n• 1–9 bracelets: $24.99 each\n• 10–24 bracelets: $21.99 each\n• 25+: Contact us for bulk pricing\n\nFor your order of 10, total would be $219.90 + shipping.\n\nYou can place your order at steelhearts.org, or I can set up a direct invoice. Let me know which you prefer!\n\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
      suggestedPipelines: ["create_order"],
    },
  },
  {
    id: "mock-seb",
    type: "EMAIL",
    priority: 2,
    section: "WEEK",
    urgency: "WEEK",
    accentColor: "#c4a237",
    icon: "📧",
    title: "Seb — Hooley bracelet bulk pricing",
    subtitle: "Bulk order inquiry",
    badgeLabel: "DRAFT",
    badgeClass: "badge-week",
    brief: "Bulk pricing inquiry from Seb for a unit-level Hooley bracelet order. Need quantity and timeline to quote. Draft ready.",
    context: {
      from: "Seb",
      fromEmail: "seb@example.com",
      subject: "Hooley bracelet — bulk pricing",
      snippet: "Looking for bulk pricing on a Hooley bracelet order for our unit.",
      draftText: "Hi Seb,\n\nThanks for reaching out about the Hooley bracelet.\n\nFor bulk orders (25+), we can discuss custom pricing based on quantity. Can you share the approximate quantity you're looking at and any timeline?\n\nI can put together a formal quote within 24 hours.\n\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
      suggestedPipelines: ["start_hero_intake", "create_order"],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEmailColor(category) {
  return "#c4a237"; // All emails are gold — type accent
}

function formatEmailTitle(from = "", subject = "") {
  const nameMatch = from.match(/^"?([^"<]*)"?\s*</);
  const name = nameMatch?.[1]?.trim() || from.split("@")[0];
  const cleanSubject = subject.replace(/^Re:\s*/i, "").slice(0, 40);
  return name ? `${name} — ${cleanSubject}` : cleanSubject;
}

function urgencyFromDate(dateStr) {
  if (!dateStr) return { priority: 1, section: "TRACKED", urgency: "SOMEDAY" };
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { priority: 4, section: "TODAY", urgency: "OVERDUE" };
  if (diffDays === 0) return { priority: 3, section: "TODAY", urgency: "TODAY" };
  if (diffDays <= 7) return { priority: 2, section: "WEEK", urgency: "WEEK" };
  if (diffDays <= 30) return { priority: 2, section: "WEEK", urgency: "WEEK" };
  return { priority: 1, section: "TRACKED", urgency: "SOMEDAY" };
}

function buildEmailBrief(t, category) {
  const catLabel = {
    "BRACELET-REQUEST": "Bracelet request",
    "FINANCIAL-CPA":    "CPA/financial matter",
    "FINANCIAL":        "Financial matter",
    "PROPERTY":         "Property matter",
    "PARTNER-ORG":      "Partner organization",
    "FAMILY":           "Family communication",
    "DONOR":            "Donor communication",
    "VA-VET":           "VA/Veteran inquiry",
  }[category] || "Email";
  const snippet = (t.lastMessageSnippet || "").slice(0, 110);
  const name = t.fromName || (t.fromEmail || "").split("@")[0];
  return `${catLabel} from ${name}. ${snippet}`;
}

function orderPipeline(productionStatus) {
  const stage = ORDER_STAGE_MAP[productionStatus] || { idx: 0, label: "Intake" };
  return {
    name: "Order Pipeline",
    stages: ORDER_STAGES,
    current: stage.idx,
    stageName: stage.label,
  };
}

function designPipeline(designStatus) {
  const stage = DESIGN_STAGE_MAP[designStatus] || { idx: 0, label: "Brief Needed" };
  return {
    name: "Design Pipeline",
    stages: DESIGN_STAGES,
    current: stage.idx,
    stageName: stage.label,
  };
}

function anniversaryPipeline(anniversaryStatus) {
  const stage = ANNIVERSARY_STAGE_MAP[anniversaryStatus] || { idx: 0, label: "Not Started" };
  return {
    name: "Anniversary Outreach",
    stages: ANNIVERSARY_STAGES,
    current: stage.idx,
    stageName: stage.label,
  };
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function getActionableEmails() {
  try {
    const gmail = await buildTriageGmailClient();
    const triaged = await triageInbox(gmail);

    return triaged.map((t) => {
      const category = classifyEmail(t.fromEmail, t.subject);
      const ageDays = t.lastMessageDate
        ? (Date.now() - new Date(t.lastMessageDate).getTime()) / 86400000
        : 0;
      const isOverdue = ageDays > 2;

      const isBraceletRequest = category === "BRACELET-REQUEST";
      const suggestedPipelines = isBraceletRequest
        ? ["start_hero_intake", "create_order"]
        : [];

      return {
        id: `email-${t.threadId}`,
        type: "EMAIL",
        priority: t.state === "draft_ready" || isOverdue ? 4 : 3,
        section: "TODAY",
        urgency: isOverdue ? "OVERDUE" : "TODAY",
        accentColor: "#c4a237",
        icon: "📧",
        title: formatEmailTitle(t.from, t.subject),
        subtitle: t.lastMessageSnippet?.slice(0, 70) || "(no preview)",
        badgeLabel: t.state === "draft_ready" ? "SEND DRAFT" : "REPLY",
        badgeClass: isOverdue ? "badge-overdue" : "badge-today",
        brief: buildEmailBrief(t, category),
        context: {
          from: t.from,
          fromName: t.fromName,
          fromEmail: t.fromEmail,
          subject: t.subject,
          snippet: t.lastMessageSnippet,
          threadId: t.threadId,
          messageId: null,
          draftId: t.draftId,
          draftText: "",
          category,
          state: t.state,
          suggestedPipelines,
        },
      };
    });
  } catch {
    return MOCK_EMAILS;
  }
}

async function getPendingOrders() {
  const sb = getServerClient();
  const SHIPPED_STATUSES = ["shipped", "complete", "completed", "delivered", "Shipped", "Complete", "Completed"];

  try {
    const { data, error } = await sb
      .from("order_items")
      .select("id, sku, quantity, production_status, order_id, created_at, hero_name, notes")
      .not("production_status", "in", `(${SHIPPED_STATUSES.map((s) => `"${s}"`).join(",")})`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return (data || []).map((row) => {
      const status = (row.production_status || "not_started");
      const statusLabel = status.replace(/_/g, " ");
      const pipeline = orderPipeline(status);

      const heroText = row.hero_name ? `for ${row.hero_name}` : "";
      const qtyText = row.quantity ? `${row.quantity} unit${row.quantity !== 1 ? "s" : ""}` : "";
      const brief = [qtyText, heroText].filter(Boolean).join(" ")
        + ` — ${pipeline.name}: Stage ${pipeline.current + 1} of ${pipeline.stages.length}, ${pipeline.stageName}.`
        + (row.notes ? ` ${row.notes}` : "");

      return {
        id: `order-${row.id}`,
        type: "ORDER",
        priority: 3,
        section: "TODAY",
        urgency: "TODAY",
        accentColor: "#22c55e",
        icon: "📦",
        title: row.hero_name ? `Order — ${row.hero_name}` : `Order #${row.order_id || row.id}`,
        subtitle: `${row.quantity || "?"} units · ${statusLabel} · ${row.sku || ""}`,
        badgeLabel: statusLabel.toUpperCase() || "PENDING",
        badgeClass: "badge-today",
        brief,
        pipeline,
        context: {
          heroName: row.hero_name,
          sku: row.sku,
          quantity: row.quantity,
          productionStatus: row.production_status,
          orderId: row.order_id,
          createdAt: row.created_at,
          notes: row.notes,
        },
      };
    });
  } catch {
    return [];
  }
}

async function getOpenTasks() {
  try {
    const tasks = await getTasks({ includeCompleted: false });

    return tasks.slice(0, 10).map((t) => {
      const { priority, section, urgency } = urgencyFromDate(t.due_date);
      const finalPriority = t.priority === "critical" ? 4 : t.priority === "high" ? 3 : priority;
      const finalSection = t.priority === "critical" || t.priority === "high" ? "TODAY" : section;

      const brief = t.description || t.notes
        || `${t.title} — ${(t.priority || "medium")} priority${t.due_date ? `, due ${new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.`;

      return {
        id: `task-${t.id}`,
        type: "TASK",
        priority: finalPriority,
        section: finalSection,
        urgency: finalSection === "TODAY" ? (finalPriority >= 4 ? "OVERDUE" : "TODAY") : urgency,
        accentColor: "#6b7280",
        icon: "✅",
        title: t.title || t.name || "(untitled task)",
        subtitle: [t.role, t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : null].filter(Boolean).join(" · "),
        badgeLabel: (t.priority || "").toUpperCase() || "TASK",
        badgeClass: t.priority === "critical" ? "badge-overdue" : t.priority === "high" ? "badge-today" : "badge-week",
        brief,
        context: {
          taskId: t.id,
          role: t.role,
          dueDate: t.due_date,
          status: t.status,
          notes: t.notes || t.description,
        },
      };
    });
  } catch {
    return [];
  }
}

async function getUpcomingCompliance() {
  try {
    const items = await getComplianceItems();
    const relevant = items.filter(
      (i) => !["filed", "confirmed", "waived"].includes(i.status) && (i.daysUntilDue === null || i.daysUntilDue <= 60)
    );

    return relevant.slice(0, 8).map((i) => {
      const { priority, section, urgency } = urgencyFromDate(i.due_date);
      const finalPriority = i.isOverdue ? 4 : priority;
      const finalSection = i.isOverdue || (i.daysUntilDue !== null && i.daysUntilDue <= 7) ? "TODAY" : section;

      const dueDateStr = i.due_date
        ? new Date(i.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "no date set";
      const brief = i.notes?.slice(0, 150)
        || `${i.name || "Compliance item"} due ${dueDateStr}.${i.authority ? ` Filed with ${i.authority}.` : ""}`;

      return {
        id: `compliance-${i.id}`,
        type: "COMPLIANCE",
        priority: finalPriority,
        section: finalSection,
        urgency: i.isOverdue ? "OVERDUE" : urgency,
        accentColor: "#f59e0b",
        icon: "⚖️",
        title: i.name || i.title || "Compliance item",
        subtitle: i.due_date
          ? `Due ${new Date(i.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          : "No due date",
        badgeLabel: i.isOverdue ? "OVERDUE" : i.daysUntilDue <= 7 ? "DUE SOON" : "UPCOMING",
        badgeClass: i.isOverdue ? "badge-overdue" : i.daysUntilDue <= 7 ? "badge-today" : "badge-week",
        brief,
        context: {
          itemId: i.id,
          dueDate: i.due_date,
          status: i.status,
          notes: i.notes,
          authority: i.authority || i.filing_authority,
          daysUntilDue: i.daysUntilDue,
        },
      };
    });
  } catch {
    return [];
  }
}

async function getGystItems() {
  const sb = getServerClient();
  const items = [];

  // Action items
  try {
    const { data } = await sb
      .from("gyst_action_items")
      .select("*")
      .eq("status", "active")
      .order("priority", { ascending: true })
      .limit(10);

    for (const row of data || []) {
      const { priority, section, urgency } = urgencyFromDate(row.due_date);
      items.push({
        id: `gyst-action-${row.id}`,
        type: "GYST",
        priority,
        section,
        urgency,
        accentColor: "#a855f7",
        icon: "🎯",
        title: row.title || row.name || "Action item",
        subtitle: row.category || "Personal",
        badgeLabel: row.priority ? row.priority.toUpperCase() : "ACTIVE",
        badgeClass: "badge-purple",
        brief: row.description || row.notes || `${row.title || "Personal action item"}. Category: ${row.category || "general"}.`,
        context: {
          actionText: row.description || row.notes,
          dueDate: row.due_date,
          category: row.category,
        },
      });
    }
  } catch {}

  // Debt snapshot
  try {
    const { data } = await sb.from("gyst_debts").select("*").order("balance", { ascending: false });
    const totalDebt = (data || []).reduce((sum, d) => sum + (d.balance || 0), 0);
    if (totalDebt > 0) {
      const totalFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalDebt);
      items.push({
        id: "gyst-debts",
        type: "FINANCIAL",
        priority: 1,
        section: "TRACKED",
        urgency: "SOMEDAY",
        accentColor: "#ef4444",
        icon: "💳",
        title: `Debt snapshot — ${totalFmt}`,
        subtitle: `${(data || []).length} accounts`,
        badgeLabel: "TRACKED",
        badgeClass: "badge-tracked",
        brief: `Total debt across ${(data || []).length} accounts is ${totalFmt}. Review balances and minimum payments to build paydown plan.`,
        context: {
          debts: (data || []).map((d) => ({
            name: d.name || d.creditor,
            balance: d.balance,
            rate: d.interest_rate,
            minPayment: d.minimum_payment,
          })),
        },
      });
    }
  } catch {}

  // Properties
  try {
    const { data } = await sb.from("gyst_properties").select("*");
    for (const prop of data || []) {
      const propBrief = prop.notes
        || `${prop.address || prop.name}. ${prop.tenant_name ? `Tenant: ${prop.tenant_name}.` : "Vacant."} ${prop.status || ""}`.trim();

      items.push({
        id: `gyst-prop-${prop.id}`,
        type: "PROPERTY",
        priority: 1,
        section: "TRACKED",
        urgency: "SOMEDAY",
        accentColor: "#3b82f6",
        icon: "🏠",
        title: prop.address || prop.name || "Property",
        subtitle: prop.tenant_name ? `Tenant: ${prop.tenant_name}` : prop.status || "Vacant",
        badgeLabel: prop.status ? prop.status.toUpperCase() : "TRACKED",
        badgeClass: "badge-tracked",
        brief: propBrief,
        context: {
          address: prop.address,
          tenant: prop.tenant_name,
          rentAmount: prop.rent_amount || prop.monthly_rent,
          leaseEnd: prop.lease_end_date,
          status: prop.status,
          notes: prop.notes,
          monthlyCashFlow: prop.monthly_cash_flow,
        },
      });
    }
  } catch {}

  return items;
}

async function getTodayCalendarItems() {
  try {
    const events = await getTodayEvents();
    return events.map((e) => ({
      id: `cal-${e.id}`,
      type: "CALENDAR",
      priority: 3,
      section: "TODAY",
      urgency: "TODAY",
      accentColor: "#6b7280",
      icon: "📅",
      title: e.summary,
      subtitle: e.allDay
        ? "All day"
        : new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }),
      badgeLabel: e.allDay ? "ALL DAY" : new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }),
      badgeClass: "badge-today",
      brief: e.description?.slice(0, 150) || `${e.summary} — on your calendar today.`,
      context: {
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        description: e.description,
        htmlLink: e.htmlLink,
      },
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// New fetcher: upcoming anniversary outreach (next 14 days, not done)
// ---------------------------------------------------------------------------

async function getUpcomingAnniversaries() {
  const sb = getServerClient();
  const ANNIVERSARY_DONE = new Set(["email_sent", "sent", "scheduled", "social_posted", "complete", "skipped"]);

  try {
    const { data, error } = await sb
      .from("heroes")
      .select(`
        id, name, first_name, last_name, rank,
        memorial_month, memorial_day, memorial_date,
        anniversary_status, lineitem_sku,
        family_contact:contacts!family_contact_id(first_name, last_name, email)
      `)
      .eq("active_listing", true)
      .not("memorial_month", "is", null)
      .eq("memorial_type", "individual");

    if (error) throw error;

    const now = new Date();
    const items = [];

    for (const hero of data || []) {
      if (ANNIVERSARY_DONE.has(hero.anniversary_status)) continue;

      let memDate = new Date(now.getFullYear(), hero.memorial_month - 1, hero.memorial_day);
      if (memDate < now) memDate.setFullYear(now.getFullYear() + 1);
      const daysUntil = Math.ceil((memDate - now) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0 || daysUntil > 14) continue;

      const fullName = [hero.rank, hero.first_name, hero.last_name].filter(Boolean).join(" ") || hero.name;
      const dateStr = new Date(now.getFullYear(), hero.memorial_month - 1, hero.memorial_day)
        .toLocaleDateString("en-US", { month: "long", day: "numeric" });

      const fc = hero.family_contact;
      const familyName = fc ? `${fc.first_name || ""} ${fc.last_name || ""}`.trim() : null;
      const familyEmail = fc?.email || null;

      const dayStr = daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`;
      const pipeline = anniversaryPipeline(hero.anniversary_status);

      let brief = `${fullName}'s anniversary is ${dateStr} (${dayStr}).`;
      brief += familyName
        ? ` Family contact: ${familyName}${familyEmail ? ` — ${familyEmail}` : ""}.`
        : " No family contact on file.";
      brief += ` Outreach status: ${(hero.anniversary_status || "not_started").replace(/_/g, " ")}.`;

      const priority = daysUntil <= 3 ? 4 : 3;
      const section = daysUntil <= 3 ? "TODAY" : "WEEK";
      const urgency = daysUntil === 0 ? "OVERDUE" : daysUntil <= 3 ? "TODAY" : "WEEK";

      items.push({
        id: `anniversary-${hero.id}`,
        type: "ANNIVERSARY",
        priority,
        section,
        urgency,
        accentColor: "#3b82f6",
        icon: "🎖️",
        title: `${fullName} — Anniversary`,
        subtitle: `${dateStr} · ${familyName || "No family contact"}`,
        badgeLabel: daysUntil === 0 ? "TODAY" : `IN ${daysUntil}D`,
        badgeClass: daysUntil <= 3 ? "badge-overdue" : "badge-week",
        brief,
        pipeline,
        context: {
          heroId: hero.id,
          heroName: fullName,
          memorialDate: hero.memorial_date,
          anniversaryMonth: hero.memorial_month,
          anniversaryDay: hero.memorial_day,
          dateStr,
          daysUntil,
          familyContact: familyName,
          familyEmail,
          status: hero.anniversary_status,
        },
      });
    }

    return items;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// New fetcher: heroes needing design work
// ---------------------------------------------------------------------------

async function getDesignRequests() {
  const sb = getServerClient();
  const DESIGN_DONE = ["complete", "approved", "laser_ready", "delivered"];

  try {
    const { data, error } = await sb
      .from("heroes")
      .select("id, name, first_name, last_name, rank, lineitem_sku, design_status, design_priority, design_brief, has_graphic_design")
      .eq("active_listing", true)
      .eq("has_graphic_design", false)
      .order("design_priority", { ascending: true, nullsFirst: false })
      .limit(5);

    if (error) throw error;

    return (data || [])
      .filter((h) => !DESIGN_DONE.includes(h.design_status))
      .map((hero) => {
        const fullName = [hero.rank, hero.first_name, hero.last_name].filter(Boolean).join(" ") || hero.name;
        const sku = hero.lineitem_sku || hero.name;
        const pipeline = designPipeline(hero.design_status);

        let brief = `${sku} design is ${(hero.design_status || "pending").replace(/_/g, " ")}.`;
        if (hero.design_brief) brief += ` Brief: ${hero.design_brief.slice(0, 100)}.`;
        brief += " Assign to Ryan or follow up on Slack.";

        return {
          id: `design-${hero.id}`,
          type: "DESIGN",
          priority: hero.design_priority === 1 ? 4 : 2,
          section: "WEEK",
          urgency: "WEEK",
          accentColor: "#a855f7",
          icon: "🎨",
          title: `${fullName} — Design Needed`,
          subtitle: `${sku} · ${(hero.design_status || "pending").replace(/_/g, " ")}`,
          badgeLabel: "WAITING",
          badgeClass: "badge-waiting",
          brief,
          pipeline,
          context: {
            heroId: hero.id,
            heroName: fullName,
            sku,
            designStatus: hero.design_status,
            designBrief: hero.design_brief,
            designPriority: hero.design_priority,
          },
        };
      });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Hardcoded tracked items
// ---------------------------------------------------------------------------

function getHardcodedTracked() {
  return [
    {
      id: "tracked-tracy",
      type: "FINANCIAL",
      priority: 2,
      section: "WEEK",
      urgency: "WEEK",
      accentColor: "#ef4444",
      icon: "💰",
      title: "Tracy Hutter — IRS penalty",
      subtitle: "Deadline Apr 30 · needs review",
      badgeLabel: "APR 30",
      badgeClass: "badge-today",
      brief: "IRS penalty assessment with Tracy Hutter CPA. Review and respond before April 30 deadline. Abatement letters mailed — waiting for IRS response.",
      context: {
        vendor: "Tracy Hutter CPA",
        deadline: "2026-04-30",
        notes: "IRS penalty assessment. Review with Tracy before April 30 deadline.",
        amount: null,
      },
    },
    {
      id: "tracked-spencer-ar",
      type: "FINANCIAL",
      priority: 2,
      section: "WEEK",
      urgency: "WEEK",
      accentColor: "#ef4444",
      icon: "💰",
      title: "Spencer — AR $2,340",
      subtitle: "Outstanding receivable · follow up",
      badgeLabel: "OUTSTANDING",
      badgeClass: "badge-week",
      brief: "Spencer accounts receivable balance of $2,340 outstanding. Send a friendly reminder and confirm the path to collect.",
      context: {
        vendor: "Spencer",
        amount: 2340,
        notes: "Outstanding accounts receivable balance of $2,340. Follow up to collect.",
      },
    },
    {
      id: "tracked-stripe",
      type: "FINANCIAL",
      priority: 1,
      section: "WEEK",
      urgency: "WEEK",
      accentColor: "#ef4444",
      icon: "💳",
      title: "Stripe — nonprofit rates",
      subtitle: "Application pending · follow up",
      badgeLabel: "FOLLOW UP",
      badgeClass: "badge-week",
      brief: "Nonprofit rate application pending with Stripe. Follow up if no response within 5 business days.",
      context: {
        vendor: "Stripe",
        notes: "Nonprofit rate application pending with Stripe. Follow up if no response within 5 business days.",
      },
    },
    {
      id: "tracked-tmf-order",
      type: "ORDER",
      priority: 1,
      section: "TRACKED",
      urgency: "SOMEDAY",
      accentColor: "#22c55e",
      icon: "📦",
      title: "TMF — 100 bracelets",
      subtitle: "Awaiting Katie Dobron approval · $1,800",
      badgeLabel: "PENDING APPROVAL",
      badgeClass: "badge-waiting",
      brief: "100-bracelet order for Travis Manning Foundation, $1,800. Awaiting Katie Dobron sign-off before production can start.",
      pipeline: { name: "Order Pipeline", stages: ORDER_STAGES, current: 0, stageName: "Intake" },
      context: {
        heroName: "Travis Manning",
        quantity: 100,
        orderValue: 1800,
        productionStatus: "pending_approval",
        notes: "Awaiting Katie Dobron (TMF) sign-off before production.",
      },
    },
    {
      id: "tracked-odu-order",
      type: "ORDER",
      priority: 1,
      section: "TRACKED",
      urgency: "SOMEDAY",
      accentColor: "#22c55e",
      icon: "📦",
      title: "ODU — 150 bracelets (donated)",
      subtitle: "Awaiting size breakdown from Megan",
      badgeLabel: "WAITING INFO",
      badgeClass: "badge-waiting",
      brief: "150 donated bracelets for ODU's LTC Shah program. Waiting on Megan Moore for the 6\"/7\" size split before production can begin.",
      pipeline: { name: "Order Pipeline", stages: ORDER_STAGES, current: 0, stageName: "Intake" },
      context: {
        heroName: "LTC Shah",
        quantity: 150,
        orderValue: 0,
        productionStatus: "needs_info",
        notes: "Donated order for ODU. Need 6\" vs 7\" size split from Megan Moore before production.",
      },
    },
    {
      id: "tracked-altman-order",
      type: "ORDER",
      priority: 1,
      section: "TRACKED",
      urgency: "SOMEDAY",
      accentColor: "#22c55e",
      icon: "📦",
      title: "Altman — 10 bracelets",
      subtitle: "Awaiting design proof approval",
      badgeLabel: "WAITING PROOF",
      badgeClass: "badge-waiting",
      brief: "10-bracelet order for FIRE-ALTMAN. Design proof sent to Connor McKinley — waiting on approval before production starts.",
      pipeline: { name: "Order Pipeline", stages: ORDER_STAGES, current: 1, stageName: "Design Check" },
      context: {
        heroName: "Altman",
        quantity: 10,
        productionStatus: "awaiting_proof_approval",
        notes: "Design proof sent to Connor McKinley. Awaiting approval before production.",
      },
    },
    {
      id: "tracked-carlisle",
      type: "PROPERTY",
      priority: 1,
      section: "TRACKED",
      urgency: "SOMEDAY",
      accentColor: "#3b82f6",
      icon: "🏠",
      title: "Carlisle — Brazilian Army lease",
      subtitle: "Signed · starts Jul 2026 · $5,000/mo",
      badgeLabel: "UPCOMING",
      badgeClass: "badge-tracked",
      brief: "Carlisle lease signed with Brazilian Army. Starts July 2026 at $5,000/mo. No action needed until move-in.",
      context: {
        address: "Carlisle",
        tenant: "Brazilian Army",
        rentAmount: 5000,
        leaseEnd: null,
        status: "signed",
        notes: "Lease signed, starts July 2026.",
      },
    },
    {
      id: "tracked-fortmill",
      type: "PROPERTY",
      priority: 1,
      section: "TRACKED",
      urgency: "SOMEDAY",
      accentColor: "#3b82f6",
      icon: "🏠",
      title: "Fort Mill — rental",
      subtitle: "Cash drain -$1,363/mo · watch",
      badgeLabel: "CASH DRAIN",
      badgeClass: "badge-overdue",
      brief: "Fort Mill property is a -$1,363/mo cash drain with no tenant. Monitor and prioritize tenant placement to stop the bleed.",
      context: {
        address: "Fort Mill",
        tenant: null,
        rentAmount: null,
        status: "vacant",
        monthlyCashFlow: -1363,
        notes: "Monthly cash drain of -$1,363. Monitor for tenant placement.",
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Donor stewardship
// ---------------------------------------------------------------------------

async function getDonorStewardship() {
  const sb = getServerClient();

  const { data, error } = await sb
    .from("donations")
    .select("id, donor_first_name, donor_last_name, donor_email, billing_name, amount, donation_amount, donation_date, campaign, donor_segment, notes")
    .or("thank_you_sent.is.null,thank_you_sent.eq.false")
    .order("donation_date", { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data || []).map((row) => {
    const donorName =
      row.billing_name ||
      [row.donor_first_name, row.donor_last_name].filter(Boolean).join(" ") ||
      row.donor_email ||
      "Unknown Donor";
    const donationAmount = row.amount || row.donation_amount || 0;
    const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(donationAmount);

    const ageDays = row.donation_date
      ? (Date.now() - new Date(row.donation_date).getTime()) / 86400000
      : 0;
    const formattedDate = row.donation_date
      ? new Date(row.donation_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null;

    const brief = `${donorName} donated ${formattedAmount}${row.campaign ? ` to ${row.campaign}` : ""}${formattedDate ? ` on ${formattedDate}` : ""}. No thank-you sent yet.`;

    return {
      id: `donor-${row.id}`,
      type: "DONOR",
      priority: ageDays > 7 ? 4 : 3,
      section: "TODAY",
      urgency: ageDays > 7 ? "OVERDUE" : "TODAY",
      accentColor: "#ec4899",
      icon: "❤️",
      title: `${donorName} — ${formattedAmount}`,
      subtitle: [row.campaign, formattedDate].filter(Boolean).join(" · "),
      badgeLabel: ageDays > 7 ? "OVERDUE" : "THANK YOU",
      badgeClass: ageDays > 7 ? "badge-overdue" : "badge-today",
      brief,
      context: {
        donationId: row.id,
        donorName,
        donorEmail: row.donor_email,
        amount: donationAmount,
        donationDate: row.donation_date,
        campaign: row.campaign,
        donorSegment: row.donor_segment,
        notes: row.notes,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

async function getKPIs() {
  const sb = getServerClient();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const ANNIVERSARY_DONE = new Set(["email_sent", "sent", "scheduled", "social_posted", "complete", "skipped"]);

  const [heroesRes, braceletsRes, pipelineRes, revenueRes, donationsMonthRes, pendingThanksRes, familyMsgRes, anniversaryRes] =
    await Promise.allSettled([
      sb.from("heroes").select("*", { count: "exact", head: true }).eq("active_listing", true),
      sb.from("order_items").select("quantity").eq("production_status", "shipped").gte("created_at", firstOfMonth),
      sb.from("order_items").select("production_status, quantity").not("production_status", "in", '("shipped","delivered","cancelled")'),
      sb.from("order_items").select("unit_price, quantity").gte("created_at", firstOfMonth).neq("production_status", "cancelled"),
      sb.from("donations").select("amount, donation_amount").gte("created_at", firstOfMonth),
      sb.from("donations").select("*", { count: "exact", head: true }).or("thank_you_sent.is.null,thank_you_sent.eq.false"),
      sb.from("family_messages").select("*", { count: "exact", head: true }).eq("status", "new"),
      sb.from("heroes").select("memorial_month, memorial_day, anniversary_status").eq("active_listing", true).not("memorial_month", "is", null),
    ]);

  const heroesHonored = heroesRes.value?.count ?? null;
  const braceletsShipped = (braceletsRes.value?.data || []).reduce((s, r) => s + (r.quantity || 0), 0);

  const pipelineRows = pipelineRes.value?.data || [];
  const pipeline = {};
  for (const r of pipelineRows) {
    const key = r.production_status || "unknown";
    pipeline[key] = (pipeline[key] || 0) + 1;
  }
  const pipelineTotal = pipelineRows.length;

  const revenueRows = revenueRes.value?.data || [];
  const revenueThisMonth = revenueRows.reduce((s, r) => s + (r.unit_price || 0) * (r.quantity || 1), 0);

  const donationRows = donationsMonthRes.value?.data || [];
  const donationsThisMonth = donationRows.reduce((s, r) => s + (r.amount || r.donation_amount || 0), 0);

  const pendingThanks = pendingThanksRes.value?.count ?? null;
  const familyMessagesPending = familyMsgRes.value?.count ?? null;

  let anniversaryEmailsDue = 0;
  for (const hero of anniversaryRes.value?.data || []) {
    if (ANNIVERSARY_DONE.has(hero.anniversary_status)) continue;
    let memDate = new Date(now.getFullYear(), hero.memorial_month - 1, hero.memorial_day);
    if (memDate < now) memDate.setFullYear(now.getFullYear() + 1);
    const daysUntil = (memDate - now) / 86400000;
    if (daysUntil >= 0 && daysUntil <= 14) anniversaryEmailsDue++;
  }

  return { heroesHonored, braceletsShipped, pipelineTotal, pipeline, revenueThisMonth, donationsThisMonth, pendingThanks, familyMessagesPending, anniversaryEmailsDue };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  const [emails, orders, tasks, compliance, gyst, calendar, donors, anniversaries, designs, kpiResult] =
    await Promise.allSettled([
      getActionableEmails(),
      getPendingOrders(),
      getOpenTasks(),
      getUpcomingCompliance(),
      getGystItems(),
      getTodayCalendarItems(),
      getDonorStewardship(),
      getUpcomingAnniversaries(),
      getDesignRequests(),
      getKPIs(),
    ]);

  const getValue = (result, fallback = []) =>
    result.status === "fulfilled" ? result.value : fallback;

  const emailCount = getValue(emails, []).length;

  const allItems = [
    ...getValue(donors),
    ...getValue(orders),
    ...getValue(tasks),
    ...getValue(compliance),
    ...getValue(gyst),
    ...getValue(calendar),
    ...getValue(anniversaries),
    ...getValue(designs),
    ...getHardcodedTracked(),
  ];

  const seen = new Set();
  const items = allItems.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const sectionOrder = { TODAY: 0, WEEK: 1, TRACKED: 2 };
  items.sort((a, b) => {
    const secDiff = (sectionOrder[a.section] ?? 2) - (sectionOrder[b.section] ?? 2);
    if (secDiff !== 0) return secDiff;
    return b.priority - a.priority;
  });

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });

  return Response.json({
    items,
    emailCount,
    kpis: kpiResult.status === "fulfilled" ? kpiResult.value : {},
    dateLabel,
    generatedAt: now.toISOString(),
    counts: {
      today: items.filter((i) => i.section === "TODAY").length,
      week: items.filter((i) => i.section === "WEEK").length,
      tracked: items.filter((i) => i.section === "TRACKED").length,
    },
  });
}
