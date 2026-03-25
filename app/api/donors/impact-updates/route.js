import { NextResponse } from "next/server";
import { getDonationsNeedingImpactUpdate } from "@/lib/data/donations";

/**
 * GET /api/donors/impact-updates
 * Returns donations that are due for a Day 30 impact update.
 * Criteria: thank-you sent, impact update NOT sent, donation 25-45 days ago.
 */
export async function GET() {
  try {
    const donations = await getDonationsNeedingImpactUpdate();

    return NextResponse.json({
      success: true,
      count: donations.length,
      donations: donations.map((d) => ({
        sfId: d.sfId,
        donorName: d.donorName,
        donorEmail: d.donorEmail,
        amount: d.amount,
        donationDate: d.donationDate,
        daysSince: Math.floor(
          (new Date() - new Date(d.donationDate)) / (1000 * 60 * 60 * 24)
        ),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
