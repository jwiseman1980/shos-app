import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPlaidClient } from "@/lib/plaid";
import { getServerClient } from "@/lib/supabase";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServerClient();
    const { data: accounts, error } = await supabase
      .from("gyst_accounts")
      .select("*")
      .order("institution", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ accounts });
  } catch (err) {
    console.error("Accounts fetch error:", err.message);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const plaid = getPlaidClient();
    const supabase = getServerClient();

    const { data: items } = await supabase
      .from("gyst_plaid_items")
      .select("*")
      .eq("status", "active");

    if (!items?.length) {
      return NextResponse.json({ accounts: [], synced: 0 });
    }

    let total = 0;
    for (const item of items) {
      const { data } = await plaid.accountsGet({ access_token: item.access_token });
      const rows = data.accounts.map((a) => ({
        plaid_account_id: a.account_id,
        plaid_item_id: item.item_id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        institution: item.institution_name,
        current_balance: a.balances.current,
        available_balance: a.balances.available,
        currency: a.balances.iso_currency_code || "USD",
        mask: a.mask,
        last_synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("gyst_accounts")
        .upsert(rows, { onConflict: "plaid_account_id" });

      if (error) throw error;
      total += rows.length;
    }

    const { data: accounts } = await supabase
      .from("gyst_accounts")
      .select("*")
      .order("institution");

    return NextResponse.json({ accounts, synced: total });
  } catch (err) {
    console.error("Accounts sync error:", err?.response?.data || err.message);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
