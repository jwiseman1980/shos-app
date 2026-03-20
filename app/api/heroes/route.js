import { getHeroes, getHeroStats, getAnniversariesByMonth } from '@/lib/data/heroes';

function checkApiKey(request) {
  const apiKey = request.headers.get('x-api-key');
  const expected = process.env.SHOS_API_KEY;
  if (!expected) return true; // No key configured = allow (dev mode)
  return apiKey === expected;
}

export async function GET(request) {
  if (!checkApiKey(request)) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  try {
    if (action === 'stats') {
      const stats = await getHeroStats();
      return Response.json({ success: true, data: stats });
    }

    if (action === 'anniversaries') {
      const month = parseInt(searchParams.get('month') || new Date().getMonth() + 1);
      const heroes = await getAnniversariesByMonth(month);
      return Response.json({ success: true, count: heroes.length, data: heroes });
    }

    // Default: list all heroes
    const heroes = await getHeroes();
    return Response.json({ success: true, count: heroes.length, data: heroes });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
