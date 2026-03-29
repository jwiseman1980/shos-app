import { getAnniversariesByMonth, getAllHeroes } from "@/lib/data/heroes";
import { getAnniversaryWindow, getCurrentYear } from "@/lib/dates";
import { getServerClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Obligation calculator: anniversary window sales, org balances, D-variants
// ---------------------------------------------------------------------------

/**
 * Detect whether an order item is a D-variant (extra $10 to Steel Hearts).
 * D-variants have SKUs ending in -7D or -6D, or unit price of $45.
 */
function isDVariant(sku, unitPrice) {
  const s = (sku || "").toUpperCase();
  return s.endsWith("-7D") || s.endsWith("-6D") || unitPrice === 45;
}

/**
 * Check if an order item should be excluded from obligation calculation.
 * CRITICAL BUSINESS RULE: Only standard retail bracelets ($35 or $45) generate
 * a $10 obligation. ALL of the following are excluded:
 *   - Donated bracelets (order_type != 'Paid-Squarespace' -- handled in query)
 *   - Wholesale orders (unit price <= $25)
 *   - Discounted orders (unit price not $35 or $45)
 *   - Refunded orders (unit price = $0 or negative)
 *   - Non-bracelet items (unit price doesn't match standard bracelet pricing)
 */
function isExcluded(unitPrice) {
  return unitPrice !== 35 && unitPrice !== 45;
}

// ---------------------------------------------------------------------------
// getAnniversaryObligations -- the core monthly payout calculator
// ---------------------------------------------------------------------------

/**
 * For a given memorial month, calculate all hero obligations for their
 * 12-month anniversary window ending in that month.
 *
 * @param {number} month -- memorial month (1-12)
 * @param {number} year -- the cycle year (e.g. 2026)
 * @returns per-hero breakdown, byOrg grouping, and totals
 */
export async function getAnniversaryObligations(month, year) {
  try {
    // 1. Get heroes whose memorial month matches
    const heroes = await getAnniversariesByMonth(month);
    if (heroes.length === 0) {
      return { month, year, heroes: [], byOrg: {}, totals: _emptyTotals() };
    }

    // 2. Compute per-hero windows and find the broadest date range for the batch query
    const heroWindows = {};
    let earliestStart = null;
    let latestEnd = null;

    for (const h of heroes) {
      if (!h.memorialDate) continue;
      const win = getAnniversaryWindow(h.memorialDate, year);
      heroWindows[h.sfId] = win;
      if (!earliestStart || win.startAfter < earliestStart) earliestStart = win.startAfter;
      if (!latestEnd || win.endInclusive > latestEnd) latestEnd = win.endInclusive;
    }

    // 3. Batch query order items for all heroes in one Supabase call
    const heroIds = heroes.filter((h) => h.memorialDate).map((h) => h.sfId);
    if (heroIds.length === 0) {
      return { month, year, heroes: [], byOrg: {}, totals: _emptyTotals() };
    }

    const sb = getServerClient();
    const { data: items, error } = await sb
      .from("order_items")
      .select(`
        id, lineitem_sku, quantity, unit_price, memorial_bracelet_id,
        order:orders!order_id(order_type, order_date)
      `)
      .in("memorial_bracelet_id", heroIds)
      .eq("order.order_type", "Paid-Squarespace")
      .gt("order.order_date", `${earliestStart}T00:00:00.000Z`)
      .lte("order.order_date", `${latestEnd}T23:59:59.000Z`);

    if (error) throw error;

    // 4. Assign items to heroes, filter to each hero's specific window, apply exclusions
    const heroItemMap = {};
    for (const item of (items || [])) {
      const heroId = item.memorial_bracelet_id;
      const win = heroWindows[heroId];
      if (!win) continue;

      const orderDate = item.order?.order_date;
      if (!orderDate) continue;

      if (orderDate <= win.startAfter || orderDate > win.endInclusive) continue;

      const price = item.unit_price || 0;
      if (isExcluded(price)) continue;

      if (!heroItemMap[heroId]) heroItemMap[heroId] = [];
      heroItemMap[heroId].push(item);
    }

    // 5. Build per-hero results
    const heroResults = [];
    const byOrg = {};
    let totalUnits = 0;
    let totalDVariantUnits = 0;
    let totalCharityObligation = 0;
    let totalSHObligation = 0;

    for (const h of heroes) {
      const hItems = heroItemMap[h.sfId] || [];
      const win = heroWindows[h.sfId] || { startAfter: null, endInclusive: null };

      let units = 0;
      let dVariantUnits = 0;

      for (const item of hItems) {
        const qty = item.quantity || 1;
        units += qty;
        if (isDVariant(item.lineitem_sku, item.unit_price)) {
          dVariantUnits += qty;
        }
      }

      const charityObligation = units * 10;
      const shObligation = dVariantUnits * 10;

      totalUnits += units;
      totalDVariantUnits += dVariantUnits;
      totalCharityObligation += charityObligation;
      totalSHObligation += shObligation;

      heroResults.push({
        sfId: h.sfId,
        name: h.name,
        fullName: h.fullName,
        memorialDate: h.memorialDate,
        sku: h.sku,
        organizationId: h.organizationId,
        windowStart: win.startAfter,
        windowEnd: win.endInclusive,
        totalUnits: units,
        dVariantUnits,
        standardUnits: units - dVariantUnits,
        charityObligation,
        steelHeartsObligation: shObligation,
      });

      if (h.organizationId && units > 0) {
        if (!byOrg[h.organizationId]) {
          byOrg[h.organizationId] = { name: null, totalObligation: 0, heroCount: 0, heroes: [] };
        }
        byOrg[h.organizationId].totalObligation += charityObligation;
        byOrg[h.organizationId].heroCount += 1;
        byOrg[h.organizationId].heroes.push(h.fullName || h.name);
      }
    }

    return {
      month,
      year,
      heroes: heroResults,
      byOrg,
      totals: {
        totalUnits,
        totalDVariantUnits,
        totalCharityObligation,
        totalSteelHeartsObligation: totalSHObligation,
        heroCount: heroes.length,
        heroesWithSales: heroResults.filter((h) => h.totalUnits > 0).length,
        orgCount: Object.keys(byOrg).length,
      },
    };
  } catch (err) {
    console.error("Anniversary obligations error:", err.message);
    return { month, year, heroes: [], byOrg: {}, totals: _emptyTotals(), error: err.message };
  }
}

// ---------------------------------------------------------------------------
// getOrgBalances -- per-organization accrued vs disbursed
// ---------------------------------------------------------------------------

/**
 * Query organization records that are charity partners and return their
 * obligation vs disbursement balances.
 */
export async function getOrgBalances() {
  try {
    const sb = getServerClient();

    // Get all organizations linked to heroes
    const { data: orgs, error } = await sb
      .from("organizations")
      .select(`
        id, name,
        total_donations_from_bracelets,
        total_disbursed,
        outstanding_donations,
        funds_donated_2026,
        website, phone,
        billing_street, billing_city, billing_state, billing_postal_code
      `)
      .order("outstanding_donations", { ascending: false, nullsFirst: false });

    if (error) throw error;

    // Get one contact email per org
    const orgIds = (orgs || []).map((o) => o.id);
    const { data: contacts } = await sb
      .from("contacts")
      .select("id, email, organization_id")
      .in("organization_id", orgIds)
      .order("created_at", { ascending: true });

    const emailByOrg = {};
    for (const c of (contacts || [])) {
      if (c.organization_id && c.email && !emailByOrg[c.organization_id]) {
        emailByOrg[c.organization_id] = c.email;
      }
    }

    return (orgs || []).map((a) => ({
      orgId: a.id,
      orgName: a.name,
      accrued: a.total_donations_from_bracelets || 0,
      disbursed: a.total_disbursed || 0,
      outstanding: a.outstanding_donations || 0,
      disbursed2026: a.funds_donated_2026 || 0,
      website: a.website || null,
      phone: a.phone || null,
      email: emailByOrg[a.id] || null,
      billingStreet: a.billing_street || null,
      billingCity: a.billing_city || null,
      billingState: a.billing_state || null,
      billingZip: a.billing_postal_code || null,
    }));
  } catch (err) {
    console.error("Org balances error:", err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getDVariantDonors -- people who paid extra $10 to Steel Hearts Fund
// ---------------------------------------------------------------------------

/**
 * Find all D-variant purchases for a given year, grouped by buyer email.
 */
export async function getDVariantDonors(year) {
  try {
    const sb = getServerClient();
    const yearStart = `${year || getCurrentYear()}-01-01T00:00:00.000Z`;

    const { data: items, error } = await sb
      .from("order_items")
      .select(`
        lineitem_sku, quantity, unit_price,
        hero:heroes!memorial_bracelet_id(name),
        order:orders!order_id(billing_name, billing_email, order_date, order_type)
      `)
      .eq("order.order_type", "Paid-Squarespace")
      .eq("unit_price", 45)
      .or("lineitem_sku.ilike.%-7D,lineitem_sku.ilike.%-6D")
      .gte("order.order_date", yearStart)
      .order("order(order_date)", { ascending: false });

    if (error) throw error;

    // Group by email
    const byEmail = {};
    for (const item of (items || [])) {
      const email = item.order?.billing_email;
      const name = item.order?.billing_name || "Unknown";
      const qty = item.quantity || 1;
      const key = email || name;

      if (!byEmail[key]) {
        byEmail[key] = {
          email: email || null,
          name,
          purchases: 0,
          totalContribution: 0,
          lastDate: null,
          heroes: [],
        };
      }
      byEmail[key].purchases += qty;
      byEmail[key].totalContribution += qty * 10;

      const orderDate = item.order?.order_date;
      if (orderDate && (!byEmail[key].lastDate || orderDate > byEmail[key].lastDate)) {
        byEmail[key].lastDate = orderDate;
      }

      const heroName = item.hero?.name;
      if (heroName && !byEmail[key].heroes.includes(heroName)) {
        byEmail[key].heroes.push(heroName);
      }
    }

    return Object.values(byEmail).sort((a, b) => b.totalContribution - a.totalContribution);
  } catch (err) {
    console.error("D-variant donors error:", err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _emptyTotals() {
  return {
    totalUnits: 0,
    totalDVariantUnits: 0,
    totalCharityObligation: 0,
    totalSteelHeartsObligation: 0,
    heroCount: 0,
    heroesWithSales: 0,
    orgCount: 0,
  };
}
