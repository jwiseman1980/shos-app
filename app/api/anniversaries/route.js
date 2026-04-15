import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getAnniversariesByMonth, getAnniversariesThisMonth } from '@/lib/data/heroes';

export async function GET(request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');

  try {
    const heroes = month
      ? await getAnniversariesByMonth(parseInt(month))
      : await getAnniversariesThisMonth();

    return NextResponse.json({
      success: true,
      month: month || new Date().getMonth() + 1,
      count: heroes.length,
      data: heroes,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
