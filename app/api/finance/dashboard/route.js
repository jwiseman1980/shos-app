/**
 * Finance KPI Dashboard API
 *
 * Aggregates revenue, donation, expense, and order data from Supabase
 * for the Finance KPI Dashboard page.
 *
 * Returns:
 * - Monthly revenue (paid orders: unitPrice * quantity)
 * - Monthly donation totals
 * - Monthly expense totals
 * - Order stats: total orders, total revenue, avg order value
 * - Donated bracelet stats
 * - Top heroes by bracelet sales
 * - YTD totals
 */

import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sb = getServerClient();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const ytdStart = `${currentYear}-01-01`;

    // -----------------------------------------------------------------------
    // 1. Paid orders — monthly revenue
    // -----------------------------------------------------------------------
    const { data: paidItems, error: paidErr } = await sb
      .from("order_items")
      .select(`
        id, unit_price, quantity, created_at,
        order:orders!order_id(order_date, order_type)
      `)
      .eq("order.order_type", "paid")
      .gte("order.order_date", `${currentYear - 1}-01-01`)
      .order("created_at", { ascending: true });

    if (paidErr) throw paidErr;

    // Build monthly revenue map
    const monthlyRevenue = {};
    let ytdRevenue = 0;
    let totalOrders = new Set();
    let totalRevenue = 0;
    let totalQty = 0;

    for (const item of (paidItems || [])) {
      if (!item.order?.order_date) continue;
      const d = new Date(item.order.order_date + "T00:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const lineTotal = (item.unit_price || 0) * (item.quantity || 1);

      if (!monthlyRevenue[key]) monthlyRevenue[key] = 0;
      monthlyRevenue[key] += lineTotal;

      // YTD
      if (d.getFullYear() === currentYear) {
        ytdRevenue += lineTotal;
      }
      totalRevenue += lineTotal;
      totalQty += (item.quantity || 1);
      totalOrders.add(item.order?.order_date); // rough proxy
    }

    // Total distinct paid orders count
    const { count: paidOrderCount } = await sb
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("order_type", "paid");

    const avgOrderValue = (paidOrderCount || 0) > 0
      ? Math.round((totalRevenue / (paidOrderCount || 1)) * 100) / 100
      : 0;

    // -----------------------------------------------------------------------
    // 2. Donated orders stats
    // -----------------------------------------------------------------------
    const { data: donatedItems, error: donErr } = await sb
      .from("order_items")
      .select(`
        id, quantity, created_at,
        order:orders!order_id(order_date, order_type)
      `)
      .eq("order.order_type", "donated")
      .gte("order.order_date", ytdStart);

    if (donErr) throw donErr;

    let ytdDonatedOrders = 0;
    let ytdDonatedQty = 0;
    const donatedOrderIds = new Set();
    for (const item of (donatedItems || [])) {
      if (!item.order?.order_date) continue;
      ytdDonatedQty += (item.quantity || 1);
      donatedOrderIds.add(item.id);
    }
    ytdDonatedOrders = donatedOrderIds.size;

    const { count: totalDonatedOrderCount } = await sb
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("order_type", "donated")
      .gte("order_date", ytdStart);

    // -----------------------------------------------------------------------
    // 3. Donations (monetary gifts, not bracelet donations)
    // -----------------------------------------------------------------------
    const { data: donations, error: donationsErr } = await sb
      .from("donations")
      .select("id, amount, donation_date")
      .gte("donation_date", `${currentYear - 1}-01-01`)
      .order("donation_date", { ascending: true });

    if (donationsErr) throw donationsErr;

    const monthlyDonations = {};
    let ytdDonations = 0;

    for (const d of (donations || [])) {
      if (!d.donation_date) continue;
      const dt = new Date(d.donation_date + "T00:00:00");
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyDonations[key]) monthlyDonations[key] = 0;
      monthlyDonations[key] += (d.amount || 0);

      if (dt.getFullYear() === currentYear) {
        ytdDonations += (d.amount || 0);
      }
    }

    // -----------------------------------------------------------------------
    // 4. Expenses
    // -----------------------------------------------------------------------
    const { data: expenses, error: expErr } = await sb
      .from("expenses")
      .select("id, amount, transaction_date, category, month, year, is_excluded")
      .eq("year", currentYear)
      .eq("is_excluded", false)
      .order("transaction_date", { ascending: true });

    // Don't throw if expenses table doesn't exist or is empty
    const monthlyExpenses = {};
    let ytdExpenses = 0;
    const expenseByCategory = {};

    if (!expErr && expenses) {
      for (const e of expenses) {
        const mo = e.month || (e.transaction_date ? new Date(e.transaction_date + "T00:00:00").getMonth() + 1 : null);
        if (!mo) continue;
        const key = `${currentYear}-${String(mo).padStart(2, "0")}`;
        if (!monthlyExpenses[key]) monthlyExpenses[key] = 0;
        monthlyExpenses[key] += (e.amount || 0);
        ytdExpenses += (e.amount || 0);

        const cat = e.category || "other";
        if (!expenseByCategory[cat]) expenseByCategory[cat] = 0;
        expenseByCategory[cat] += (e.amount || 0);
      }
    }

    // -----------------------------------------------------------------------
    // 5. Top heroes by bracelet sales (paid orders, all time)
    // -----------------------------------------------------------------------
    const { data: heroSales, error: heroErr } = await sb
      .from("order_items")
      .select(`
        hero_id, unit_price, quantity,
        hero:heroes!hero_id(name),
        order:orders!order_id(order_type)
      `)
      .eq("order.order_type", "paid")
      .not("hero_id", "is", null);

    const heroMap = {};
    if (!heroErr && heroSales) {
      for (const item of heroSales) {
        if (!item.order || !item.hero_id) continue;
        const hid = item.hero_id;
        if (!heroMap[hid]) {
          heroMap[hid] = {
            heroId: hid,
            heroName: item.hero?.name || "Unknown",
            totalRevenue: 0,
            totalQty: 0,
          };
        }
        heroMap[hid].totalRevenue += (item.unit_price || 0) * (item.quantity || 1);
        heroMap[hid].totalQty += (item.quantity || 1);
      }
    }

    const topHeroes = Object.values(heroMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 15);

    // -----------------------------------------------------------------------
    // 6. Build last-6-months trend data
    // -----------------------------------------------------------------------
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      months.push({
        key,
        label,
        revenue: Math.round((monthlyRevenue[key] || 0) * 100) / 100,
        donations: Math.round((monthlyDonations[key] || 0) * 100) / 100,
        expenses: Math.round((monthlyExpenses[key] || 0) * 100) / 100,
      });
    }

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      ytd: {
        revenue: Math.round(ytdRevenue * 100) / 100,
        donations: Math.round(ytdDonations * 100) / 100,
        expenses: Math.round(ytdExpenses * 100) / 100,
        net: Math.round((ytdRevenue + ytdDonations - ytdExpenses) * 100) / 100,
      },
      orderStats: {
        totalPaidOrders: paidOrderCount || 0,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        totalBraceletsSold: totalQty,
      },
      donatedStats: {
        ytdDonatedOrders: totalDonatedOrderCount || 0,
        ytdDonatedQty,
      },
      months,
      expenseByCategory,
      topHeroes,
      costPerBracelet: 2.0,
    });
  } catch (err) {
    console.error("Finance dashboard API error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
