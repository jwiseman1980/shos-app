import { readFileSync } from "fs";
import { join } from "path";
import { isAuthenticated } from "@/lib/auth";
import { readKnowledge, writeKnowledge, logFriction as storageLogFriction } from "@/lib/storage/index.js";

export const dynamic = "force-dynamic";

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
  ed:     null,              // ED has no separate context file — uses SHOS_STATE.md
  cos:    "COS_CONTEXT.md",
  cfo:    "CFO_CONTEXT.md",
  coo:    "COO_CONTEXT.md",
  comms:  "CMO_CONTEXT.md",
  dev:    "DEV_CONTEXT.md",
  family: "FAMREL_CONTEXT.md",
};

const ROLE_NAMES = {
  ed:     "Executive Director",
  cos:    "Chief of Staff",
  cfo:    "CFO",
  coo:    "COO",
  comms:  "Director of Communications",
  dev:    "Director of Development",
  family: "Director of Family Relations",
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
          enum: ["cos", "cfo", "coo", "comms", "dev", "family"],
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
          enum: ["ed", "cos", "cfo", "coo", "comms", "dev", "family"],
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
    // Build base URL — works on Vercel and locally
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

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

## How Sessions Work
- You are here to help the Executive Director work through tasks in your domain
- You have tools to read/write knowledge files, query Salesforce, log decisions, flag issues, and record friction
- At the END of every session, you MUST call update_context_file with an updated version of your context file — updated todos, session log entry, any new decisions
- Use log_friction any time you notice something missing, broken, or that could be improved in the app or system
- Use flag_to_role when you identify something another role needs to know

## Tone
Direct, operational, no fluff. You know this org. You have context. Brief the ED like a competent staff member who has been doing this job.`;
}

// ---------------------------------------------------------------------------
// Main handler — agentic loop with tool use
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

  const { role, messages } = await request.json();

  if (!role || !CONTEXT_FILES.hasOwnProperty(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  const systemPrompt = await buildSystemPrompt(role);

  // Agentic loop — keep going until we get a final text response (no more tool calls)
  let currentMessages = [...messages];
  let finalResponse = null;
  let toolsUsed = [];
  const maxIterations = 10; // safety limit

  for (let i = 0; i < maxIterations; i++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOLS,
        messages: currentMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return Response.json({ error: `Claude API error: ${err}` }, { status: 500 });
    }

    const result = await response.json();

    // If stop_reason is end_turn with no tool_use — we're done
    if (result.stop_reason === "end_turn") {
      const textBlock = result.content.find((b) => b.type === "text");
      finalResponse = textBlock?.text || "";
      break;
    }

    // If stop_reason is tool_use — execute tools and continue
    if (result.stop_reason === "tool_use") {
      // Add the assistant's message with tool calls to history
      currentMessages.push({ role: "assistant", content: result.content });

      // Execute each tool call
      const toolResults = [];
      for (const block of result.content) {
        if (block.type === "tool_use") {
          toolsUsed.push(block.name);
          const toolResult = await handleToolCall(role, block.name, block.input);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: toolResult,
          });
        }
      }

      // Add tool results to history and loop
      currentMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason
    finalResponse = result.content.find((b) => b.type === "text")?.text || "";
    break;
  }

  return Response.json({
    response: finalResponse,
    toolsUsed: [...new Set(toolsUsed)],
    role,
  });
}
