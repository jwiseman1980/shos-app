import { getServerClient } from "@/lib/supabase";

/**
 * Pipeline data layer -- tracks heroes from intake through active listing.
 * Infers lifecycle stage from data completeness in Supabase.
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
  if (hero.active_listing && hero.sh_bio_page && hero.has_graphic_design) {
    return "Active";
  }
  if (hero.has_graphic_design && !hero.sh_bio_page) {
    return "Website Listing";
  }
  if (hero.has_graphic_design && !hero.active_listing) {
    return "Website Listing";
  }
  if (hero.design_status === "In Production" || hero.design_status === "Approved") {
    return "Production";
  }
  if (hero.design_status === "Draft" || hero.design_status === "Review") {
    return "Design";
  }
  if (hero.active_listing && hero.sh_bio_page) {
    return "Active";
  }
  if (hero.active_listing) {
    return "Design";
  }
  if (hero.family_contact_id && !hero.design_status) {
    return "Charity Designation";
  }
  if (!hero.family_contact_id) {
    return "Family Outreach";
  }
  return "Intake";
}

/**
 * Get all heroes in the pipeline with their inferred stages
 */
export async function getPipelineHeroes() {
  try {
    const sb = getServerClient();
    const { data: records, error } = await sb
      .from("heroes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!records || records.length === 0) {
      return { heroes: [], stages: PIPELINE_STAGES, stats: {} };
    }

    const heroes = records.map((r) => {
      const stage = inferStage(r);
      return {
        id: r.sf_id || r.id,
        name: r.name,
        rank: r.rank || "",
        firstName: r.first_name || "",
        lastName: r.last_name || "",
        sku: r.lineitem_sku || "",
        branch: r.service_academy_or_branch || "",
        incident: r.incident || "",
        memorialDate: r.memorial_date,
        activeListing: r.active_listing || false,
        hasDesign: r.has_graphic_design || false,
        designStatus: r.design_status || "",
        designPriority: r.design_priority || "",
        designBrief: r.design_brief || "",
        bioPage: r.sh_bio_page || "",
        hasFamilyContact: !!r.family_contact_id,
        familyContactId: r.family_contact_id,
        orgId: r.organization_id,
        onHand7: r.on_hand_7in || 0,
        onHand6: r.on_hand_6in || 0,
        totalOnHand: r.total_on_hand || 0,
        memorialMonth: r.memorial_month || null,
        memorialDay: r.memorial_day || null,
        createdDate: r.created_at,
        stage,
        completeness: [
          true,
          !!r.family_contact_id,
          !!r.organization_id || r.active_listing,
          r.has_graphic_design || r.design_status,
          r.has_graphic_design,
          r.active_listing,
          !!r.sh_bio_page,
        ].filter(Boolean).length,
      };
    });

    // Count by stage
    const stageCounts = {};
    for (const stage of PIPELINE_STAGES) {
      stageCounts[stage] = heroes.filter((h) => h.stage === stage).length;
    }

    // New Intake -- not active listing, created in last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const newIntake = heroes
      .filter((h) => !h.activeListing && h.stage !== "Active" && new Date(h.createdDate) > threeMonthsAgo)
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
