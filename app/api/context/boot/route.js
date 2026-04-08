import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// GET /api/context/boot — structured briefing by category
// Used by boot sequences to surface decisions, open items, and active context
export async function GET() {
  const sb = getAdmin();

  const { data, error } = await sb
    .from('context_log')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Group by category
  const grouped = {
    decisions: [],
    open_items: [],
    actions: [],
    context: [],
    other: [],
  };

  for (const row of data) {
    switch (row.category) {
      case 'decision':
        grouped.decisions.push(row);
        break;
      case 'open_item':
        grouped.open_items.push(row);
        break;
      case 'action':
        grouped.actions.push(row);
        break;
      case 'context':
        grouped.context.push(row);
        break;
      default:
        grouped.other.push(row);
    }
  }

  // Group open items by project
  const open_by_project = {};
  for (const item of grouped.open_items) {
    const proj = item.related_project || 'general';
    if (!open_by_project[proj]) open_by_project[proj] = [];
    open_by_project[proj].push(item.summary);
  }

  return Response.json({
    generated_at: new Date().toISOString(),
    total_active: data.length,
    summary: {
      decisions: grouped.decisions.length,
      open_items: grouped.open_items.length,
      active_actions: grouped.actions.length,
      context_entries: grouped.context.length,
    },
    open_items_by_project: open_by_project,
    decisions: grouped.decisions.map((r) => ({
      id: r.id,
      summary: r.summary,
      project: r.related_project,
      details: r.details,
    })),
    open_items: grouped.open_items.map((r) => ({
      id: r.id,
      summary: r.summary,
      project: r.related_project,
      contacts: r.related_contacts,
    })),
    active_actions: grouped.actions.map((r) => ({
      id: r.id,
      summary: r.summary,
      project: r.related_project,
      details: r.details,
    })),
    context: grouped.context.map((r) => ({
      id: r.id,
      summary: r.summary,
      project: r.related_project,
    })),
  });
}
