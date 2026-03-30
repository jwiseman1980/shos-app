import { readFileSync } from "fs";
import { join } from "path";
import { isAuthenticated } from "@/lib/auth";
import { readKnowledge, writeKnowledge, logFriction as storageLogFriction } from "@/lib/storage/index.js";
import { supabaseQuery, createTask, updateTask, queryTasks, logCloseout, logEngagement } from "@/lib/storage/supabase-tools.js";
import { getTodayEvents, createEvent, updateEvent } from "@/lib/calendar";
import { getHistoricalAverages, getLearningMetrics } from "@/lib/data/learning";
import { getFacebookPosts, getInstagramPosts, getInstagramProfile, getPostComments, checkTokenHealth } from "@/lib/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Operator Chat API Route
// Powers the "Talk to Operator" panel in the SHOS app.
// One unified agent that knows all domains, page-context-aware.
// ---------------------------------------------------------------------------

// Tools available to all role agents
const TOOLS = [
  {
    name: "read_context_file",
    description: "Read the current knowledge file for this role or any other role. Use this to refresh your understanding of the current state.",
    input_schema: {
      type: "object",
      properties: {
        role: {
          type: "string",
          enum: ["ed", "cos", "cfo", "coo", "comms", "dev", "family", "architect"],
          description: "Which role's context file to read",
        },
      },
      required: ["role"],
    },
  },
  {
    name: "update_context_file",
    description: "Update this role's knowledge file. Use this at session close to write the closeout: what was done, decisions made, next actions, updated todos.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The full updated content for the context file",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "read_shos_state",
    description: "Read the master SHOS state document — the cross-role nervous system showing status of all roles.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "log_friction",
    description: "Log a friction point, bug, missing feature, or improvement idea to the friction log for the COS to triage and route to a build session. Use this any time you notice something that would make the system better.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["bug", "missing", "improvement", "idea"],
          description: "bug=something broken, missing=feature that should exist, improvement=could be better, idea=new concept",
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
        },
        description: {
          type: "string",
          description: "Clear description of the friction point — specific enough for a developer to act on",
        },
      },
      required: ["type", "priority", "description"],
    },
  },
  {
    name: "log_decision",
    description: "Record a significant decision made during this session to the role's context file decision log.",
    input_schema: {
      type: "object",
      properties: {
        decision: { type: "string", description: "What was decided" },
        reasoning: { type: "string", description: "Why this decision was made" },
      },
      required: ["decision", "reasoning"],
    },
  },
  {
    name: "flag_to_role",
    description: "Surface a cross-role flag in SHOS_STATE.md — something another role needs to know or act on. Do not fix issues outside your domain; flag them.",
    input_schema: {
      type: "object",
      properties: {
        target_role: {
          type: "string",
          enum: ["ed", "cos", "cfo", "coo", "comms", "dev", "family", "architect"],
        },
        message: { type: "string", description: "What the target role needs to know or do" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["target_role", "message", "priority"],
    },
  },
  {
    name: "sf_query",
    description: "Query Salesforce with SOQL. Use this to pull live data during a session — obligations, disbursements, heroes, contacts, etc.",
    input_schema: {
      type: "object",
      properties: {
        soql: { type: "string", description: "The SOQL query to execute" },
      },
      required: ["soql"],
    },
  },
  {
    name: "app_query",
    description: `Query the SHOS app's internal API to get live operational data. Use this to look up orders, shipping queues, designs, donors, families, anniversaries, finances, and more.

Available endpoints:
- /api/orders — all orders (use ?status=shipped|pending|etc to filter)
- /api/orders/triage — orders needing action (design needed, ready to ship, etc.)
- /api/anniversaries — anniversaries (use ?month=1-12 to filter by month, defaults to current month)
- /api/designs — design queue
- /api/donors — donor list
- /api/families — family records
- /api/messages — family messages
- /api/heroes — hero records
- /api/briefing — daily brief data (action items, KPIs)
- /api/finance/obligations — obligation tracker
- /api/finance/org-balances — org balances
- /api/finance/disbursements — disbursement records
- /api/finance/expenses — expense records
- /api/finance/donations-received — donations received

Always use app_query (not sf_query) when a user asks about orders, shipping, designs, or other app data. sf_query is for direct Salesforce SOQL only.`,
    input_schema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "The API endpoint path, e.g. /api/orders or /api/orders?status=pending",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "app_mutation",
    description: `Write data through the SHOS app's internal API. Use this for any action that changes data — assigning volunteers, updating statuses, creating records, etc.

Available mutation endpoints:
- PATCH /api/heroes/update — update anniversary status, assignment, notes, completion date. Body: { sfId, status, assignedToName, notes, completedDate, heroName }
- POST /api/anniversaries/draft-email — create a Gmail draft for an anniversary email. Body: { heroName, branch, years, memorialDate, familyEmail, familyName, senderEmail, senderName, sfId }
- POST /api/tasks — create a task. Body: { title, description, status, priority, role, domain, hero_id, due_date, tags }
- POST /api/engagements — log an engagement. Body: { type, subject, description, outcome, follow_up_needed, follow_up_date }

Always confirm with the user before making bulk mutations (e.g., assigning 20 heroes at once). Single updates are fine without confirmation.`,
    input_schema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "The API endpoint path, e.g. /api/heroes/update",
        },
        method: {
          type: "string",
          enum: ["POST", "PATCH", "PUT"],
          description: "HTTP method",
        },
        body: {
          type: "object",
          description: "The request body to send as JSON",
        },
      },
      required: ["endpoint", "method", "body"],
    },
  },
  {
    name: "supabase_query",
    description: "Query any Supabase table with filters. Tables: heroes, contacts, organizations, orders, order_items, donations, disbursements, expenses, family_messages, tasks, volunteers, engagements, decisions, open_questions, anniversary_emails, knowledge_files, friction_logs, sop_executions, closeouts, initiatives, sf_sync_log, hero_associations, users.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name to query" },
        select: { type: "string", description: "Columns to select (default: *)" },
        filters: {
          type: "object",
          description: 'Filter object: { column: value } for eq, or { column: { op: "gte", value: "2026-01-01" } } for other operators (gte, lte, gt, lt, neq, like, ilike)',
        },
        limit: { type: "number", description: "Max rows to return (default: 50)" },
        order: { type: "string", description: "Column to order by. Prefix with - for descending (e.g. -created_at)" },
      },
      required: ["table"],
    },
  },
  {
    name: "create_task",
    description: "Create a task and assign it to a role. Use this to delegate work. For example: create a task for COS to research VA registration, or for COO to check inventory levels.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title — clear and actionable" },
        description: { type: "string", description: "Detailed description of what needs to be done" },
        priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
        role: { type: "string", enum: ["ed", "cos", "cfo", "coo", "comms", "dev", "family", "architect"], description: "Which role owns this task" },
        due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
        domain: { type: "string", description: "Domain area: finance, operations, comms, governance, compliance, etc." },
        sop_ref: { type: "string", description: "Reference to SOP if task is SOP-driven (e.g. SOP-FIN-001)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for categorization" },
      },
      required: ["title", "role"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing task's status, priority, or notes.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "UUID of the task to update" },
        status: { type: "string", enum: ["backlog", "todo", "in_progress", "blocked", "done", "cancelled"] },
        priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
        notes: { type: "string", description: "Additional notes to add" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "query_tasks",
    description: "Query tasks with filters. Use this to see what's open, what's assigned to a role, what's overdue, etc.",
    input_schema: {
      type: "object",
      properties: {
        role: { type: "string", enum: ["ed", "cos", "cfo", "coo", "comms", "dev", "family", "architect"], description: "Filter by assigned role" },
        status: { type: "string", enum: ["backlog", "todo", "in_progress", "blocked", "done", "cancelled"] },
        priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
        due_before: { type: "string", description: "Show tasks due before this date (YYYY-MM-DD)" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "log_closeout",
    description: "Write a session closeout record to Supabase. Call this at session end AFTER updating the context file. Records what happened, decisions made, and follow-ups needed.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Brief summary of what was accomplished this session" },
        decisions_made: { type: "array", items: { type: "string" }, description: "List of decisions made" },
        artifacts_created: { type: "array", items: { type: "string" }, description: "List of artifacts created or modified" },
        follow_ups: { type: "array", items: { type: "string" }, description: "List of follow-up items for next session" },
      },
      required: ["summary"],
    },
  },
  {
    name: "log_engagement",
    description: "Record an interaction with an external contact or organization — an email sent, a call made, a meeting held, a partnership discussion.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["social_media", "email", "phone", "in_person", "event", "partnership", "other"] },
        subject: { type: "string", description: "What was the engagement about" },
        description: { type: "string", description: "Details of the engagement" },
        outcome: { type: "string", description: "What resulted from the engagement" },
        follow_up_needed: { type: "boolean" },
        follow_up_date: { type: "string", description: "Follow-up date in YYYY-MM-DD format" },
      },
      required: ["type", "subject"],
    },
  },
  {
    name: "query_calendar",
    description: "Get today's calendar events across all Steel Hearts role calendars (Primary, Ops, CTO, ED, COS, CFO, COO, Comms, Dev, Family). Use this to see what's scheduled, find context from event descriptions, or check availability.",
    input_schema: {
      type: "object",
      properties: {
        roles: {
          type: "array",
          items: { type: "string", enum: ["primary", "ops", "cto", "ed", "cos", "cfo", "coo", "comms", "dev", "family"] },
          description: "Which role calendars to check (default: all)",
        },
        date: {
          type: "string",
          description: "Date to query in YYYY-MM-DD format (default: today)",
        },
      },
    },
  },
  {
    name: "create_calendar_event",
    description: "Create a calendar event on a role calendar. Use this to schedule tasks, sessions, follow-ups, or ideas. Every task and idea should get a calendar slot.",
    input_schema: {
      type: "object",
      properties: {
        role: {
          type: "string",
          enum: ["primary", "ops", "cto", "ed", "cos", "cfo", "coo", "comms", "dev", "family"],
          description: "Which role calendar to create the event on",
        },
        summary: { type: "string", description: "Event title" },
        description: { type: "string", description: "Event description — include full context, dependencies, files, and follow-ups" },
        startTime: { type: "string", description: "Start time as ISO datetime (e.g. 2026-04-01T10:00:00-04:00) or YYYY-MM-DD for all-day" },
        endTime: { type: "string", description: "End time as ISO datetime or YYYY-MM-DD for all-day" },
        colorId: { type: "string", description: "Color: 1=Lavender, 2=Sage, 3=Grape, 4=Flamingo, 5=Banana, 6=Tangerine, 7=Peacock, 8=Graphite, 9=Blueberry, 10=Basil, 11=Tomato" },
      },
      required: ["role", "summary", "startTime", "endTime"],
    },
  },
  {
    name: "query_learning",
    description: "Get learning metrics from the execution history. Shows estimation accuracy (are estimates too high/low?), velocity trends (speeding up or slowing?), domain coverage (which areas are neglected?), and recency-weighted time averages by task type. Use this when asked about performance, patterns, or how the system is learning.",
    input_schema: {
      type: "object",
      properties: {
        detail: {
          type: "string",
          enum: ["summary", "averages", "accuracy", "full"],
          description: "Level of detail: summary (key metrics), averages (time estimates by type), accuracy (estimation accuracy per type), full (everything)",
        },
      },
    },
  },
  {
    name: "query_social_media",
    description: "Get real engagement data from Steel Hearts Facebook and Instagram accounts. Use this when asked about social media performance, recent posts, engagement, followers, or when doing daily SOP-001 engagement. NEVER use browser automation for Instagram — API only.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["ig_profile", "ig_posts", "fb_posts", "comments", "token_health", "dashboard"],
          description: "What to fetch: ig_profile (follower stats), ig_posts (recent IG posts with engagement), fb_posts (recent FB posts), comments (comments on a specific post), token_health (check if token expires soon), dashboard (combined overview)",
        },
        postId: {
          type: "string",
          description: "Post ID — required when action is 'comments'",
        },
        limit: {
          type: "number",
          description: "Number of posts to fetch (default 10)",
        },
      },
      required: ["action"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeReadContextFile(role) {
  return await readKnowledge(role);
}

async function executeUpdateContextFile(role, content) {
  return await writeKnowledge(role, content);
}

function executeReadShosState() {
  try {
    return readFileSync(join(process.cwd(), "SHOS_STATE.md"), "utf8");
  } catch {
    return "SHOS_STATE.md not found.";
  }
}

async function executeLogFriction(role, type, priority, description) {
  return await storageLogFriction(role, type, priority, description);
}

async function executeLogDecision(role, decision, reasoning) {
  try {
    const supabase = (await import("@/lib/supabase")).getServerClient();
    await supabase.from("decisions").insert({
      decision,
      reasoning,
      role: role || "operator",
      created_at: new Date().toISOString(),
    });
    return `Decision logged: "${decision}"`;
  } catch (e) {
    return `Failed to log decision: ${e.message}`;
  }
}

async function executeFlagToRole(sourceRole, targetRole, message, priority) {
  try {
    const supabase = (await import("@/lib/supabase")).getServerClient();
    await supabase.from("tasks").insert({
      title: `Flag: ${message.slice(0, 80)}`,
      description: message,
      status: "todo",
      priority: priority || "medium",
      role: targetRole || "ed",
      domain: "flag",
      tags: ["flag", `from:${sourceRole || "operator"}`],
    });
    return `Flag created as task for ${targetRole}: "${message}"`;
  } catch (e) {
    return `Failed to flag: ${e.message}`;
  }
}

async function executeAppQuery(endpoint) {
  try {
    // Build base URL — NEXT_PUBLIC_BASE_URL takes priority (production URL)
    // VERCEL_URL is deployment-specific and changes per deploy, so we avoid it
    const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Ensure endpoint starts with /
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${base}${path}`;

    const res = await fetch(url, {
      headers: {
        // Use SHOS_API_KEY to bypass middleware auth — same bypass used by external integrations
        "x-api-key": process.env.SHOS_API_KEY || "",
      },
    });

    if (!res.ok) {
      return `API request failed: ${res.status} ${res.statusText} for ${endpoint}`;
    }

    const data = await res.json();
    // Limit response size to avoid token blowout
    const text = JSON.stringify(data, null, 2);
    return text.length > 8000 ? text.slice(0, 8000) + "\n...(truncated)" : text;
  } catch (e) {
    return `App query failed: ${e.message}`;
  }
}

async function executeAppMutation(endpoint, method, body) {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${base}${path}`;

    const res = await fetch(url, {
      method: method || "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SHOS_API_KEY || "",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return `Mutation failed (${res.status}): ${JSON.stringify(data)}`;
    }

    const text = JSON.stringify(data, null, 2);
    return text.length > 4000 ? text.slice(0, 4000) + "\n...(truncated)" : text;
  } catch (e) {
    return `App mutation failed: ${e.message}`;
  }
}

async function executeSfQuery(soql) {
  if (process.env.SF_LIVE !== "true") {
    return "Salesforce is not connected (SF_LIVE is not true). Query not executed.";
  }
  try {
    const { sfQuery } = await import("@/lib/salesforce");
    const results = await sfQuery(soql);
    return JSON.stringify(results, null, 2);
  } catch (e) {
    return `Salesforce query failed: ${e.message}`;
  }
}

async function handleToolCall(role, toolName, toolInput) {
  switch (toolName) {
    case "read_context_file":
      return await executeReadContextFile(toolInput.role);
    case "update_context_file":
      return await executeUpdateContextFile(role, toolInput.content);
    case "read_shos_state":
      return executeReadShosState();
    case "log_friction":
      return await executeLogFriction(role, toolInput.type, toolInput.priority, toolInput.description);
    case "log_decision":
      return executeLogDecision(role, toolInput.decision, toolInput.reasoning);
    case "flag_to_role":
      return executeFlagToRole(role, toolInput.target_role, toolInput.message, toolInput.priority);
    case "sf_query":
      return await executeSfQuery(toolInput.soql);
    case "app_query":
      return await executeAppQuery(toolInput.endpoint);
    case "app_mutation":
      return await executeAppMutation(toolInput.endpoint, toolInput.method, toolInput.body);
    case "supabase_query":
      return await supabaseQuery(toolInput);
    case "create_task":
      return await createTask(toolInput);
    case "update_task":
      return await updateTask(toolInput);
    case "query_tasks":
      return await queryTasks(toolInput);
    case "log_closeout":
      return await logCloseout({ role, ...toolInput });
    case "log_engagement":
      return await logEngagement(toolInput);
    case "query_calendar": {
      const options = {};
      if (toolInput.roles) options.roles = toolInput.roles;
      if (toolInput.date) {
        options.timeMin = `${toolInput.date}T00:00:00`;
        options.timeMax = `${toolInput.date}T23:59:59`;
      }
      const events = await getTodayEvents(options);
      return JSON.stringify(events.map(e => ({
        time: e.allDay ? "All day" : new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }),
        role: e.role,
        title: e.summary,
        description: e.description?.slice(0, 200) || "",
      })), null, 2);
    }
    case "create_calendar_event": {
      const event = await createEvent(toolInput);
      return `Calendar event created: "${event.summary}" on ${event.role} calendar. Link: ${event.htmlLink}`;
    }
    case "query_learning": {
      const detail = toolInput.detail || "summary";
      if (detail === "summary" || detail === "full") {
        const metrics = await getLearningMetrics();
        if (detail === "summary") return JSON.stringify(metrics, null, 2);
        const { averages, accuracy, domainVelocity } = await getHistoricalAverages();
        return JSON.stringify({ metrics, averages, accuracy, domainVelocity }, null, 2);
      }
      const { averages, accuracy, domainVelocity } = await getHistoricalAverages();
      if (detail === "averages") return JSON.stringify({ averages, domainVelocity }, null, 2);
      if (detail === "accuracy") return JSON.stringify({ accuracy }, null, 2);
      return JSON.stringify({ averages, accuracy }, null, 2);
    }
    case "query_social_media": {
      const action = toolInput.action || "dashboard";
      const limit = toolInput.limit || 10;
      switch (action) {
        case "ig_profile":
          return JSON.stringify(await getInstagramProfile(), null, 2);
        case "ig_posts":
          return JSON.stringify(await getInstagramPosts(limit), null, 2);
        case "fb_posts":
          return JSON.stringify(await getFacebookPosts(limit), null, 2);
        case "comments": {
          if (!toolInput.postId) return "Error: postId is required for comments action";
          return JSON.stringify(await getPostComments(toolInput.postId, limit), null, 2);
        }
        case "token_health":
          return JSON.stringify(await checkTokenHealth(), null, 2);
        case "dashboard": {
          const [profile, fb, ig] = await Promise.all([
            getInstagramProfile().catch(() => null),
            getFacebookPosts(5).catch(() => []),
            getInstagramPosts(5).catch(() => []),
          ]);
          return JSON.stringify({ instagram: profile, recentFacebook: fb, recentInstagram: ig }, null, 2);
        }
        default:
          return `Unknown social media action: ${action}`;
      }
    }
    default:
      return `Unknown tool: ${toolName}`;
  }
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function getPageContext(pathname) {
  if (!pathname || pathname === "/") return "Dashboard — show top priorities across all domains.";
  if (pathname.includes("/finance")) return "Finance section — lead with financial data, obligations, disbursements, donations.";
  if (pathname.includes("/anniversaries")) return "Anniversary Email Tracker — lead with this month's anniversary status, assignments, and outstanding emails.";
  if (pathname.includes("/orders") || pathname.includes("/shipping") || pathname.includes("/inventory")) return "Operations — lead with order pipeline, production status, shipping queue.";
  if (pathname.includes("/comms") || pathname.includes("/content") || pathname.includes("/memorials")) return "Communications — lead with social media, content calendar, memorial pages.";
  if (pathname.includes("/donors") || pathname.includes("/dev")) return "Development — lead with donor data, stewardship, fundraising.";
  if (pathname.includes("/family") || pathname.includes("/families") || pathname.includes("/messages") || pathname.includes("/volunteers")) return "Family Relations — lead with family outreach, messages, volunteer coordination.";
  if (pathname.includes("/tasks")) return "Task Board — lead with open tasks across all domains.";
  if (pathname.includes("/coo") || pathname.includes("/bracelets") || pathname.includes("/designs") || pathname.includes("/laser")) return "Operations — lead with bracelet pipeline, designs, laser production.";
  if (pathname.includes("/sops")) return "SOPs — lead with procedure status and execution.";
  return "General — brief on top priorities.";
}

async function buildSystemPrompt(pathname) {
  const contextContent = await readKnowledge("operator");
  const pageHint = getPageContext(pathname);

  // Load learning context for smarter suggestions
  let learningContext = "";
  try {
    const metrics = await getLearningMetrics();
    if (metrics) {
      const parts = [];
      if (metrics.estimationAccuracy) parts.push(`Estimation accuracy: ${metrics.estimationAccuracy}%`);
      if (metrics.velocity) parts.push(`Velocity: ${metrics.velocity} completions/day (${metrics.velocityTrend || "stable"})`);
      if (metrics.neglectedDomains?.length) parts.push(`Neglected domains: ${metrics.neglectedDomains.join(", ")}`);
      if (metrics.totalCompleted) parts.push(`Total completed: ${metrics.totalCompleted} tasks`);
      if (parts.length) {
        learningContext = `\n## Learning Metrics (last 30 days)\n${parts.join("\n")}\nUse these to calibrate time estimates and flag domains that need attention.`;
      }
    }
  } catch {}

  return `You are the Steel Hearts Operator — the operational brain of Steel Hearts, a Gold Star family memorial bracelet nonprofit. You operate inside the Steel Hearts Operating System (SHOS).

You know EVERY domain. You have no boundaries. When someone asks a question, you answer it — whether it's about finances, anniversaries, orders, donors, social media, or governance. You are one agent, not eight.

## Current Page Context
The user is viewing: ${pathname || "/"}
${pageHint}
Lead with what's relevant to this page, but you can discuss anything.

## Your Context File
${contextContent || "(No context file found yet — this is a fresh session.)"}

## What You Know

### Anniversary Emails (Family Relations)
Every hero has a memorial date. Each year, a team member personally reaches out to the Gold Star family. This is not automated mass mail — it's a human telling a family their hero is not forgotten.
- Anniversary Email Tracker at /anniversaries — query via \`/api/anniversaries?month=1-12\`
- Each hero has: status (not_assigned, assigned, in_progress, email_drafted, email_sent, complete, research, skipped), assigned_to, notes
- Heroes with no family_contact_id are "Research" — need family contact found first
- "Create Draft" generates a Gmail draft via domain-wide delegation
- Use \`app_mutation\` with PATCH /api/heroes/update to assign volunteers: { sfId, assignedToName: "Kristin Hughes" }
- When assigned, volunteer gets email + Slack notification automatically
- When status set to Sent/Complete, the task auto-completes

### Daily Social Media (SOP-001)
15-20 minute daily process, any volunteer:
1. Open Meta Business Suite → Inbox (business.facebook.com/latest/inbox)
2. Respond to new DMs
3. Review new comments — like genuine, hide spam/extremist, block hateful
4. Growth Lever — love shared posts, invite reactors to follow (≤50: all; >50: first 50, prioritize Heart/Cry)
5. Share to Stories — latest post to FB Story + IG Story
6. Post completion to Slack #social-media-ops
CRITICAL: Never use browser automation for Instagram. API only.

### Orders & Production (Operations)
- Order pipeline: design_needed → ready_to_laser → in_production → ready_to_ship → shipped
- Query: \`/api/orders\`, \`/api/orders/triage\`, \`/api/designs\`
- CRITICAL: Only heroes with active_listing = true appear on the website
- ShipStation handles fulfillment tracking

### Finance
- Obligations, disbursements, donations, expenses via \`/api/finance/*\` endpoints
- $10 charity obligation per bracelet sold; D variants add $10 to Steel Hearts
- Monthly close is sacred — never skip

### Donors & Development
- Donor segments: first-time, repeat, major, lapsed
- Query: \`/api/donors\`, \`/api/finance/donations-received\`

### Governance & Compliance
- SC Charitable Solicitation renewal: May 15, 2026
- Board governance policy adoption: April 2, 2026
- 990-EZ filing in progress with CPA Tracy Hutter
- Insurance gaps: zero D&O, zero General Liability

### Build Requests
You cannot write code. When something needs to be built or fixed in the app, use log_friction to document it. Joseph handles builds in Claude Code/Cowork sessions.

## Supabase (Primary Database)
Use supabase_query to pull live data. Tables: heroes, contacts, organizations, orders, order_items, donations, disbursements, expenses, family_messages, tasks, volunteers, engagements, decisions, open_questions, anniversary_emails, knowledge_files, friction_logs, sop_executions, closeouts, initiatives, social_media_posts, social_media_profile_snapshots.

Prefer app_query/app_mutation for data available via API routes. Use supabase_query for direct table access when needed.
${learningContext}

## How Sessions Work
1. BOOT: Read context file + check open tasks + brief based on current page
2. WORK: Execute what the user wants. Use tools actively.
3. CLOSEOUT: Update context file via update_context_file. Log closeout via log_closeout. Create follow-up tasks.

## Tone
Direct, operational, no fluff. You know this org. You have context. Brief like a competent operator who has been running this system.`;
}

// ---------------------------------------------------------------------------
// Anthropic SSE stream parser
// Reads the streaming response from Claude, forwards text deltas and tool
// activity to the client in real time, and collects content blocks for the
// agentic tool-execution loop.
// ---------------------------------------------------------------------------

async function parseAnthropicStream(body, send) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const contentBlocks = [];
  let currentToolInput = "";
  let stopReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop(); // keep incomplete chunk

    for (const part of parts) {
      const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;

      let data;
      try {
        data = JSON.parse(dataLine.slice(6));
      } catch {
        continue;
      }

      switch (data.type) {
        case "content_block_start": {
          const block = data.content_block;
          if (block.type === "text") {
            contentBlocks[data.index] = { type: "text", text: "" };
          } else if (block.type === "tool_use") {
            contentBlocks[data.index] = {
              type: "tool_use",
              id: block.id,
              name: block.name,
              input: {},
            };
            currentToolInput = "";
            send({ type: "tool_start", name: block.name });
          }
          break;
        }

        case "content_block_delta": {
          if (data.delta.type === "text_delta") {
            contentBlocks[data.index].text += data.delta.text;
            send({ type: "text", delta: data.delta.text });
          } else if (data.delta.type === "input_json_delta") {
            currentToolInput += data.delta.partial_json;
          }
          break;
        }

        case "content_block_stop": {
          if (contentBlocks[data.index]?.type === "tool_use") {
            try {
              contentBlocks[data.index].input = JSON.parse(currentToolInput || "{}");
            } catch {
              contentBlocks[data.index].input = {};
            }
            currentToolInput = "";
          }
          break;
        }

        case "message_delta": {
          if (data.delta?.stop_reason) {
            stopReason = data.delta.stop_reason;
          }
          break;
        }
      }
    }
  }

  return { contentBlocks: contentBlocks.filter(Boolean), stopReason };
}

