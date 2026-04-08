import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// GET /api/context?category=&status=&project=&source=&limit=
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const project = searchParams.get('project');
  const source = searchParams.get('source');
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  const sb = getAdmin();
  let query = sb
    .from('context_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (category) query = query.eq('category', category);
  if (status) query = query.eq('status', status);
  if (project) query = query.eq('related_project', project);
  if (source) query = query.eq('source', source);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data, count: data.length });
}

// POST /api/context — insert one or many entries
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rows = Array.isArray(body) ? body : [body];
  if (!rows.length) return Response.json({ error: 'No rows provided' }, { status: 400 });

  for (const row of rows) {
    if (!row.source || !row.category || !row.summary) {
      return Response.json(
        { error: 'Each row requires source, category, and summary' },
        { status: 400 }
      );
    }
  }

  const sb = getAdmin();
  const { data, error } = await sb.from('context_log').insert(rows).select();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data, inserted: data.length }, { status: 201 });
}
