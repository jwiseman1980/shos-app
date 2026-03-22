import { sfQuery } from "@/lib/salesforce";

/**
 * Pipeline data layer — tracks heroes from intake through active listing.
 * Infers lifecycle stage from data completeness in Salesforce.
 */

const PIPELINE_STAGES = [
  "Intake",
  "Family Outreach",
  "Charity Designation",
  "Design",
  "Production",
  "Donated Fulfillment",
  "Website Listing",
  "Active",
];

/**
 * Determine pipeline stage based on record data completeness
 */
function inferStage(hero) {
  // Active = fully live, has design, bio page, and active listing
  if (hero.Active_Listing__c && hero.SH_Bio_Page__c && hero.Has_Graphic_Design__c) {
    return "Active";
  }
  // Website Listing = has design but missing bio page or not active
  if (hero.Has_Graphic_Design__c && !hero.SH_Bio_Page__c) {
    return "Website Listing";
  }
  if (hero.Has_Graphic_Design__c && !hero.Active_Listing__c) {
    return "Website Listing";
  }
  // Production = has design brief or design in progress
  if (hero.Design_Status__c === "In Production" || hero.Design_Status__c === "Approved") {
    return "Production";
  }
  // Design = needs graphic design
  if (hero.Design_Status__c === "Draft" || hero.Design_Status__c === "Review") {
    return "Design";
  }
  // If active listing but no design flag — likely has a design but flag not updated
  if (hero.Active_Listing__c && hero.SH_Bio_Page__c) {
    return "Active";
  }
  if (hero.Active_Listing__c) {
    return "Design"; // Active but missing design — needs attention
  }
  // Charity Designation — has family contact but no design work started
  if (hero.Associated_Family_Contact__c && !hero.Design_Status__c) {
    return "Charity Designation";
  }
  // Family Outreach — no family contact yet
  if (!hero.Associated_Family_Contact__c) {
    return "Family Outreach";
  }
  return "Intake";
}

/**
 * Get all heroes in the pipeline with their inferred stages
 */
export async function getPipelineHeroes() {
  if (process.env.SF_LIVE !== "true") {
    return { heroes: [], stages: PIPELINE_STAGES, stats: {} };
  }

  try {
    const records = await sfQuery(`
      SELECT Id, Name, Rank__c, First_Name__c, Last_Name__c,
        Lineitem_sku__c, Service_Academy_or_Branch__c, Incident__c,
        Memorial_Date__c, Memorial_Month__c, Memorial_Day__c,
        Active_Listing__c, Has_Graphic_Design__c,
        Design_Status__c, Design_Priority__c, Design_Brief__c,
        SH_Bio_Page__c, Associated_Family_Contact__c,
        Associated_Organization__c, On_Hand_7in__c, On_Hand_6in__c,
        Total_On_Hand__c, CreatedDate
      FROM Memorial_Bracelet__c
      ORDER BY CreatedDate DESC
    `);

    const heroes = records.map((r) => {
      const stage = inferStage(r);
      return {
        id: r.Id,
        name: r.Name,
        rank: r.Rank__c || "",
        firstName: r.First_Name__c || "",
        lastName: r.Last_Name__c || "",
        sku: r.Lineitem_sku__c || "",
        branch: r.Service_Academy_or_Branch__c || "",
        incident: r.Incident__c || "",
        memorialDate: r.Memorial_Date__c,
        activeListing: r.Active_Listing__c || false,
        hasDesign: r.Has_Graphic_Design__c || false,
        designStatus: r.Design_Status__c || "",
        designPriority: r.Design_Priority__c || "",
        designBrief: r.Design_Brief__c || "",
        bioPage: r.SH_Bio_Page__c || "",
        hasFamilyContact: !!r.Associated_Family_Contact__c,
        familyContactId: r.Associated_Family_Contact__c,
        orgId: r.Associated_Organization__c,
        onHand7: r.On_Hand_7in__c || 0,
        onHand6: r.On_Hand_6in__c || 0,
        totalOnHand: r.Total_On_Hand__c || 0,
        memorialMonth: r.Memorial_Month__c || null,
        memorialDay: r.Memorial_Day__c || null,
        createdDate: r.CreatedDate,
        stage,
        // Completeness score (0-7 based on how many stages are done)
        completeness: [
          true, // Intake is always done if record exists
          !!r.Associated_Family_Contact__c,
          !!r.Associated_Organization__c || r.Active_Listing__c, // charity designated
          r.Has_Graphic_Design__c || r.Design_Status__c,
          r.Has_Graphic_Design__c, // production complete
          r.Active_Listing__c, // donated fulfillment done
          !!r.SH_Bio_Page__c, // website listed
        ].filter(Boolean).length,
      };
    });

    // Count by stage
    const stageCounts = {};
    for (const stage of PIPELINE_STAGES) {
      stageCounts[stage] = heroes.filter((h) => h.stage === stage).length;
    }

    // New Intake — not active listing, created in last 3 months, being actively onboarded
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 3);
    const newIntake = heroes
      .filter((h) => !h.activeListing && h.stage !== "Active" && new Date(h.createdDate) > sixMonthsAgo)
      .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

    // Heroes that need attention (not Active, sorted by creation date)
    const inProgress = heroes
      .filter((h) => h.stage !== "Active")
      .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

    // Research Queue: active heroes missing family contacts, grouped by anniversary month
    const MONTH_NAMES = [
      "", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const researchQueue = heroes
      .filter((h) => h.activeListing && !h.hasFamilyContact)
      .sort((a, b) => (a.memorialMonth || 13) - (b.memorialMonth || 13));

    const researchByMonth = {};
    for (const h of researchQueue) {
      const monthName = h.memorialMonth
        ? MONTH_NAMES[h.memorialMonth]
        : "No Anniversary Date";
      if (!researchByMonth[monthName]) researchByMonth[monthName] = [];
      researchByMonth[monthName].push(h);
    }

    return {
      heroes,
      newIntake,
      inProgress,
      researchQueue,
      researchByMonth,
      stages: PIPELINE_STAGES,
      stageCounts,
      stats: {
        total: heroes.length,
        active: heroes.filter((h) => h.stage === "Active").length,
        newIntakeCount: newIntake.length,
        inPipeline: inProgress.length,
        needsDesign: heroes.filter(
          (h) => !h.hasDesign && h.stage !== "Active"
        ).length,
        needsFamily: heroes.filter((h) => !h.hasFamilyContact).length,
        needsResearch: researchQueue.length,
        needsBioPage: heroes.filter(
          (h) => !h.bioPage && h.activeListing
        ).length,
      },
    };
  } catch (err) {
    console.error("Pipeline query failed:", err);
    return { heroes: [], inProgress: [], stages: PIPELINE_STAGES, stageCounts: {}, stats: {} };
  }
}
