import { getServerClient } from "@/lib/supabase";
import { isAuthenticated, getSessionUser } from "@/lib/auth";
import { sendSlackDm, buildTaskAssignedMessage } from "@/lib/slack-actions";

export const dynamic = "force-dynamic";

async function checkAuth(request) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey === process.env.SHOS_API_KEY) return true;
  return await isAuthenticated();
}

export async function PATCH(request, { params }) {
  if (!(await checkAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json();

  const supabase = getServerClient();

  // Load existing task to detect assignment changes
  const { data: existing } = await supabase
    .from("tasks")
    .select("id, title, description, priority, role, due_date, assigned_to, status")
    .eq("id", id)
    .single();

  const updates = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.due_date !== undefined) updates.due_date = body.due_date;
  if (body.status === "done") updates.completed_at = new Date().toISOString();

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select("id, title, status, priority")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // --- Slack DM on assignment change ---
  // Fires when assigned_to is set or changed (including initial assignment).
  const newAssignee = updates.assigned_to;
  const oldAssignee = existing?.assigned_to;
  if (newAssignee && newAssignee !== oldAssignee) {
    try {
      // Resolve assignee email — assigned_to may be a user id, name, or email
      let email = null;
      if (typeof newAssignee === "string" && newAssignee.includes("@")) {
        email = newAssignee;
      } else {
        // Try users table by id
        const { data: u } = await supabase
          .from("users")
          .select("email")
          .or(`id.eq.${newAssignee},name.ilike.${newAssignee}`)
          .limit(1)
          .single();
        email = u?.email || null;
        // Last fallback: volunteers.json by name
        if (!email) {
          try {
            const { default: vols } = await import("@/data/volunteers.json");
            const vol = vols.find(
              (v) => v.name.toLowerCase() === String(newAssignee).toLowerCase()
            );
            email = vol?.email || null;
          } catch {}
        }
      }

      if (email) {
        const assigner = await getSessionUser().catch(() => null);
        const taskFull = { ...existing, ...updates, id };
        const msg = buildTaskAssignedMessage({
          taskId: id,
          title: taskFull.title,
          description: taskFull.description,
          priority: taskFull.priority,
          dueDate: taskFull.due_date,
          role: taskFull.role,
          assignerName: assigner?.name || null,
        });
        await sendSlackDm(email, msg);
      }
    } catch (err) {
      console.warn("[tasks PATCH] Slack DM failed:", err.message);
    }
  }

  return Response.json({ task: data });
}

export async function DELETE(request, { params }) {
  if (!(await checkAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const supabase = getServerClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
