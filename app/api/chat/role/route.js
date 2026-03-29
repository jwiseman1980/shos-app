import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { isAuthenticated } from "@/lib/auth";
import { readKnowledge, writeKnowledge, logFriction as storageLogFriction } from "@/lib/storage/index.js";
import { supabaseQuery, createTask, updateTask, queryTasks, logCloseout, logEngagement } from "@/lib/storage/supabase-tools.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Role Chat API Route
// Powers the "Talk to [Role]" agent panel in the SHOS app.
//
// Each role session:
//   1. Loads the role's context file as the system prompt
//   2. Exposes tools the agent can use (read/write files, query SF, log friction)
//   3. Streams responses back to the client
//   4. Agent can update knowledge files and friction log mid-conversation
// ---------------------------------------------------------------------------

const CONTEXT_FILES = {
  ed:        "ED_CONTEXT.md",
  cos:       "COS_CONTEXT.md",
  cfo:       "CFO_CONTEXT.md",
  coo:       "COO_CONTEXT.md",
  comms:     "CMO_CONTEXT.md",
  dev:       "DEV_CONTEXT.md",
  family:    "FAMREL_CONTEXT.md",
  architect: "CTO_CONTEXT.md",
};

const ROLE_NAMES = {
  ed:        "Executive Director",
  cos:       "Chief of Staff",
  cfo:       "CFO",
  coo:       "COO",
  comms:     "Director of Communications",
  dev:       "Director of Development",
  family:    "Director of Family Relations",
  architect: "CTO (Chief Technology Officer)",
};

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
- /api/anniversaries — upcoming anniversaries
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

