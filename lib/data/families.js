/**
 * Family Intake data layer — creates heroes, contacts, and links them
 * through the full intake pipeline. Now uses Supabase.
 */

import { getServerClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Branch code mapping for SKU generation
// ---------------------------------------------------------------------------
const BRANCH_CODES = {
  "U.S. Army": "USA",
  "U.S. Marine Corps": "USMC",
  "U.S. Navy": "USN",
  "U.S. Air Force": "USAF",
  "U.S. Coast Guard": "USCG",
  "U.S. Space Force": "USSF",
  Army: "USA",
  Marines: "USMC",
  USMC: "USMC",
  Navy: "USN",
  "Air Force": "USAF",
  "Coast Guard": "USCG",
  "Space Force": "USSF",
};

function generateSku(branch, lastName) {
  const code = BRANCH_CODES[branch] || branch?.toUpperCase()?.replace(/\s+/g, "") || "MIL";
  const name = lastName?.toUpperCase()?.replace(/[^A-Z]/g, "") || "UNKNOWN";
  return `${code}-${name}`;
}

// ---------------------------------------------------------------------------
// Step 1: Create Hero Record
// ---------------------------------------------------------------------------
export async function createHeroRecord({
  firstName,
  lastName,
  middleInitial = "",
  rank,
  branch,
  memorialDate,
  quote = "",
}) {
  try {
    const sb = getServerClient();

    const date = new Date(memorialDate + "T00:00:00");
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const sku = generateSku(branch, lastName);
    const displayName = [rank, firstName, middleInitial, lastName].filter(Boolean).join(" ");

    const { data: record, error } = await sb
      .from("heroes")
      .insert({
        name: displayName,
        first_name: firstName,
        last_name: lastName,
        middle_name_initial: middleInitial || null,
        rank,
        service_academy_or_branch: branch,
        memorial_date: memorialDate,
        memorial_month: month,
        memorial_day: day,
        lineitem_sku: sku,
        active_listing: false,
        design_status: "Not Started",
      })
      .select("id")
      .single();

    if (error) throw error;

    return {
      success: true,
      heroId: record.id,
      name: displayName,
      sku,
    };
  } catch (err) {
    console.error("Create hero error:", err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Step 2: Create or find Family Contact
// ---------------------------------------------------------------------------
export async function createFamilyContact({
  firstName,
  lastName,
  email,
  phone = "",
  mailingStreet = "",
  mailingCity = "",
  mailingState = "",
  mailingPostalCode = "",
  mailingCountry = "US",
}) {
  try {
    const sb = getServerClient();

    // Dedup by email
    if (email) {
      const { data: existing, error: lookupErr } = await sb
        .from("contacts")
        .select("id, first_name, last_name, email, mailing_street, mailing_city, mailing_state, mailing_postal_code")
        .eq("email", email)
        .limit(1);

      if (lookupErr) throw lookupErr;

      if (existing && existing.length > 0) {
        const contact = existing[0];
        // Update address if provided and not already set
        if (mailingStreet && !contact.mailing_street) {
          await sb
            .from("contacts")
            .update({
              mailing_street: mailingStreet,
              mailing_city: mailingCity,
              mailing_state: mailingState,
              mailing_postal_code: mailingPostalCode,
              mailing_country: mailingCountry,
            })
            .eq("id", contact.id);
        }
        return {
          success: true,
          contactId: contact.id,
          name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
          wasExisting: true,
          address: {
            street: mailingStreet || contact.mailing_street || "",
            city: mailingCity || contact.mailing_city || "",
            state: mailingState || contact.mailing_state || "",
            postalCode: mailingPostalCode || contact.mailing_postal_code || "",
          },
        };
      }
    }

    const contactFields = {
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
    };

    if (mailingStreet) {
      contactFields.mailing_street = mailingStreet;
      contactFields.mailing_city = mailingCity;
      contactFields.mailing_state = mailingState;
      contactFields.mailing_postal_code = mailingPostalCode;
      contactFields.mailing_country = mailingCountry;
    }

    const { data: contact, error } = await sb
      .from("contacts")
      .insert(contactFields)
      .select("id")
      .single();

    if (error) throw error;

    return {
      success: true,
      contactId: contact.id,
      name: `${firstName} ${lastName}`,
      wasExisting: false,
      address: mailingStreet ? { street: mailingStreet, city: mailingCity, state: mailingState, postalCode: mailingPostalCode } : null,
    };
  } catch (err) {
    console.error("Create family contact error:", err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Step 3: Link Family Contact to Hero
// ---------------------------------------------------------------------------
export async function linkFamilyToHero(heroId, contactId, relationship = "Surviving Family") {
  try {
    const sb = getServerClient();

    // Set the primary family contact on the hero
    const { error } = await sb
      .from("heroes")
      .update({ family_contact_id: contactId })
      .eq("id", heroId);

    if (error) throw error;

    return {
      success: true,
      associationId: `${heroId}-${contactId}`,
    };
  } catch (err) {
    console.error("Link family to hero error:", err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Step 4: Set Charity Designation (Organization lookup)
// ---------------------------------------------------------------------------
export async function setCharityDesignation(heroId, orgName) {
  try {
    const sb = getServerClient();

    // Search for existing organization
    const { data: existing, error: lookupErr } = await sb
      .from("organizations")
      .select("id, name")
      .ilike("name", `%${orgName}%`)
      .limit(5);

    if (lookupErr) throw lookupErr;

    let organizationId;
    let wasExisting = false;

    if (existing && existing.length > 0) {
      organizationId = existing[0].id;
      wasExisting = true;
    } else {
      const { data: newOrg, error: createErr } = await sb
        .from("organizations")
        .insert({ name: orgName })
        .select("id")
        .single();
      if (createErr) throw createErr;
      organizationId = newOrg.id;
    }

    const { error: updateErr } = await sb
      .from("heroes")
      .update({ organization_id: organizationId })
      .eq("id", heroId);

    if (updateErr) throw updateErr;

    return {
      success: true,
      accountId: organizationId,
      orgName: wasExisting ? existing[0].name : orgName,
      wasExisting,
    };
  } catch (err) {
    console.error("Set charity designation error:", err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Step 5: Set Design Brief
// ---------------------------------------------------------------------------
export async function setDesignBrief(heroId, designBrief) {
  try {
    const sb = getServerClient();
    const { error } = await sb
      .from("heroes")
      .update({
        design_status: "Not Started",
        design_brief: designBrief,
      })
      .eq("id", heroId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Set design brief error:", err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Get active intakes (recently created heroes not yet fully onboarded)
// ---------------------------------------------------------------------------
export async function getActiveIntakes() {
  try {
    const sb = getServerClient();

    const { data: heroes, error } = await sb
      .from("heroes")
      .select(`
        *,
        family_contact:contacts!family_contact_id(id, first_name, last_name, email),
        organization:organizations!organization_id(id, name)
      `)
      .eq("active_listing", false)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!heroes || heroes.length === 0) return [];

    // Check which have donated orders
    const heroIds = heroes.map((h) => h.id);
    const { data: orderCounts, error: orderErr } = await sb
      .from("order_items")
      .select("hero_id")
      .in("hero_id", heroIds);

    const orderMap = new Map();
    if (!orderErr && orderCounts) {
      for (const o of orderCounts) {
        orderMap.set(o.hero_id, (orderMap.get(o.hero_id) || 0) + 1);
      }
    }

    return heroes.map((h) => ({
      heroId: h.id,
      name: h.name,
      firstName: h.first_name,
      lastName: h.last_name,
      rank: h.rank,
      branch: h.service_academy_or_branch,
      memorialDate: h.memorial_date,
      sku: h.lineitem_sku,
      designStatus: h.design_status,
      designBrief: h.design_brief,
      createdDate: h.created_at,
      steps: {
        heroCreated: true,
        familyLinked: !!h.family_contact_id,
        charitySet: !!h.organization_id,
        designBriefSet: !!h.design_brief,
        orderCreated: (orderMap.get(h.id) || 0) > 0,
      },
      familyContact: h.family_contact
        ? {
            id: h.family_contact.id,
            name: [h.family_contact.first_name, h.family_contact.last_name].filter(Boolean).join(" "),
            email: h.family_contact.email,
          }
        : null,
      charity: h.organization
        ? {
            id: h.organization.id,
            name: h.organization.name,
          }
        : null,
    }));
  } catch (err) {
    console.error("Get active intakes error:", err.message);
    return [];
  }
}
