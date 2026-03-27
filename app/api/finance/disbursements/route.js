import { NextResponse } from "next/server";
import {
  getDisbursements,
  getDisbursementsByMonth,
  createDisbursement,
  updateDisbursement,
} from "@/lib/data/disbursements";

/**
 * GET /api/finance/disbursements?month=2&year=2026
 * Returns disbursement records. If month/year specified, filters to that cycle.
 * Otherwise returns all records.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    let disbursements;
    if (month && year) {
      disbursements = await getDisbursementsByMonth(Number(month), Number(year));
    } else {
      disbursements = await getDisbursements();
    }

    return NextResponse.json({
      success: true,
      count: disbursements.length,
      disbursements,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/finance/disbursements
 * Create a new Donation_Disbursement__c record.
 */
export async function POST(request) {
  try {
    const body = await request.json();

    const required = ["organizationId", "amount", "cycleMonth", "cycleYear"];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const result = await createDisbursement(body);
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/finance/disbursements
 * Update an existing Donation_Disbursement__c record.
 * Body: { id: "sfId", ...fieldsToUpdate }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const result = await updateDisbursement(id, data);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