// ---------------------------------------------------------------------------
// POST handler — streams events to the client as newline-delimited JSON:
//   {"type":"tool_start","name":"read_context_file"}
//   {"type":"tool_executing","name":"read_context_file"}
//   {"type":"tool_done","name":"read_context_file"}
//   {"type":"text","delta":"Here is your briefing..."}
//   {"type":"done","toolsUsed":["read_context_file","query_tasks"]}
//   {"type":"error","message":"..."}
// ---------------------------------------------------------------------------

export async function POST(request) {
  // Auth check
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({
      error: "ANTHROPIC_API_KEY not configured",
      message: "Add your Anthropic API key to .env.local to enable role agents. Get one at console.anthropic.com",
    }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { role, pathname, messages } = body;

  if (!messages) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  let systemPrompt;
  try {
    systemPrompt = await buildSystemPrompt(pathname || "/");
  } catch (e) {
    console.error("[chat/role] buildSystemPrompt failed:", e);
    return Response.json({
      error: "Failed to build system prompt",
      message: e.message,
    }, { status: 500 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // Controller already closed
        }
      };

      try {
        let currentMessages = [...messages];
        const toolsUsed = [];
        const maxIterations = 10;

        for (let i = 0; i < maxIterations; i++) {
          const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 4096,
              system: systemPrompt,
              tools: TOOLS,
              messages: currentMessages,
              stream: true,
            }),
          });

          if (!apiResponse.ok) {
            const err = await apiResponse.text();
            send({ type: "error", message: `Claude API error (${apiResponse.status}): ${err}` });
            break;
          }

          // Parse the streaming response — text deltas and tool_start events
          // are forwarded to the client in real time via `send`
          const { contentBlocks, stopReason } = await parseAnthropicStream(
            apiResponse.body,
            send
          );

          // end_turn → agent is done talking, break out
          if (stopReason === "end_turn") {
            break;
          }

          // tool_use → execute each tool, then loop for the next Claude turn
          if (stopReason === "tool_use") {
            currentMessages.push({ role: "assistant", content: contentBlocks });

            const toolResults = [];
            for (const block of contentBlocks) {
              if (block.type === "tool_use") {
                toolsUsed.push(block.name);
                send({ type: "tool_executing", name: block.name });

                const result = await handleToolCall("operator", block.name, block.input);

                send({ type: "tool_done", name: block.name });
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: typeof result === "string" ? result : JSON.stringify(result),
                });
              }
            }

            currentMessages.push({ role: "user", content: toolResults });
            continue;
          }

          // Unexpected stop reason — still break
          break;
        }

        send({ type: "done", toolsUsed: [...new Set(toolsUsed)] });
      } catch (e) {
        try {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "error", message: e.message }) + "\n")
          );
        } catch {
          // swallow — controller may already be closed
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
