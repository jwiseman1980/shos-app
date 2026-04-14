import { createClient } from '@supabase/supabase-js';
import { getTodayEvents } from '@/lib/calendar';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Role-based field filters
const ROLE_CONFIGS = {
  joseph: {
    // Full view — sees everything
    full: true,
  },
  kristin: {
    // Kristin sees fulfillment + shipping only
    categories: ['open_item', 'action'],
    projects: ['fulfillment', 'shipping', 'shos'],
    tags: ['shipping', 'fulfillment', 'anniversary', 'bracelet'],
    ordersOnly: true,
  },
};

function isKristinRelevant(row) {
  const s = (row.summary || '').toLowerCase();
  const p = (row.related_project || '').toLowerCase();
  const keywords = ['ship', 'fulfil', 'bracelet', 'laser', 'anniv', 'docusign', 'order', 'pack'];
  return keywords.some((k) => s.includes(k) || p.includes(k));
}

// GET /api/context/boot?role=joseph|kristin
// Master feed: context_log + Google Calendar + Squarespace orders
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role') || 'joseph';
  const sb = getAdmin();

  // ── 1. context_log ──────────────────────────────────────────────────────────
  const [activeRes, resolvedRes] = await Promise.all([
    sb
      .from('context_log')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    sb
      .from('context_log')
      .select('id, summary, category, related_project, resolved_at, resolved_by, created_at')
      .eq('status', 'resolved')
      .order('resolved_at', { ascending: false })
      .limit(20),
  ]);

  if (activeRes.error) {
    return Response.json({ error: activeRes.error.message }, { status: 500 });
  }

  let activeItems = activeRes.data || [];
  const resolvedItems = resolvedRes.data || [];

  // Filter for Kristin
  if (role === 'kristin') {
    activeItems = activeItems.filter(isKristinRelevant);
  }

  // ── 2. Google Calendar ───────────────────────────────────────────────────────
  let calendarToday = [];
  try {
    const events = await getTodayEvents();
    calendarToday = events.map((e) => ({
      id: e.id,
      summary: e.summary,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
      calendar: e.role,
      colorId: e.colorId,
    }));
  } catch (calErr) {
    console.error('[boot] Calendar fetch failed:', calErr.message);
    calendarToday = [{ error: 'Calendar unavailable: ' + calErr.message }];
  }

  // ── 3. Squarespace orders ────────────────────────────────────────────────────
  let ordersNew48h = 0;
  let ordersInPipeline = 0;
  let ordersNeedsFulfillment = 0;

  try {
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const [recentRes, pipelineRes, fulfillRes] = await Promise.all([
      sb
        .from('squarespace_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_on', cutoff48h),
      sb
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .not('production_status', 'in', '("shipped","cancelled")'),
      sb
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .eq('production_status', 'ready_to_ship'),
    ]);

    ordersNew48h = recentRes.count ?? 0;
    ordersInPipeline = pipelineRes.count ?? 0;
    ordersNeedsFulfillment = fulfillRes.count ?? 0;
  } catch (ordErr) {
    console.error('[boot] Orders fetch failed:', ordErr.message);
  }

  // ── 4. Group context_log ─────────────────────────────────────────────────────
  const openItems = [];
  const recentDecisions = [];
  const recentActions = [];
  const needsAttention = [];

  for (const row of activeItems) {
    const item = {
      id: row.id,
      summary: row.summary,
      project: row.related_project,
      contacts: row.related_contacts,
      created_at: row.created_at,
      details: row.details,
    };

    if (row.category === 'open_item') {
      openItems.push(item);
      // Flag items older than 7 days as needs_attention
      const ageDays = (Date.now() - new Date(row.created_at)) / 86400000;
      if (ageDays > 7) {
        needsAttention.push({ ...item, reason: `Open for ${Math.floor(ageDays)} days` });
      }
    } else if (row.category === 'decision') {
      recentDecisions.push(item);
    } else if (row.category === 'action') {
      recentActions.push(item);
    }
  }

  // Recent resolved items (last 10 each)
  const recentResolved = resolvedItems.filter((r) => r.category !== 'decision').slice(0, 10);
  const recentResolvedDecisions = resolvedItems.filter((r) => r.category === 'decision').slice(0, 10);

  // ── 5. Build response ────────────────────────────────────────────────────────
  const response = {
    generated_at: new Date().toISOString(),
    user: role,
    needs_attention: needsAttention,
    calendar_today: calendarToday,
    open_items: openItems,
    recent_actions: recentResolved,
    recent_decisions: role === 'joseph' ? recentResolvedDecisions : [],
    active_context: role === 'joseph'
      ? activeItems
          .filter((r) => r.category === 'context')
          .map((r) => ({ id: r.id, summary: r.summary, project: r.related_project }))
      : [],
    orders: {
      new_last_48h: ordersNew48h,
      in_pipeline: ordersInPipeline,
      needs_fulfillment: ordersNeedsFulfillment,
    },
    inbox_summary:
      role === 'joseph'
        ? 'Check email — Gmail integration available at /api/email/inbox'
        : 'Shipping queue at /shipping — check for ready_to_ship orders',
    summary: {
      open_items: openItems.length,
      needs_attention: needsAttention.length,
      calendar_events: calendarToday.filter((e) => !e.error).length,
      active_decisions: recentDecisions.length,
    },
  };

  return Response.json(response);
}