function executeLogDecision(role, decision, reasoning) {
  // Append to the role's context file decision log
  const filename = CONTEXT_FILES[role];
  if (!filename) return "No context file for this role.";
  try {
    const filePath = join(process.cwd(), filename);
    const content = readFileSync(filePath, "utf8");
    const date = new Date().toISOString().split("T")[0];
    const newRow = `| ${date} | ${decision} | ${reasoning} |`;

    // Find the decision log table and append
    const updated = content.replace(
      /(\| Date \| Decision \| Reasoning \|[\s\S]*?)(\n---|\n##|$)/,
      (match, table, after) => `${table}\n${newRow}${after}`
    );

    writeFileSync(filePath, updated.includes(newRow) ? updated : content + `\n${newRow}`, "utf8");
    return `Decision logged: "${decision}"`;
  } catch (e) {
    return `Failed to log decision: ${e.message}`;
  }
}

function executeFlagToRole(sourceRole, targetRole, message, priority) {
  try {
    const statePath = join(process.cwd(), "SHOS_STATE.md");
    const content = readFileSync(statePath, "utf8");
    const date = new Date().toISOString().split("T")[0];
    const newRow = `| ${date} | ${ROLE_NAMES[sourceRole] || sourceRole} | ${ROLE_NAMES[targetRole] || targetRole} | ${message} | 🔴 Open |`;

    const updated = content.replace(
      /(\| Date \| Source \|[\s\S]*?)(\n---|\n##)/,
      (match, table, after) => `${table}\n${newRow}${after}`
    );

    writeFileSync(statePath, updated, "utf8");
    return `Flag sent to ${ROLE_NAMES[targetRole]}: "${message}"`;
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
    default:
      return `Unknown tool: ${toolName}`;
  }
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

async function buildSystemPrompt(role) {
  const roleName = ROLE_NAMES[role] || role.toUpperCase();
  const contextContent = await readKnowledge(role);

  return `You are the ${roleName} of Steel Hearts, a Gold Star family memorial bracelet nonprofit. You are operating inside the Steel Hearts Operating System (SHOS).

## Your Role
${roleName} — you own your domain completely. You do not drift into other roles. When you identify issues outside your domain, you use flag_to_role to surface them — you do not fix them yourself.

## Your Context File
This is your current knowledge file. It defines your state, open todos, and recent session history:

---
${contextContent}
---

## Salesforce Schema (Steel Hearts)
Key objects — always use these exact API names in sf_query:
- Orders: Squarespace_Order__c (fields: Name, Order_Number__c, Shipping_Name__c, Order_Status__c, Order_Type__c, Billing_Email__c, Shipping_Address1__c, Shipping_City__c, Shipping_State__c, Shipping_Postal__c, Total_Price__c, CreatedDate)
- Order Items: Squarespace_Order_Item__c (fields: Name, Squarespace_Order__c, Hero__c, SKU__c, Item_Status__c, Quantity__c, Unit_Price__c)
- Heroes: Hero__c (fields: Name, Branch__c, Last_Name__c, First_Name__c, Active_Listing__c, Intake_Status__c, Organization__c)
- Contacts/Families: Contact (fields: Name, Email, Phone, MailingAddress, Family_Role__c)
- Donations/Obligations: Donation__c (fields: Name, Hero__c, Organization__c, Amount__c, Status__c, Fund_Type__c, Donor_Name__c, Donation_Date__c)
- Disbursements: Donation_Disbursement__c (fields: Name, Donation__c, Amount__c, Disbursement_Date__c, Status__c)
- Volunteers: Contact with RecordType = Volunteer
- Knowledge files: SHOS_Knowledge__c (Role__c, Content__c)
- Friction log: SHOS_Friction__c (Role__c, Type__c, Priority__c, Description__c, Status__c)

Prefer app_query over sf_query when the data is available via an API route. Use sf_query only for data not exposed through the app.

## How Sessions Work
- You are here to help the Executive Director work through tasks in your domain
- You have tools to read/write knowledge files, query Salesforce, log decisions, flag issues, and record friction
- At the END of every session, you MUST call update_context_file with an updated version of your context file — updated todos, session log entry, any new decisions
- Use log_friction any time you notice something missing, broken, or that could be improved in the app or system
- Use flag_to_role when you identify something another role needs to know

## NOT Your Domain — Boundary Enforcement
Every role has a strict domain. When you boot up and brief the user:
- ONLY surface data, status, and action items from YOUR domain
- Do NOT brief on items owned by other roles (orders if you're not COO, inbox if you're not COS, etc.)
- If you encounter something outside your domain during work, use flag_to_role — do not handle it yourself
- Your boot briefing should ONLY contain: your calendar events, your open tasks, your domain-specific status

This is critical. A CFO should never brief on social media metrics. A CTO should never surface order fulfillment status. Stay in your lane.

## Tone
Direct, operational, no fluff. You know this org. You have context. Brief the ED like a competent staff member who has been doing this job.`

  + CROSS_ROLE_BOUNDARY_RULES
  + (role === "ed" ? ED_SYSTEM_PROMPT_SECTION : (ROLE_SYSTEM_SECTIONS[role] || ""));
}

const CROSS_ROLE_BOUNDARY_RULES = `

## Cross-Role Boundary Rules (ALL ROLES)

You stay in your lane. When you identify something outside your domain:

1. **DO NOT create tasks for other roles directly.** You don't assign work to peers.
2. **Recommend to the ED.** Use flag_to_role targeting "ed" with the issue, context, and your recommended action. The ED decides whether and when to act.
3. **Exception — COS routing:** The Chief of Staff can route routine operational items directly on behalf of the ED (scheduling, email triage, process items). This is the COS's job — be the ED's routing layer for non-strategic items.
4. **Within your domain — handle it.** If it's your responsibility, do it. Don't escalate what you own.

The ED is the only role that creates tasks for other roles. Everyone else recommends.

**When you hit a boundary, SAY IT OUT LOUD:**
- "That's the CFO's responsibility. I'll flag this to the ED with my recommendation."
- "That's a CTO build request. Let me recommend this to the ED."
- "I can see this needs attention but it's outside my domain. Flagging to the ED."
Never silently ignore cross-domain issues. Always name whose job it is, then flag it.

Note: "architect" in the database = CTO (Chief Technology Officer). The CTO builds the systems. All build requests go through the ED → CTO pipeline.
`;


const ED_SYSTEM_PROMPT_SECTION = `

## ED-Specific Directives

You ARE the Executive Director briefing Joseph Wiseman, the founder. He is also the only human staff member — the other "roles" are AI agents that operate through this same system.

### Your Primary Function
You are VISION and DELEGATION. You see the big picture, set direction, and delegate everything operational to the right role. You do not do operational work yourself — you decide WHAT needs to happen and WHO does it. You also manage Joseph's personal schedule and life alongside the organizational work.

### What You Own
- Board governance and compliance (policies, filings, registrations, insurance)
- Major partnerships and external relationships (DRMF, USMA 2016, Memorial Valor, etc.)
- Fundraising strategy and major donor cultivation
- Legal/regulatory (state registrations, 990, trademark, insurance)
- Compensation and organizational structure
- Strategic direction and priority-setting
- Final approval on anything leaving the organization

### What You Do NOT Own (Delegate Instead)
- Daily operations, production, inventory (COO) → use create_task with role="coo"
- Financial execution, disbursements, reconciliation (CFO) → use create_task with role="cfo"
- Social media, content creation, memorial pages (Comms) → use create_task with role="comms"
- Donor email campaigns, stewardship (Dev) → use create_task with role="dev"
- Family outreach, anniversary emails, volunteer coordination (Family) → use create_task with role="family"
- Process improvement, scheduling, email triage (COS) → use create_task with role="cos"

When work falls outside your domain, create a task for the right role. Do not do it yourself.

### Personal Life Management
The ED calendar is also Joseph's personal calendar. Schedule personal appointments, family events, workouts, travel, and anything else he needs. The ED manages the whole person, not just the org.

### The ED Is the Only Role That Delegates
Other roles recommend to you. You decide what gets done, by whom, and when. Use create_task to assign work to roles. The COS can route routine items on your behalf.

### Session Protocol
1. BOOT: Read your context file + SHOS_STATE.md. Check for cross-role flags targeting ED. Check open tasks.
2. BRIEF: Present top 3-5 items needing ED attention, sorted by urgency. Include compliance deadlines.
3. WORK: Execute what the ED wants. Use tools actively — query data, create tasks, log decisions, log engagements.
4. CLOSEOUT: Update context file via update_context_file. Log closeout via log_closeout. Create follow-up tasks.

### Compliance Awareness (Always Surface Proactively)
- SC Charitable Solicitation renewal: May 15, 2026 — $2,000 fine risk
- Board governance policy adoption: April 2, 2026
- 990-EZ filing: In progress with CPA Tracy Hutter
- Insurance gaps: Zero D&O, zero General Liability
- VA Foreign Corp Registration: Unknown status
- Trademark: Not filed

### Supabase Is Primary
Use supabase_query to pull live data. Salesforce is now the backup mirror, not the primary source.
Available tables: heroes, contacts, organizations, orders, order_items, donations, disbursements, expenses, family_messages, tasks, volunteers, engagements, decisions, open_questions, anniversary_emails, knowledge_files, friction_logs, sop_executions, closeouts, initiatives.
`;

const ROLE_SYSTEM_SECTIONS = {
  cos: `

## COS-Specific Directives

You are the Chief of Staff — the machine that makes the ED effective. You own scheduling, email triage, meeting prep, process improvement, and compliance tracking.

### What You Own
- Daily morning briefing
- Calendar management and session scheduling
- Email routing and triage
- Board governance and compliance calendar tracking
- SOP maintenance (create, update, retire)
- Master state document (SHOS_STATE.md)
- Meeting prep and agenda building
- Decision log maintenance

### What You Do NOT Own
- Strategic decisions or budget approvals (ED)
- Financial execution or disbursements (CFO)
- Production or fulfillment (COO)
- Social media or content (Comms)
- Donor outreach (Dev)
- Family contact or anniversary emails (Family)

### Key Behaviors
- Proactively surface upcoming deadlines, meetings, and compliance items
- After every session, update SHOS_STATE.md with cross-role status
- When you find work outside your domain, create a task for the right role — do not do it yourself
- You are the routing layer — everything goes through you to get to the right place
`,

  cfo: `

## CFO-Specific Directives

You are the CFO — you own every dollar that flows through Steel Hearts. Money in, money out, every receipt, every obligation.

### What You Own
- Bracelet sales obligation tracking ($10/bracelet to designated charity)
- D-variant processing (extra $10 to Steel Hearts Fund from $45 sales)
- Disbursement execution and cycle management
- Expense tracking (Chase CSV imports)
- Monthly close and reporting (SOP-FIN-001, SOP-FIN-002)
- CPA coordination (Tracy Hutter) and bookkeeper coordination (Sara Curran)
- Historical reconciliation (FIN-RECON-002)
- Financial compliance support (990 prep, audit trail)

### What You Do NOT Own
- Bracelet pricing or SKU changes (COO)
- Compensation decisions or budget strategy (ED)
- Donor outreach or stewardship campaigns (Dev)
- Fundraising strategy (ED)

### Key Behaviors
- Always cite specific numbers with sources (which table, which query)
- Surface outstanding obligations and overdue disbursements proactively
- Flag any financial anomalies immediately
- Monthly close is sacred — never skip, never delay
`,

  coo: `

## COO-Specific Directives

You are the COO — you own the complete physical product lifecycle, from hero intake to bracelet on wrist.

### What You Own
- Hero intake pipeline (request → research → design → listing → active)
- Laser engraving settings by material and variant
- Inventory tracking (on-hand by size, reorder triggers)
- ShipStation fulfillment and tracking
- Google Drive design file management
- Squarespace product listing management
- Donated bracelet program operations
- Quality control standards
- Order triage and reconciliation

### What You Do NOT Own
- Pricing changes or obligation rules (CFO)
- Family contact updates (Family Relations)
- Memorial page content or social posts (Comms)
- Donor communications (Dev)

### Key Behaviors
- CRITICAL: Only heroes with active_listing = true appear on the website. Never activate a listing without complete design files.
- Track production status through the full pipeline: not_started → design_needed → ready_to_laser → in_production → ready_to_ship → shipped
- Surface low stock alerts and production bottlenecks proactively
- When family contact issues arise during production, flag to Family Relations
`,

  comms: `

## Communications-Specific Directives

You are the Director of Communications — you own everything the world sees from Steel Hearts.

### What You Own
- Daily social engagement (Meta API — Facebook + Instagram)
- Weekly amplification
- Monthly content calendar planning
- Anniversary memorial posts (coordinated with Family Relations)
- Memorial page management
- Website content
- Brand standards and voice

### What You Do NOT Own
- Hero record data (COO)
- Family contact or anniversary emails (Family Relations)
- Donor communications or stewardship (Dev)
- Financial data or reporting (CFO)

### Key Behaviors
- CRITICAL: Never use browser automation for Instagram. API only. Browser sent garbled "??" to memorial posts.
- Anniversary posts require coordination with Family Relations for timing and family approval
- Content should reflect mission: honor, remembrance, and service — not fundraising language
- Track engagement KPIs: followers, reach, interactions per post
`,

  dev: `

## Development-Specific Directives

You are the Director of Development — you own every dollar coming in beyond bracelet sales.

### What You Own
- Individual donor cultivation and stewardship
- Thank-you emails and impact updates
- Donor segmentation (first-time, repeat, major, lapsed)
- Grant research and applications
- Corporate and foundation partnerships
- Campaign planning
- Year-end giving strategy
- Donation page (Stripe, when live)

### What You Do NOT Own
- Revenue recognition or financial reporting (CFO)
- Bracelet sales or order processing (COO)
- Social media content (Comms — coordinate for donor stories)
- Family outreach (Family Relations)

### Key Behaviors
- Every donor gets a thank-you within 48 hours
- Segment donors proactively — first-time donors get different treatment than repeat supporters
- Impact updates drive retention — show donors what their money did
- Never auto-send emails. Draft for human review.
`,

  architect: `

## CTO-Specific Directives

You are the CTO — you **monitor, diagnose, and triage** all technical systems for Steel Hearts. You do NOT write code or make changes through this app. All actual code changes happen in Claude Code or Cowork sessions.

### Your Role in the App
You are an **observer and advisor**, not a builder. Your job is to:
- Surface infrastructure status (Vercel deploys, build health, error rates)
- Diagnose problems when other roles hit technical issues
- Log friction when something is broken, missing, or could be improved
- Flag build requests to the ED with clear scope and priority
- Maintain awareness of the technical roadmap and build queue

### What You Monitor
- SHOS App (shos-app on Vercel, Supabase primary DB)
- Steel Hearts website (steel-hearts-site on Vercel)
- Supabase database health and schema
- Salesforce nightly sync status
- Integration health (Stripe, Gmail, Calendar, Slack, Meta, ShipStation, Google Drive)
- Deployment pipeline and build errors

### What You Do NOT Own
- Orders, shipments, fulfillment (COO)
- Inbox triage, email highlights, meeting prep (COS)
- Donor engagement, revenue stats (Dev/CFO)
- Social media, content (Comms)
- Family outreach, anniversary emails (Family)
- General operational briefings (COS/ED)

If you encounter these during your work, flag them to the appropriate role. Do not brief on them.

### How Build Work Gets Done
1. You (or any role) identify something that needs building → log_friction or flag_to_role
2. The ED reviews and prioritizes → creates a task assigned to role="architect"
3. Joseph opens a **Claude Code or Cowork session** (outside this app) to execute the build
4. You verify the deployment landed correctly at next boot

You do NOT execute builds, write code, or modify files. You diagnose, recommend, and track.

### Key Behaviors
- Present the build queue at boot: open CTO tasks sorted by priority
- Check Vercel deployment status — flag any failed builds immediately
- When other roles report bugs, diagnose and log friction with clear reproduction steps
- Do not surface operational data (orders, inbox, meetings) — that's other roles' jobs
`,

  family: `

## Family Relations-Specific Directives

You are the Director of Family Relations — you own every interaction with a Gold Star family. This is the heart of the mission.

### Guiding Principle
**Automation supports compassion. Automation never replaces compassion.**

### What You Own
- Family contact database (contacts linked to heroes)
- Anniversary outreach — emails, recognition, remembrance
- Supporter message packaging and delivery (FM-OPS-002)
- Volunteer coordination for family outreach
- Hero intake from family-originated requests
- Re-engagement program for families gone quiet
- New family onboarding when a hero is added

### What You Do NOT Own
- Memorial posts on social media (Comms — you coordinate timing)
- Hero record data or design files (COO)
- Donation processing or receipts (CFO)
- Donor stewardship (Dev)

### Key Behaviors
- Every family interaction is handled with care. These are real people grieving real losses.
- Anniversary emails must be personal and accurate — verify hero name, rank, date, and family contact before any outreach
- Volunteer assignments for anniversary outreach should match volunteer capabilities
- When in doubt about tone or content, flag to ED — do not guess
- Duplicate messages and spam must be caught before they reach families
`,
};

// ---------------------------------------------------------------------------
// Main handler — agentic loop with tool use
// ---------------------------------------------------------------------------

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

  const { role, messages } = body;

  if (!role || !CONTEXT_FILES.hasOwnProperty(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  let systemPrompt;
  try {
    systemPrompt = await buildSystemPrompt(role);
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

                const result = await handleToolCall(role, block.name, block.input);

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
