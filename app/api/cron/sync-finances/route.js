import { NextResponse } from "next/server";
import { syncAll } from "@/app/api/plaid/sync-transactions/route";

export async function GET(request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const txResult = await syncAll();
    const txData = await txResult.json();

    // Sync account balances
    const accountsRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/plaid/accounts`,
      { method: "POST", headers: { "x-cron-secret": process.env.CRON_SECRET } }
    );

    return NextResponse.json({
      success: true,
      transactions: txData,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Finance sync cron error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
