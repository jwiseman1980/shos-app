import { getAnniversariesByMonth, getAnniversariesThisMonth } from '@/lib/data/heroes';

function checkApiKey(request) {
  const apiKey = request.headers.get('x-api-key');
  const expected = process.env.SHOS_API_KEY;
  if (!expected) return true;
  return apiKey === expected;
}

export async function GET(request) {
  if (!checkApiKey(request)) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');

  try {
    const heroes = month
      ? await getAnniversariesByMonth(parseInt(month))
      : await getAnniversariesThisMonth();

    return Response.json({
      success: true,
      month: month || new Date().getMonth() + 1,
      count: heroes.length,
      data: heroes,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
