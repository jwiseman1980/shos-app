import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPlaidClient } from "@/lib/plaid";
import { getServerClient } from "@/lib/supabase";

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return syncAll();
}

export async function syncAll() {
  const plaid = getPlaidClient();
  const supabase = getServerClient();

  const { data: items, error: itemsErr } = await supabase
    .from("gyst_plaid_items")
    .select("*")
    .eq("status", "active");

  if (itemsErr) throw itemsErr;
  if (!items?.length) return NextResponse.json({ added: 0, removed: 0 });

  let totalAdded = 0;
  let totalRemoved = 0;

  for (const item of items) {
    let cursor = item.cursor || null;
    let hasMore = true;

    while (hasMore) {
      const { data } = await plaid.transactionsSync({
        access_token: item.access_token,
        cursor: cursor || undefined,
      });

      const { added, modified, removed, next_cursor, has_more } = data;

      const toUpsert = [...added, ...modified].map((t) => ({
        plaid_transaction_id: t.transaction_id,
        account_id: t.account_id,
        date: t.date,
        description: t.name,
        original_description: t.original_description || t.name,
        amount: -t.amount, // Plaid: positive = debit; GYST: positive = income
        category: t.personal_finance_category?.primary || t.category?.[0] || "Uncategorized",
        pending: t.pending,
        source: "plaid",
      }));

      if (toUpsert.length) {
        const { error } = await supabase
          .from("gyst_transactions")
          .upsert(toUpsert, { onConflict: "plaid_transaction_id" });
        if (error) throw error;
        totalAdded += added.length;
      }

      if (removed.length) {
        const ids = removed.map((r) => r.transaction_id);
        await supabase
          .from("gyst_transactions")
          .delete()
          .in("plaid_transaction_id", ids);
        totalRemoved += removed.length;
      }

      cursor = next_cursor;
      hasMore = has_more;
    }

    await supabase
      .from("gyst_plaid_items")
      .update({ cursor, updated_at: new Date().toISOString() })
      .eq("item_id", item.item_id);
  }

  return NextResponse.json({ added: totalAdded, removed: totalRemoved });
}
