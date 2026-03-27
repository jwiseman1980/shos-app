import { getAnniversariesByMonth, getAllHeroes } from "@/lib/data/heroes";
import { getAnniversaryWindow, getCurrentYear } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Obligation calculator: anniversary window sales, org balances, D-variants
// ---------------------------------------------------------------------------

const SF_LIVE = process.env.SF_LIVE === "true";

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
 *   - Donated bracelets (Order_Type__c != 'Paid-Squarespace' — handled in SOQL)
 *   - Wholesale orders (unit price ≤ $25)
 *   - Discounted orders (unit price not $35 or $45 — abnormal pricing = no obligation)
 *   - Refunded orders (unit price = $0 or negative)
 *   - Non-bracelet items (unit price doesn't match standard bracelet pricing)
 */
function isExcluded(unitPrice) {
  // Only $35 (standard) and $45 (D-variant) generate obligations
  return unitPrice !== 35 && unitPrice !== 45;
}

// ---------------------------------------------------------------------------
// getAnniversaryObligations — the core monthly payout calculator
// ---------------------------------------------------------------------------

/**
 * For a given memorial month, calculate all hero obligations for their
 * 12-month anniversary window ending in that month.
 *
 * @param {number} month — memorial month (1-12)
 * @param {number} year — the cycle year (e.g. 2026)
 * @returns per-hero breakdown, byOrg grouping, and totals
 */
export async function getAnniversaryObligations(month, year) {
  if (!SF_LIVE) {
    return { month, year, heroes: [], byOrg: {}, totals: _emptyTotals() };
  }

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

    // 3. Batch query order items for all heroes in one SOQL call
    const heroIds = heroes.filter((h) => h.memorialDate).map((h) => `'${h.sfId}'`);
    if (heroIds.length === 0) {
      return { month, year, heroes: [], byOrg: {}, totals: _emptyTotals() };
    }

    const { sfQuery } = await import("@/lib/salesforce");
    // SOQL date literals must not be quoted
    const soql = `
      SELECT Id, Lineitem_sku__c, Quantity__c, Unit_Price__c,
             Memorial_Bracelet__c,
             Squarespace_Order__r.Order_Type__c,
             Squarespace_Order__r.Order_Date__c
      FROM Squarespace_Order_Item__c
      WHERE Memorial_Bracelet__c IN (${heroIds.join(",")})
        AND Squarespace_Order__r.Order_Type__c = 'Paid-Squarespace'
        AND Squarespace_Order__r.Order_Date__c > ${earliestStart}T00:00:00.000Z
        AND Squarespace_Order__r.Order_Date__c <= ${latestEnd}T23:59:59.000Z
      ORDER BY Memorial_Bracelet__c
    `.trim();

    const items = await sfQuery(soql);

    // 4. Assign items to heroes, filter to each hero's specific window, apply exclusions
    const heroItemMap = {};
    for (const item of items) {
      const heroId = item.Memorial_Bracelet__c;
      const win = heroWindows[heroId];
      if (!win) continue;

      const orderDate = item.Squarespace_Order__r?.Order_Date__c;
      if (!orderDate) continue;

      // Check this item falls within THIS hero's specific window
      if (orderDate <= win.startAfter || orderDate > win.endInclusive) continue;

      // Exclude wholesale / discounted
      const price = item.Unit_Price__c || 0;
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
        const qty = item.Quantity__c || 1;
        units += qty;
        if (isDVariant(item.Lineitem_sku__c, item.Unit_Price__c)) {
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

      // Group by org
      if (h.organizationId && units > 0) {
        if (!byOrg[h.organizationId]) {
          byOrg[h.organizationId] = { name: null, totalObligation: 0, heroCount: 0, heroes: [] };
        }
        byOrg[h.organizationId].totalObligation += charityObligation;
        byOrg[h.organizationId].heroCount += 1;
        byOrg[h.organizationId].heroes.push(h.fullName || h.name);
      }
    }

    // Resolve org names from hero data (org names aren't on the hero object — we'll fill from Account query if needed)
    // For now, org IDs are the keys; the dashboard will resolve names separately

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
// getOrgBalances — per-organization accrued vs disbursed
// ---------------------------------------------------------------------------

/**
 * Query Account records that are charity partners and return their
 * obligation vs disbursement balances.
 */
export async function getOrgBalances() {
  if (!SF_LIVE) return [];

  try {
    const { sfQuery } = await import("@/lib/salesforce");

    const accounts = await sfQuery(`
      SELECT Id, Name, Total_Donations_From_Bracelets__c,
             Total_Disbursed__c, Outstanding_Donations__c,
             Funds_Donated_2026__c,
             Website, Phone, BillingStreet, BillingCity,
             BillingState, BillingPostalCode,
             (SELECT Email FROM Contacts ORDER BY CreatedDate ASC LIMIT 1)
      FROM Account
      WHERE Id IN (
        SELECT Associated_Organization__c
        FROM Memorial_Bracelet__c
        WHERE Associated_Organization__c != null
      )
      ORDER BY Outstanding_Donations__c DESC NULLS LAST
    `.trim());

    return accounts.map((a) => ({
      orgId: a.Id,
      orgName: a.Name,
      accrued: a.Total_Donations_From_Bracelets__c || 0,
      disbursed: a.Total_Disbursed__c || 0,
      outstanding: a.Outstanding_Donations__c || 0,
      disbursed2026: a.Funds_Donated_2026__c || 0,
      website: a.Website || null,
      phone: a.Phone || null,
      email: a.Contacts?.records?.[0]?.Email || null,
      billingStreet: a.BillingStreet || null,
      billingCity: a.BillingCity || null,
      billingState: a.BillingState || null,
      billingZip: a.BillingPostalCode || null,
    }));
  } catch (err) {
    console.error("Org balances error:", err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getDVariantDonors — people who paid extra $10 to Steel Hearts Fund
// ---------------------------------------------------------------------------

/**
 * Find all D-variant purchases for a given year, grouped by buyer email.
 * These are donors who voluntarily added $10 to Steel Hearts via the
 * D-variant product option.
 */
export async function getDVariantDonors(year) {
  if (!SF_LIVE) return [];

  try {
    const { sfQuery } = await import("@/lib/salesforce");
    const yearStart = `${year || getCurrentYear()}-01-01`;

    const items = await sfQuery(`
      SELECT Lineitem_sku__c, Quantity__c, Unit_Price__c,
             Memorial_Bracelet__r.Name,
             Squarespace_Order__r.Billing_Name__c,
             Squarespace_Order__r.Billing_Email__c,
             Squarespace_Order__r.Order_Date__c
      FROM Squarespace_Order_Item__c
      WHERE Squarespace_Order__r.Order_Type__c = 'Paid-Squarespace'
        AND (Lineitem_sku__c LIKE '%-7D' OR Lineitem_sku__c LIKE '%-6D')
        AND Unit_Price__c = 45
        AND Squarespace_Order__r.Order_Date__c >= ${yearStart}T00:00:00.000Z
      ORDER BY Squarespace_Order__r.Order_Date__c DESC
    `.trim());

    // Group by email
    const byEmail = {};
    for (const item of items) {
      const email = item.Squarespace_Order__r?.Billing_Email__c;
      const name = item.Squarespace_Order__r?.Billing_Name__c || "Unknown";
      const qty = item.Quantity__c || 1;
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

      const orderDate = item.Squarespace_Order__r?.Order_Date__c;
      if (orderDate && (!byEmail[key].lastDate || orderDate > byEmail[key].lastDate)) {
        byEmail[key].lastDate = orderDate;
      }

      const heroName = item.Memorial_Bracelet__r?.Name;
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
