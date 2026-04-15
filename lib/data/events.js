import { getServerClient } from "@/lib/supabase";

export async function getEvents() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getEventById(id) {
  const sb = getServerClient();
  const [eventRes, tasksRes, sponsorsRes, budgetRes] = await Promise.all([
    sb.from("events").select("*").eq("id", id).single(),
    sb.from("event_tasks").select("*").eq("event_id", id).order("sort_order"),
    sb.from("event_sponsors").select("*").eq("event_id", id).order("amount_pledged", { ascending: false }),
    sb.from("event_budget_items").select("*").eq("event_id", id).order("category"),
  ]);
  if (eventRes.error) throw new Error(eventRes.error.message);
  return {
    event: eventRes.data,
    tasks: tasksRes.data || [],
    sponsors: sponsorsRes.data || [],
    budgetItems: budgetRes.data || [],
  };
}

export async function createEvent(data) {
  const sb = getServerClient();
  const { data: created, error } = await sb
    .from("events")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return created;
}

export async function updateEvent(id, data) {
  const sb = getServerClient();
  const { data: updated, error } = await sb
    .from("events")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return updated;
}

export async function addEventTask(eventId, task) {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("event_tasks")
    .insert({ event_id: eventId, ...task })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function toggleEventTask(taskId, completed) {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("event_tasks")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", taskId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function addEventSponsor(eventId, sponsor) {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("event_sponsors")
    .insert({ event_id: eventId, ...sponsor })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function addBudgetItem(eventId, item) {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("event_budget_items")
    .insert({ event_id: eventId, ...item })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getEventStats() {
  const sb = getServerClient();
  const { data, error } = await sb.from("events").select("status, revenue_actual, revenue_expected");
  if (error) return { total: 0, active: 0, totalRevenue: 0, totalExpected: 0 };
  const events = data || [];
  return {
    total: events.length,
    active: events.filter(e => e.status === "active" || e.status === "planning").length,
    totalRevenue: events.reduce((s, e) => s + (e.revenue_actual || 0), 0),
    totalExpected: events.reduce((s, e) => s + (e.revenue_expected || 0), 0),
  };
}
