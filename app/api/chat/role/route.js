import { readFileSync } from "fs";
import { join } from "path";
import { isAuthenticated } from "@/lib/auth";
import { readKnowledge, writeKnowledge, logFriction as storageLogFriction } from "@/lib/storage/index.js";
import { supabaseQuery, createTask, updateTask, queryTasks, logCloseout, logEngagement } from "@/lib/storage/supabase-tools.js";
import { getTodayEvents, createEvent, updateEvent, getCalendarId } from "@/lib/calendar";
import { listInbox, getMessage, archiveMessage, archiveMessages, createGmailDraft } from "@/lib/gmail";
import { getHistoricalAverages, getLearningMetrics } from "@/lib/data/learning";
import { getFacebookPosts, getInstagramPosts, getInstagramProfile, getPostComments, checkTokenHealth } from "@/lib/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Operator Chat API Route
// Powers the "Talk to Operator" panel in the SHOS app.
// One unified agent that knows all domains, page-context-aware.
// ---------------------------------------------------------------------------

// Tools available to the Operator
const TOOLS = [
  {
    name: "read_context_file",
    description: "Read the current knowledge file for this role or any other role. Use this to refresh your understanding of the current state.",
    input_schema: {
      type: "object",
      properties: {
        role: {
          type: "string",
          enum: ["operator", "architect", "ed", "cos", "cfo", "coo", "comms", "dev", "family"],
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
    description: "Log a friction point, bug, missing feature, or improvement idea. The Architect reads these during build sessions. Use this any time you notice something that would make the system better.",
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
    description: "Flag an issue for the Architect (build/code needs) or log a cross-domain note. Creates a task tagged to the target. Primary use: flag bugs or feature needs for the Architect to handle in Claude Code.",
    input_schema: {
      type: "object",
      properties: {
        target_role: {
          type: "string",
          enum: ["operator", "architect", "ed", "cos", "cfo", "coo", "comms", "dev", "family"],
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
    description: "Create a task tagged to a domain. Use role='operator' for operational work you'll handle, role='architect' for build/code work Joseph handles in Claude Code. The role field is a domain tag, not a separate agent.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title — clear and actionable" },
        description: { type: "string", description: "Detailed description of what needs to be done" },
        priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
        role: { type: "string", enum: ["operator", "architect", "ed", "cos", "cfo", "coo", "comms", "dev", "family"], description: "Domain tag: use 'operator' for ops work, 'architect' for build work. Legacy values (ed, cos, etc.) are still valid for categorization." },
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
        role: { type: "string", enum: ["operator", "architect", "ed", "cos", "cfo", "coo", "comms", "dev", "family"], description: "Filter by assigned role" },
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
    description: "Get today's calendar events across all Steel Hearts functional calendars (Primary, Ops, CTO, Finance, Operations, Comms, Dev, Family). Each calendar tracks a domain of work, not a separate agent. Use this to see what's scheduled, find context from event descriptions, or check availability.",
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
    description: "Create a calendar event on a functional calendar. Use this to schedule tasks, sessions, follow-ups, or ideas. EVERY task, idea, and plan gets a calendar slot — no exceptions. Pick the calendar that matches the domain of work.",
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
  {
    name: "query_email",
    description: "Search and list emails from Joseph's Gmail inbox. Use Gmail search syntax in the query field (e.g. 'is:unread', 'from:someone@example.com', 'subject:bracelets', 'newer_than:3d'). Returns message metadata + snippets. Use read_email to get the full body of a specific message.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Gmail search query (e.g. 'is:unread', 'from:tracy@hutter-cpa.com', 'subject:order newer_than:7d'). Default: inbox messages." },
        maxResults: { type: "number", description: "Max messages to return (default: 20, max: 50)" },
      },
    },
  },
  {
    name: "read_email",
    description: "Read the full content of a specific email by message ID. Returns headers, body text, labels. Use query_email first to find message IDs.",
    input_schema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "The Gmail message ID to read" },
      },
      required: ["messageId"],
    },
  },
  {
    name: "archive_email",
    description: "Archive one or more emails (removes from inbox). Use this to help triage the inbox. Provide a single messageId or an array of messageIds for bulk archiving.",
    input_schema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "Single message ID to archive" },
        messageIds: { type: "array", items: { type: "string" }, description: "Array of message IDs to archive in bulk" },
      },
    },
  },
  {
    name: "draft_email",
    description: "Create a Gmail draft email from joseph.wiseman@steel-hearts.org. The draft will appear in Gmail for Joseph to review and send. NEVER auto-send — always draft. For anniversary emails, donor emails, or family message packets, use the specialized app_mutation endpoints instead.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body text" },
        cc: { type: "string", description: "CC recipients (comma-separated)" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "update_calendar_event",
    description: "Update an existing calendar event — change the title, description, or color. Use query_calendar first to find the event ID and calendar ID.",
    input_schema: {
      type: "object",
      properties: {
        calendarId: { type: "string", description: "The calendar ID (from the event's role field in query_calendar results, or use the full calendar ID)" },
        eventId: { type: "string", description: "The event ID to update" },
        summary: { type: "string", description: "New event title" },
        description: { type: "string", description: "New event description" },
        colorId: { type: "string", description: "Color: 1=Lavender, 2=Sage(completed), 3=Grape, 4=Flamingo, 5=Banana, 6=Tangerine, 7=Peacock, 8=Graphite, 9=Blueberry, 10=Basil, 11=Tomato" },
      },
      required: ["calendarId", "eventId"],
    },
  },
  {
    name: "navigate_to",
    description: "Navigate the user's browser to a page in the SHOS app. Use this whenever your response is about a specific domain so the user sees the relevant data. For example: discussing orders → navigate to /orders, asking about anniversaries → /anniversaries, finance questions → /finance, family messages → /families, hero details → /heroes, social media → /comms, designs → /designs. Always navigate when the conversation topic maps to a page.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The app path to navigate to, e.g. /orders, /anniversaries, /finance, /families, /heroes, /comms, /designs, /donors, /tasks, /governance",
        },
      },
      required: ["path"],
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
        id: e.id,
        calendarId: e.role,
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
    case "query_email": {
      const options = {};
      if (toolInput.query) options.query = toolInput.query;
      if (toolInput.maxResults) options.maxResults = Math.min(toolInput.maxResults, 50);
      const inbox = await listInbox(options);
      const messages = inbox.messages || inbox;
      return JSON.stringify(messages.map(m => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        date: m.date,
        snippet: m.snippet,
        labels: m.labelIds,
      })), null, 2);
    }
    case "read_email": {
      const msg = await getMessage(toolInput.messageId);
      return JSON.stringify({
        id: msg.id,
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        date: msg.date,
        body: msg.body?.slice(0, 6000) || "",
        labels: msg.labelIds,
      }, null, 2);
    }
    case "archive_email": {
      if (toolInput.messageIds && toolInput.messageIds.length > 0) {
        await archiveMessages(toolInput.messageIds);
        return `Archived ${toolInput.messageIds.length} messages.`;
      }
      if (toolInput.messageId) {
        await archiveMessage(toolInput.messageId);
        return `Archived message ${toolInput.messageId}.`;
      }
      return "Error: provide messageId or messageIds to archive.";
    }
    case "draft_email": {
      const draft = await createGmailDraft({
        senderEmail: "joseph.wiseman@steel-hearts.org",
        senderName: "Joseph Wiseman",
        to: toolInput.to,
        subject: toolInput.subject,
        body: toolInput.body,
        cc: toolInput.cc,
      });
      return `Draft created: "${toolInput.subject}" to ${toolInput.to}. Draft ID: ${draft.id}`;
    }
    case "update_calendar_event": {
      // Resolve role shorthand to full calendar ID if needed
      let calId = toolInput.calendarId;
      const resolved = getCalendarId(calId);
      if (resolved) calId = resolved;
      const updates = {};
      if (toolInput.summary) updates.summary = toolInput.summary;
      if (toolInput.description) updates.description = toolInput.description;
      if (toolInput.colorId) updates.colorId = toolInput.colorId;
      const result = await updateEvent({ calendarId: calId, eventId: toolInput.eventId, updates });
      return `Event updated: "${result.summary || toolInput.eventId}"`;
    }
    case "navigate_to":
      // Navigation is handled by the stream layer — just acknowledge here
      return `Navigating to ${toolInput.path}`;
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

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

  return `You are the Steel Hearts Operator — the single operational agent for Steel Hearts, a Gold Star family memorial bracelet nonprofit. Today is ${dateStr}, ${timeStr} ET.

## Context
${contextContent || "(No context file yet — read it via read_context_file role=operator.)"}
${learningContext}

## Page: ${pathname || "/"}
${pageHint}

## Core Rules
- Supabase is primary DB. Use supabase_query for direct access, app_query/app_mutation for API routes.
- Tables: heroes, contacts, organizations, orders, order_items, donations, disbursements, expenses, family_messages, tasks, volunteers, engagements, decisions, open_questions, anniversary_emails, knowledge_files, friction_logs, sop_executions, closeouts, initiatives, social_media_posts, social_media_profile_snapshots, users, sf_sync_log.
- Supabase is PRIMARY. Salesforce is nightly backup mirror only — do NOT write new features to SF.
- $10 charity obligation per bracelet ($35 standard). D-variant SKUs being phased out — donations are now separate checkout line items on the new website.
- Only active_listing=true heroes appear on the public website. Ever.
- Never use browser automation for Instagram. API only (past incident: garbled "??" sent to memorial posts).
- Email drafts only — never auto-send. Humans review and send.
- Calendar IS the task system. Every idea, task, and plan gets a calendar slot. No unscheduled backlogs.
- Flag bugs/features to Architect via log_friction or flag_to_role target="architect". Auto-flag blockers immediately.
- When users propose ideas, features, or improvements: log them via log_friction with type="idea" and role="architect". This puts them in the Architect queue for the next build session. Confirm to the user that their idea has been queued.
- Navigate to relevant page via navigate_to when discussing a domain. Navigate early.
- At session close: update_context_file + log_closeout + follow-up tasks/calendar events.
- Be direct, take action, report results. No fluff.`;

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
      message: "Add your Anthropic API key to .env.local to enable the Operator. Get one at console.anthropic.com",
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
              model: "claude-sonnet-4-6",
              max_tokens: 4096,
              system: systemPrompt,
              tools: TOOLS,
              messages: currentMessages,
              stream: true,
            }),
          });

          if (!apiResponse.ok) {
            // Retry once on rate limit (429) after a short pause
            if (apiResponse.status === 429 && i < maxIterations - 1) {
              const retryAfter = apiResponse.headers.get("retry-after");
              const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
              send({ type: "text", delta: "\n_Rate limited — retrying in a moment..._\n" });
              await new Promise(r => setTimeout(r, Math.min(wait, 10000)));
              continue;
            }
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

                // Emit navigation event before executing
                if (block.name === "navigate_to" && block.input?.path) {
                  send({ type: "navigate", path: block.input.path });
                }

                let result = await handleToolCall("operator", block.name, block.input);

                // Truncate large tool results to avoid blowing rate limits
                const resultStr = typeof result === "string" ? result : JSON.stringify(result);
                const truncated = resultStr.length > 8000
                  ? resultStr.slice(0, 8000) + "\n...(truncated — " + resultStr.length + " chars total. Query with narrower filters if you need more.)"
                  : resultStr;

                send({ type: "tool_done", name: block.name });
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: truncated,
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
