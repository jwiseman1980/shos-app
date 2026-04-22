/**
 * POST /api/tasks/seed
 * Seeds Joseph's current todo list into the tasks table.
 * Idempotent — checks for existing seed tasks before inserting.
 */

import { getServerClient } from "@/lib/supabase";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SEED_TASKS = [
  {
    title: "Respond to Moffatt family bracelet request",
    description: "Family reached out about a bracelet order. Respond and gather details.",
    priority: "high",
    due_date: "2026-04-21",
    domain: "operations",
  },
  {
    title: "Process Squarespace order #16209",
    description: "Incoming order needs to be processed and entered into the pipeline.",
    priority: "high",
    due_date: "2026-04-21",
    domain: "operations",
  },
  {
    title: "Acknowledge Night Stalker Foundation thank-you",
    description: "Respond to thank-you message from Night Stalker Foundation.",
    priority: "medium",
    due_date: "2026-04-21",
    domain: "comms",
  },
  {
    title: "Laser Terrie's 10 Lawrence bracelets",
    description: "DON-2026-004: 10x USMC-LAWRENCE (5x size 6, 5x size 7). Order is ready_to_laser.",
    priority: "high",
    due_date: "2026-04-21",
    domain: "operations",
  },
  {
    title: "Text Sarah HonorBase link",
    description: "Send Sarah Ross Geisen the HonorBase chat link: honorbase-chat.vercel.app/org/drmf",
    priority: "medium",
    due_date: "2026-04-21",
    domain: "comms",
  },
  {
    title: "Follow up with Haiths on lease",
    description: "Sent lease Apr 18: $3K/mo, Jul 1 2026 start. Waiting on review and pet details.",
    priority: "medium",
    due_date: "2026-04-25",
    domain: "finance",
  },
  {
    title: "Follow up with Ryan on FIRE-ALTMAN design",
    description: "Brief sent Apr 17. Ryan acknowledged. Firefighter Michael 'Mickey' Altman, Chicago FD. No delivery yet.",
    priority: "medium",
    due_date: "2026-04-25",
    domain: "operations",
  },
  {
    title: "Respond to Seb contact form",
    description: "Unanswered contact form. Loosely in contact with a family.",
    priority: "medium",
    due_date: "2026-04-25",
    domain: "comms",
  },
  {
    title: "Navas family anniversary outreach",
    description: "USMC-NAVAS anniversary outreach is overdue. Initiate contact with family.",
    priority: "high",
    due_date: "2026-04-19",
    domain: "comms",
  },
  {
    title: "Anniversary outreach — 15 heroes in next 14 days",
    description: "15 hero anniversaries coming up in the next 14 days. Coordinate outreach with Chris.",
    priority: "medium",
    due_date: "2026-04-25",
    domain: "comms",
  },
  {
    title: "Finish Plaid production application",
    description: "Complete the Plaid production application for GYST banking integration.",
    priority: "medium",
    due_date: "2026-04-25",
    domain: "finance",
  },
  {
    title: "Re-list Cary property",
    description: "Property needs to go back on the market. Coordinate with agent.",
    priority: "high",
    due_date: "2026-04-25",
    domain: "finance",
  },
  {
    title: "Call Chase about Fort Mill escrow",
    description: "Follow up on Fort Mill property escrow situation with Chase bank.",
    priority: "medium",
    due_date: "2026-04-30",
    domain: "finance",
  },
  {
    title: "Carlisle prep before Jul 1",
    description: "Prepare materials and logistics for Carlisle by July 1 deadline.",
    priority: "medium",
    due_date: "2026-04-30",
    domain: "operations",
  },
  {
    title: "TMF Manion order — get Katie approval",
    description: "100-unit Manion Foundation order pending Katie Dobron's design approval at $1,800 total.",
    priority: "medium",
    due_date: "2026-04-30",
    domain: "operations",
  },
  {
    title: "Download MMMM 2026 photos from Drive",
    description: "37 photos from Kristin Hughes shared via Google Drive. Drive API task froze — retry manually.",
    priority: "low",
    due_date: "2026-04-30",
    domain: "comms",
  },
  {
    title: "Create Moffatt family hero record",
    description: "After responding to the Moffatt family inquiry, create their hero record in the system.",
    priority: "medium",
    due_date: "2026-04-25",
    domain: "operations",
  },
];

export async function POST(request) {
  const apiKey = request.headers.get("x-api-key");
  const authed = apiKey === process.env.SHOS_API_KEY || (await isAuthenticated());
  if (!authed) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServerClient();

  // Check if already seeded
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .contains("tags", ["seed:joseph-2026-04"])
    .limit(1);

  if (existing?.length > 0) {
    return Response.json({ message: "Already seeded. Use ?force=true to re-seed.", count: 0 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  if (!force && existing?.length > 0) {
    return Response.json({ message: "Already seeded.", count: 0 });
  }

  const records = SEED_TASKS.map((t) => ({
    ...t,
    status: "todo",
    role: "ed",
    assigned_to: "Joseph Wiseman",
    source_type: "manual",
    tags: ["seed:joseph-2026-04", t.domain],
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase.from("tasks").insert(records).select("id, title");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    message: `Seeded ${data.length} tasks for Joseph.`,
    count: data.length,
    tasks: data.map((t) => t.title),
  });
}
