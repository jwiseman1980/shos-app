import { getCurrentMonth } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Data source toggle: set SF_LIVE=true in .env.local to query Salesforce live,
// otherwise fall back to the static JSON seed file.
// ---------------------------------------------------------------------------

const useSalesforce = process.env.SF_LIVE === "true";

/**
 * Fetch all heroes from Salesforce and map them to the dashboard shape.
 */
async function fetchHeroesFromSF() {
  const { sfQuery } = await import("@/lib/salesforce");

  const soql = `
    SELECT
      Id,
      Name,
      First_Name__c,
      Middle_Name_Initial__c,
      Last_Name__c,
      Rank__c,
      Service_Academy_or_Branch__c,
      Memorial_Date__c,
      Memorial_Month__c,
      Memorial_Day__c,
      Anniversary_Status__c,
      Anniversary_Outreach_Status__c,
      Design_Status__c,
      Design_Priority__c,
      SH_Bio_Page__c,
      Bracelet_Sent__c,
      Active_Listing__c,
      On_Hand_7in__c,
      On_Hand_6in__c,
      Total_On_Hand__c,
      Total_Donations_Raised__c,
      Funds_Donated__c,
      Lineitem_sku__c,
      Associated_Family_Contact__c,
      Associated_Organization__c,
      Anniversary_Assigned_To__c,
      Anniversary_Assigned_To__r.Name,
      Anniversary_Completed_Date__c,
      Anniversary_Notes__c
    FROM Memorial_Bracelet__c
    ORDER BY Name ASC
  `.trim();

  const records = await sfQuery(soql);

  return records.map((r) => ({
    sfId: r.Id,
    name: r.Name,
    fullName: [r.Rank__c, r.First_Name__c, r.Middle_Name_Initial__c, r.Last_Name__c]
      .filter(Boolean)
      .join(" "),
    firstName: r.First_Name__c,
    lastName: r.Last_Name__c,
    rank: r.Rank__c,
    branch: r.Service_Academy_or_Branch__c,
    serviceCode: r.Service_Academy_or_Branch__c,
    memorialDate: r.Memorial_Date__c,
    anniversaryMonth:
      r.Memorial_Month__c != null ? Number(r.Memorial_Month__c) : null,
    anniversaryDay:
      r.Memorial_Day__c != null ? Number(r.Memorial_Day__c) : null,
    anniversaryStatus: r.Anniversary_Status__c,
    designStatus: r.Design_Status__c,
    bioPage: r.SH_Bio_Page__c,
    activeListing: Boolean(r.Active_Listing__c),
    braceletSent: Boolean(r.Bracelet_Sent__c),
    onHand7in: r.On_Hand_7in__c || 0,
    onHand6in: r.On_Hand_6in__c || 0,
    totalOnHand: r.Total_On_Hand__c || 0,
    totalDonations: r.Total_Donations_Raised__c || 0,
    sku: r.Lineitem_sku__c,
    familyContactId: r.Associated_Family_Contact__c,
    organizationId: r.Associated_Organization__c,
    anniversaryAssignedTo: r.Anniversary_Assigned_To__r?.Name || null,
    anniversaryAssignedToId: r.Anniversary_Assigned_To__c || null,
    anniversaryCompletedDate: r.Anniversary_Completed_Date__c || null,
    anniversaryNotes: r.Anniversary_Notes__c || null,
  }));
}

/**
 * Internal helper — returns the full hero array from the appropriate source.
 */
async function loadHeroes() {
  if (useSalesforce) {
    try {
      return await fetchHeroesFromSF();
    } catch (err) {
      console.error("Salesforce query failed, falling back to static JSON:", err.message);
      // Fall through to JSON fallback
    }
  }
  const heroData = (await import("@/data/heroes.json")).default;
  return heroData;
}

// ---------------------------------------------------------------------------
// Public API — All functions return ACTIVE records only unless noted.
// Inactive Memorial Bracelets must never appear in operational views.
// ---------------------------------------------------------------------------

/** @returns {Promise<object[]>} all ACTIVE heroes */
export async function getHeroes() {
  const heroes = await loadHeroes();
  return heroes.filter((h) => h.activeListing);
}

/** @returns {Promise<object[]>} all heroes including inactive (use sparingly) */
export async function getAllHeroes() {
  return loadHeroes();
}

/** @returns {Promise<object|null>} a single hero by Salesforce ID */
export async function getHeroById(sfId) {
  const heroes = await loadHeroes();
  return heroes.find((h) => h.sfId === sfId) || null;
}

/** @returns {Promise<object[]>} active heroes (alias for getHeroes) */
export async function getActiveHeroes() {
  return getHeroes();
}

/** @returns {Promise<object[]>} active heroes whose anniversaryMonth matches */
export async function getAnniversariesByMonth(month) {
  const heroes = await getHeroes();
  return heroes.filter((h) => h.anniversaryMonth === month);
}

/** @returns {Promise<object[]>} active heroes whose anniversary is this month */
export async function getAnniversariesThisMonth() {
  return getAnniversariesByMonth(getCurrentMonth());
}

/** @returns {Promise<object>} aggregate stats — active records only */
export async function getHeroStats() {
  const heroes = await getHeroes();
  const total = heroes.length;
  const thisMonth = heroes.filter(
    (h) => h.anniversaryMonth === getCurrentMonth()
  ).length;

  const branchCounts = {};
  for (const h of heroes) {
    const code = h.serviceCode || "Unknown";
    branchCounts[code] = (branchCounts[code] || 0) + 1;
  }

  return {
    total,
    active: total,
    thisMonth,
    branchCounts,
  };
}
