import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPlaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const plaid = getPlaidClient();
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: "joseph-wiseman" },
      client_name: "SHOS / GYST",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("Plaid link token error:", err?.response?.data || err.message);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}
