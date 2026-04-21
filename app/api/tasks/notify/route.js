/**
 * POST /api/tasks/notify
 *
 * Sends Slack DM + email to a task's assignee.
 * Called by the Operator after creating or updating a task with assignment.
 *
 * Body: { task_id, message? }
 *   task_id  — UUID of the task (looks up assignee from tasks.assigned_to → users)
 *   message  — optional override message (uses generated message if omitted)
 */

import { getServerClient } from "@/lib/supabase";
import { sendSlackDm } from "@/lib/slack-actions";
import { sendGmailMessage } from "@/lib/gmail";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function checkAuth(request) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey === process.env.SHOS_API_KEY) return true;
  return await isAuthenticated();
}

const PRIORITY_EMOJI = { critical: "🔴", high: "🟠", medium: "🟡", low: "⚪" };

export async function POST(request) {
  if (!(await checkAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { task_id, message: customMessage } = body;
  if (!task_id) {
    return Response.json({ error: "task_id required" }, { status: 400 });
  }

  const sb = getServerClient();

  // Fetch task + assignee in one query
  const { data: task, error: taskErr } = await sb
    .from("tasks")
    .select(`
      id, title, description, priority, due_date, status, source_type, source_id,
      users!tasks_assigned_to_fkey ( id, name, email )
    `)
    .eq("id", task_id)
    .single();

  if (taskErr || !task) {
    return Response.json({ error: `Task not found: ${taskErr?.message || "unknown"}` }, { status: 404 });
  }

  const assignee = task.users;
  if (!assignee?.email) {
    return Response.json({ error: "Task has no assignee with an email address" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://shos-app.vercel.app";
  const firstName = assignee.name?.split(" ")[0] || "there";
  const dueStr = task.due_date
    ? ` · Due ${new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "";
  const priorityEmoji = PRIORITY_EMOJI[task.priority] || "•";
  const sourceNote = task.source_type ? `\nSource: ${task.source_type}${task.source_id ? ` (${task.source_id})` : ""}` : "";

  const slackText = customMessage || [
    `${priorityEmoji} *Task assigned by Joseph:* ${task.title}${dueStr}`,
    task.description || "",
    `Priority: ${task.priority || "medium"}${sourceNote}`,
    ``,
    `<${appUrl}/tasks|View in SHOS>`,
  ].filter(Boolean).join("\n");

  const emailBody = customMessage || [
    `Hi ${firstName},`,
    ``,
    `Joseph has assigned you a task in SHOS:`,
    ``,
    `Task: ${task.title}`,
    task.description ? `Details: ${task.description}` : "",
    `Priority: ${task.priority || "medium"}`,
    task.due_date
      ? `Due: ${new Date(task.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
      : "",
    ``,
    `Log in to review and update your tasks: ${appUrl}/tasks`,
    ``,
    `-- Joseph Wiseman, Steel Hearts`,
  ].filter(Boolean).join("\n");

  const results = { slack: false, email: false, assignee: assignee.email };

  // Slack DM
  try {
    results.slack = await sendSlackDm(assignee.email, slackText);
  } catch (e) {
    console.warn("[tasks/notify] Slack DM failed:", e.message);
  }

  // Email notification
  try {
    await sendGmailMessage({
      senderEmail: "joseph.wiseman@steel-hearts.org",
      senderName: "Joseph Wiseman",
      to: assignee.email,
      subject: `Task assigned: ${task.title}`,
      body: emailBody,
    });
    results.email = true;
  } catch (e) {
    console.warn("[tasks/notify] Email notification failed:", e.message);
    results.emailError = e.message;
  }

  const channels = [results.slack && "Slack", results.email && "email"].filter(Boolean).join(" + ");

  return Response.json({
    ok: results.slack || results.email,
    results,
    message: channels
      ? `Notified ${assignee.name} via ${channels}`
      : `No notifications sent for ${assignee.name} — check SLACK_BOT_TOKEN and Gmail credentials`,
  });
}
