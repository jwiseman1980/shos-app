import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPlaidClient } from "@/lib/plaid";
import { getServerClient } from "@/lib/supabase";

export async function POST(request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { public_token, institution } = await request.json();
  if (!public_token) {
    return NextResponse.json({ error: "public_token required" }, { status: 400 });
  }

  try {
    const plaid = getPlaidClient();
    const { data } = await plaid.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = data;

    const supabase = getServerClient();
    const { error } = await supabase.from("gyst_plaid_items").upsert(
      {
        item_id,
        access_token,
        institution_id: institution?.institution_id || null,
        institution_name: institution?.name || null,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "item_id" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true, item_id });
  } catch (err) {
    console.error("Plaid exchange error:", err?.response?.data || err.message);
    return NextResponse.json({ error: "Token exchange failed" }, { status: 500 });
  }
}
