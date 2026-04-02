import { getCurrentMonth } from "@/lib/dates";
import { getServerClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Data source: Supabase (primary) with JSON fallback
// ---------------------------------------------------------------------------

async function fetchHeroesFromSupabase() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("heroes")
    .select(`
      *,
      family_contact:contacts!family_contact_id(id, first_name, last_name, email),
      organization:organizations!organization_id(id, name),
      assigned_user:users!anniversary_assigned_to(id, name)
    `)
    .order("name", { ascending: true });

  if (error) throw new Error(`Supabase heroes query failed: ${error.message}`);

  return (data || []).map((r) => ({
    sfId: r.sf_id || r.id,
    id: r.id,
    name: r.name,
    fullName: [r.rank, r.first_name, r.middle_name_initial, r.last_name]
      .filter(Boolean)
      .join(" "),
    firstName: r.first_name,
    lastName: r.last_name,
    rank: r.rank,
    branch: r.branch,
    serviceCode: r.branch,
    memorialDate: r.memorial_date,
    anniversaryMonth: r.memorial_month != null ? Number(r.memorial_month) : null,
    anniversaryDay: r.memorial_day != null ? Number(r.memorial_day) : null,
    anniversaryStatus: r.anniversary_status,
    anniversaryOutreachStatus: r.anniversary_outreach_status,
    designStatus: r.design_status,
    designPriority: r.design_priority,
    designBrief: r.design_brief,
    hasGraphicDesign: r.has_graphic_design,
    braceletDesignCreated: r.bracelet_design_created,
    bioPage: r.bio_page_url,
    activeListing: Boolean(r.active_listing),
    braceletSent: Boolean(r.bracelet_sent),
    onHand7in: r.on_hand_7in || 0,
    onHand6in: r.on_hand_6in || 0,
    totalOnHand: r.total_on_hand || 0,
    totalDonations: r.total_donations_raised || 0,
    fundsDonated: r.funds_donated || 0,
    sku: r.lineitem_sku,
    familyContactId: r.family_contact_id,
    familyContactName: r.family_contact
      ? `${r.family_contact.first_name || ""} ${r.family_contact.last_name || ""}`.trim()
      : null,
    familyContactEmail: r.family_contact?.email || null,
    organizationId: r.organization_id,
    organizationName: r.organization?.name || null,
    anniversaryAssignedTo: r.assigned_user?.name || null,
    anniversaryAssignedToId: r.anniversary_assigned_to,
    anniversaryCompletedDate: r.anniversary_completed_date,
    anniversaryNotes: r.anniversary_notes,
    incident: r.incident,
    memorialType: r.memorial_type || "individual",
  }));
}

async function loadHeroes() {
  try {
    return await fetchHeroesFromSupabase();
  } catch (err) {
    console.error("Supabase query failed, falling back to static JSON:", err.message);
    const heroData = (await import("@/data/heroes.json")).default;
    return heroData;
  }
}

// ---------------------------------------------------------------------------
// Public API — All functions return ACTIVE records only unless noted.
// ---------------------------------------------------------------------------

export async function getHeroes() {
  const heroes = await loadHeroes();
  return heroes.filter((h) => h.activeListing);
}

export async function getAllHeroes() {
  return loadHeroes();
}

export async function getHeroById(id) {
  const heroes = await loadHeroes();
  return heroes.find((h) => h.sfId === id || h.id === id) || null;
}

export async function getActiveHeroes() {
  return getHeroes();
}

export async function getAnniversariesByMonth(month) {
  const heroes = await getHeroes();
  const m = Number(month);
  // Only return individual heroes — class/incident memorials are separate
  return heroes.filter((h) => Number(h.anniversaryMonth) === m && h.memorialType === "individual");
}

export async function getEventMemorials() {
  const heroes = await getHeroes();
  return heroes.filter((h) => h.memorialType !== "individual");
}

export async function getEventMemorialsByMonth(month) {
  const heroes = await getHeroes();
  const m = Number(month);
  return heroes.filter((h) => Number(h.anniversaryMonth) === m && h.memorialType !== "individual");
}

export async function getAnniversariesThisMonth() {
  return getAnniversariesByMonth(getCurrentMonth());
}

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

  return { total, active: total, thisMonth, branchCounts };
}
