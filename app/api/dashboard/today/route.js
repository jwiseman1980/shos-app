import { getServerClient } from "@/lib/supabase";
import { buildTriageGmailClient, triageInbox } from "@/lib/email-triage";
import { getTodayEvents } from "@/lib/calendar";
import { classifyEmail } from "@/lib/email-classifier";
import { getTasks } from "@/lib/data/tasks";
import { getComplianceItems } from "@/lib/data/compliance";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

// ---------------------------------------------------------------------------
// Mock email data — current triage as of 2026-04-17.
// Used as fallback when Gmail API is unavailable.
// ---------------------------------------------------------------------------

const MOCK_EMAILS = [
  {
    id: "mock-connor",
    type: "EMAIL",
    priority: 4,
    section: "TODAY",
    urgency: "OVERDUE",
    accentColor: "#14b8a6",
    icon: "📧",
    title: "Connor McKinley — FIRE-ALTMAN bracelets",
    subtitle: "Design proof ready · 10 bracelets",
    badgeLabel: "SEND",
    badgeClass: "badge-today",
    context: {
      from: "Connor McKinley",
      fromEmail: "connor.mckinley@example.com",
      subject: "Re: FIRE-ALTMAN bracelet order",
      snippet: "Following up on the bracelet order — do you have a design proof ready to review?",
      draftText: "Hi Connor,\n\nThe design proof for the FIRE-ALTMAN bracelet is ready for your review. Please let me know if you'd like any changes before we go to production.\n\nOnce you give approval, standard lead time is 2–3 weeks for the 10-unit order.\n\nBest,\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
    },
  },
  {
    id: "mock-katie",
    type: "EMAIL",
    priority: 4,
    section: "TODAY",
    urgency: "OVERDUE",
    accentColor: "#14b8a6",
    icon: "📧",
    title: "Katie Dobron — TMF Travis Manning order",
    subtitle: "100 bracelets · $1,800 · awaiting approval",
    badgeLabel: "SEND",
    badgeClass: "badge-today",
    context: {
      from: "Katie Dobron",
      fromEmail: "katie.dobron@travismanion.org",
      subject: "Travis Manning Foundation bracelet order",
      snippet: "Just checking in on the order status for the TMF bracelets.",
      draftText: "Hi Katie,\n\nI wanted to circle back on the Travis Manning Foundation order. The design proof is ready — 100 bracelets at $1,800 total.\n\nCan you confirm approval so we can begin production? I'll get them moving as soon as you give the green light.\n\nThank you,\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
    },
  },
  {
    id: "mock-megan",
    type: "EMAIL",
    priority: 4,
    section: "TODAY",
    urgency: "OVERDUE",
    accentColor: "#14b8a6",
    icon: "📧",
    title: "Megan Moore — ODU / LTC Shah bracelets",
    subtitle: "150 donated · need size breakdown",
    badgeLabel: "SEND",
    badgeClass: "badge-today",
    context: {
      from: "Megan Moore",
      fromEmail: "megan.moore@odu.edu",
      subject: "LTC Shah memorial bracelet program — ODU",
      snippet: "Thank you for the generous donation. We're excited to distribute these to our students.",
      draftText: "Hi Megan,\n\nThank you for partnering with us on the LTC Shah memorial bracelet program for ODU — 150 units donated.\n\nBefore we go to production, I need one thing: the size breakdown between 6\" and 7\" bracelets. Could you provide a rough split? (e.g., 75/75, or 100 of one size)\n\nOnce I have that, we'll get into production immediately.\n\nWith gratitude,\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
    },
  },
  {
    id: "mock-mclaughlin",
    type: "EMAIL",
    priority: 3,
    section: "TODAY",
    urgency: "TODAY",
    accentColor: "#14b8a6",
    icon: "📧",
    title: "McLaughlin — Father Capodanno bracelet",
    subtitle: "Confirm bracelet exists",
    badgeLabel: "SEND",
    badgeClass: "badge-today",
    context: {
      from: "McLaughlin",
      fromEmail: "mclaughlin@example.com",
      subject: "Father Capodanno bracelet inquiry",
      snippet: "Do you have a bracelet for Father Vincent Capodanno?",
      draftText: "Yes — we do have a Father Capodanno memorial bracelet in our catalog. You can order directly at steelhearts.org.\n\nPlease don't hesitate to reach out with any questions about sizing or bulk orders.\n\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
    },
  },
  {
    id: "mock-kim",
    type: "EMAIL",
    priority: 3,
    section: "TODAY",
    urgency: "TODAY",
    accentColor: "#3b82f6",
    icon: "🏠",
    title: "Kim Haith — Schoolfield lease",
    subtitle: "Send signed lease",
    badgeLabel: "DO",
    badgeClass: "badge-today",
    context: {
      from: "Kim Haith",
      fromEmail: "kim.haith@example.com",
      subject: "Schoolfield Drive lease",
      snippet: "Wanted to follow up on the lease for Schoolfield.",
      draftText: "Hi Kim,\n\nPlease find attached the lease agreement for Schoolfield Drive. Everything looks good on our end — please review, sign, and return a copy.\n\nFeel free to reach out with any questions.\n\nJoseph",
      threadId: null,
      messageId: null,
      category: "PROPERTY",
    },
  },
  {
    id: "mock-terrie",
    type: "EMAIL",
    priority: 2,
    section: "WEEK",
    urgency: "WEEK",
    accentColor: "#14b8a6",
    icon: "📧",
    title: "Terrie Lawrence — 10 bracelets",
    subtitle: "Wants to purchase · needs pricing",
    badgeLabel: "DRAFT",
    badgeClass: "badge-week",
    context: {
      from: "Terrie Lawrence",
      fromEmail: "terrie.lawrence@example.com",
      subject: "Bracelet purchase inquiry",
      snippet: "I'd like to order 10 bracelets. What's the pricing?",
      draftText: "Hi Terrie,\n\nThank you for your interest. Here's our current pricing:\n\n• 1–9 bracelets: $24.99 each\n• 10–24 bracelets: $21.99 each\n• 25+: Contact us for bulk pricing\n\nFor your order of 10, total would be $219.90 + shipping.\n\nYou can place your order at steelhearts.org, or I can set up a direct invoice. Let me know which you prefer!\n\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
    },
  },
  {
    id: "mock-seb",
    type: "EMAIL",
    priority: 2,
    section: "WEEK",
    urgency: "WEEK",
    accentColor: "#14b8a6",
    icon: "📧",
    title: "Seb — Hooley bracelet bulk pricing",
    subtitle: "Bulk order inquiry",
    badgeLabel: "DRAFT",
    badgeClass: "badge-week",
    context: {
      from: "Seb",
      fromEmail: "seb@example.com",
      subject: "Hooley bracelet — bulk pricing",
      snippet: "Looking for bulk pricing on a Hooley bracelet order for our unit.",
      draftText: "Hi Seb,\n\nThanks for reaching out about the Hooley bracelet.\n\nFor bulk orders (25+), we can discuss custom pricing based on quantity. Can you share the approximate quantity you're looking at and any timeline?\n\nI can put together a formal quote within 24 hours.\n\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
    },
  },
  {
    id: "mock-kole",
    type: "EMAIL",
    priority: 2,
    section: "WEEK",
    urgency: "WEEK",
    accentColor: "#14b8a6",
    icon: "📧",
    title: "Kole Rhodes — ZEUS95 follow-up",
    subtitle: "No reply since Apr 9",
    badgeLabel: "FOLLOW UP",
    badgeClass: "badge-week",
    context: {
      from: "Kole Rhodes",
      fromEmail: "kole.rhodes@example.com",
      subject: "ZEUS95 bracelet order",
      snippet: "Last contact: Apr 9. No response to design proof.",
      draftText: "Hi Kole,\n\nFollowing up on the ZEUS95 bracelet design proof I sent on April 9. Wanted to make sure it didn't get lost in the shuffle.\n\nLet me know if you have any questions or need revisions — happy to adjust before we go to production.\n\nJoseph\nSteel Hearts Foundation",
      threadId: null,
      messageId: null,
      category: "BRACELET-REQUEST",
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEmailColor(category) {
  const map = {
    "BRACELET-REQUEST": "#14b8a6",
    "FINANCIAL-CPA": "#f59e0b",
    "FINANCIAL": "#f59e0b",
    "PROPERTY": "#3b82f6",
    "PARTNER-ORG": "#a855f7",
    "FAMILY": "#ec4899",
    "DONOR": "#3b82f6",
    "VA-VET": "#14b8a6",
  };
  return map[category] || "#6b7280";
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

      return {
        id: `email-${t.threadId}`,
        type: "EMAIL",
        priority: t.state === "draft_ready" || isOverdue ? 4 : 3,
        section: "TODAY",
        urgency: isOverdue ? "OVERDUE" : "TODAY",
        accentColor: getEmailColor(category),
        icon: "📧",
        title: formatEmailTitle(t.from, t.subject),
        subtitle: t.lastMessageSnippet?.slice(0, 70) || "(no preview)",
        badgeLabel: t.state === "draft_ready" ? "SEND DRAFT" : "REPLY",
        badgeClass: isOverdue ? "badge-overdue" : "badge-today",
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
      .select("id, sku, quantity, production_status, order_id, created_at, hero_name")
      .not("production_status", "in", `(${SHIPPED_STATUSES.map((s) => `"${s}"`).join(",")})`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: `order-${row.id}`,
      type: "ORDER",
      priority: 3,
      section: "TODAY",
      urgency: "TODAY",
      accentColor: "#14b8a6",
      icon: "📦",
      title: row.hero_name ? `Order — ${row.hero_name}` : `Order #${row.order_id || row.id}`,
      subtitle: `${row.quantity || "?"} units · ${row.production_status || "pending"} · ${row.sku || ""}`,
      badgeLabel: (row.production_status || "").toUpperCase() || "PENDING",
      badgeClass: "badge-today",
      context: {
        heroName: row.hero_name,
        sku: row.sku,
        quantity: row.quantity,
        productionStatus: row.production_status,
        orderId: row.order_id,
        createdAt: row.created_at,
      },
    }));
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

      return {
        id: `task-${t.id}`,
        type: "TASK",
        priority: finalPriority,
        section: finalSection,
        urgency: finalSection === "TODAY" ? (finalPriority >= 4 ? "OVERDUE" : "TODAY") : urgency,
        accentColor: "#a855f7",
        icon: "✅",
        title: t.title || t.name || "(untitled task)",
        subtitle: [t.role, t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : null].filter(Boolean).join(" · "),
        badgeLabel: (t.priority || "").toUpperCase() || "TASK",
        badgeClass: t.priority === "critical" ? "badge-overdue" : t.priority === "high" ? "badge-today" : "badge-week",
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
        context: {
          actionText: row.description || row.notes,
          dueDate: row.due_date,
          category: row.category,
        },
      });
    }
  } catch {}

  // Debt snapshot — always TRACKED
  try {
    const { data } = await sb.from("gyst_debts").select("*").order("balance", { ascending: false });

    const totalDebt = (data || []).reduce((sum, d) => sum + (d.balance || 0), 0);
    if (totalDebt > 0) {
      items.push({
        id: "gyst-debts",
        type: "FINANCIAL",
        priority: 1,
        section: "TRACKED",
        urgency: "SOMEDAY",
        accentColor: "#f59e0b",
        icon: "💳",
        title: `Debt snapshot — ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalDebt)}`,
        subtitle: `${(data || []).length} accounts`,
        badgeLabel: "TRACKED",
        badgeClass: "badge-tracked",
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
// Hardcoded tracked items — won't come from a table
// ---------------------------------------------------------------------------

function getHardcodedTracked() {
  return [
    {
      id: "tracked-ryan-design",
      type: "TASK",
      priority: 2,
      section: "WEEK",
      urgency: "WEEK",
      accentColor: "#6b7280",
      icon: "🎨",
      title: "Ryan — FIRE-ALTMAN design",
      subtitle: "In progress · Slack DM · waiting on proof",
      badgeLabel: "WAITING",
      badgeClass: "badge-waiting",
      context: {
        notes: "Ryan is working on the FIRE-ALTMAN design proof. Follow up on Slack if not delivered by EOD.",
        source: "Slack DM",
      },
    },
    {
      id: "tracked-tracy",
      type: "FINANCIAL",
      priority: 2,
      section: "WEEK",
      urgency: "WEEK",
      accentColor: "#f59e0b",
      icon: "💰",
      title: "Tracy Hutter — IRS penalty",
      subtitle: "Deadline Apr 30 · needs review",
      badgeLabel: "APR 30",
      badgeClass: "badge-today",
      context: {
        vendor: "Tracy Hutter CPA",
        deadline: "2026-04-30",
        notes: "IRS penalty assessment. Review with Tracy before April 30 deadline.",
        amount: null,
      },
    },
    {
      id: "tracked-stripe",
      type: "FINANCIAL",
      priority: 1,
      section: "WEEK",
      urgency: "WEEK",
      accentColor: "#f59e0b",
      icon: "💳",
      title: "Stripe — nonprofit rates",
      subtitle: "Application pending · follow up",
      badgeLabel: "FOLLOW UP",
      badgeClass: "badge-week",
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
      accentColor: "#14b8a6",
      icon: "📦",
      title: "TMF — 100 bracelets",
      subtitle: "Awaiting Katie Dobron approval · $1,800",
      badgeLabel: "PENDING APPROVAL",
      badgeClass: "badge-waiting",
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
      accentColor: "#14b8a6",
      icon: "📦",
      title: "ODU — 150 bracelets (donated)",
      subtitle: "Awaiting size breakdown from Megan",
      badgeLabel: "WAITING INFO",
      badgeClass: "badge-waiting",
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
      accentColor: "#14b8a6",
      icon: "📦",
      title: "Altman — 10 bracelets",
      subtitle: "Awaiting design proof approval",
      badgeLabel: "WAITING PROOF",
      badgeClass: "badge-waiting",
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
      accentColor: "#ef4444",
      icon: "🏠",
      title: "Fort Mill — rental",
      subtitle: "Cash drain -$1,363/mo · watch",
      badgeLabel: "CASH DRAIN",
      badgeClass: "badge-overdue",
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
// Donor stewardship — unacknowledged donations
// ---------------------------------------------------------------------------

async function getDonorStewardship() {
  const sb = getServerClient();

  const { data, error } = await sb
    .from("donations")
    .select(
      "id, donor_first_name, donor_last_name, donor_email, billing_name, amount, donation_amount, donation_date, campaign, donor_segment, notes"
    )
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
    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(donationAmount);

    const ageDays = row.donation_date
      ? (Date.now() - new Date(row.donation_date).getTime()) / 86400000
      : 0;
    const formattedDate = row.donation_date
      ? new Date(row.donation_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : null;

    return {
      id: `donor-${row.id}`,
      type: "DONOR",
      priority: ageDays > 7 ? 4 : 3,
      section: "TODAY",
      urgency: ageDays > 7 ? "OVERDUE" : "TODAY",
      accentColor: "#3b82f6",
      icon: "❤️",
      title: `${donorName} — ${formattedAmount}`,
      subtitle: [row.campaign, formattedDate].filter(Boolean).join(" · "),
      badgeLabel: ageDays > 7 ? "OVERDUE" : "THANK YOU",
      badgeClass: ageDays > 7 ? "badge-overdue" : "badge-today",
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
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  const [emails, orders, tasks, compliance, gyst, calendar, donors] = await Promise.allSettled([
    getActionableEmails(),
    getPendingOrders(),
    getOpenTasks(),
    getUpcomingCompliance(),
    getGystItems(),
    getTodayCalendarItems(),
    getDonorStewardship(),
  ]);

  const getValue = (result, fallback = []) =>
    result.status === "fulfilled" ? result.value : fallback;

  const allItems = [
    ...getValue(emails),
    ...getValue(donors),
    ...getValue(orders),
    ...getValue(tasks),
    ...getValue(compliance),
    ...getValue(gyst),
    ...getValue(calendar),
    ...getHardcodedTracked(),
  ];

  // Deduplicate by id
  const seen = new Set();
  const items = allItems.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Sort: priority desc, then section order
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
    dateLabel,
    generatedAt: now.toISOString(),
    counts: {
      today: items.filter((i) => i.section === "TODAY").length,
      week: items.filter((i) => i.section === "WEEK").length,
      tracked: items.filter((i) => i.section === "TRACKED").length,
    },
  });
}
