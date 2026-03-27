import { NextResponse } from "next/server";
import { getDonationsByMonth, getDonationStats, createDonation } from "@/lib/data/donations";

/**
 * GET /api/finance/donations-received?month=3&year=2026
 * Returns donations received for a given month/year.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));

    if (!month || !year) {
      return NextResponse.json(
        { success: false, error: "month and year are required" },
        { status: 400 }
      );
    }

    const [donations, stats] = await Promise.all([
      getDonationsByMonth(month, year),
      getDonationStats(),
    ]);

    const monthTotal = donations.reduce((s, d) => s + d.amount, 0);

    return NextResponse.json({
      success: true,
      month,
      year,
      count: donations.length,
      total: monthTotal,
      stats,
      donations,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/finance/donations-received
 * Create a new Donation__c record (manual entry).
 */
export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.amount || !body.donationDate) {
      return NextResponse.json(
        { success: false, error: "amount and donationDate are required" },
        { status: 400 }
      );
    }

    const result = await createDonation(body);
    return NextResponse.json(result, { status: result.success ? 201 : 500 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
