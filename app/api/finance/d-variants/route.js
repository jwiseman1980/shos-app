import { NextResponse } from "next/server";
import { getDVariantDonors } from "@/lib/data/obligations";
import { getCurrentYear } from "@/lib/dates";

/**
 * GET /api/finance/d-variants?year=2026
 * Returns D-variant donors grouped by email — people who paid the extra $10
 * to Steel Hearts Fund via the D-variant product option.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year")) || getCurrentYear();

    const donors = await getDVariantDonors(year);

    const totalContribution = donors.reduce((s, d) => s + d.totalContribution, 0);
    const totalPurchases = donors.reduce((s, d) => s + d.purchases, 0);

    return NextResponse.json({
      success: true,
      year,
      donorCount: donors.length,
      totalContribution,
      totalPurchases,
      donors,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
