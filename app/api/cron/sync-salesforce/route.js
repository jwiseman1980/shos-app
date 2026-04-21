/**
 * Salesforce → Supabase Contact Sync
 *
 * Upserts all SF Contacts into the `contacts` table and all
 * Hero_Association__c records into `hero_associations`. Runs weekly on
 * Sunday at 2am UTC (see vercel.json). Also handles the Rimer family
 * association to USA-RIMER on every run.
 *
 * Incremental: stores cursor in system_config("sf_contacts_last_sync").
 * First run does a full sync; subsequent runs fetch only modified records.
 *
 * Auth: Bearer ${CRON_SECRET} header or x-cron-secret header.
 */

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { sfQuery } from "@/lib/salesforce";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CURSOR_KEY = "sf_contacts_last_sync";

// USA-RIMER hero UUID in Supabase — hardcoded since it's a stable known ID
const RIMER_HERO_ID = "5f776579-d76b-425b-944e-3efbf4a7302a";

const RIMER_FAMILY = [
  { email: "mamarimer0908@yahoo.com", first_name: "Donna", last_name: "Rimer" },
  { email: "jhrdjr@aol.com",          first_name: "Jim",   last_name: "Rimer" },
];

// ── Auth ───────────────────────────────────────────────────────────────────────

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = request.headers.get("authorization");
  if (bearer === `Bearer ${secret}`) return true;
  const inline = request.headers.get("x-cron-secret");
  if (inline === secret) return true;
  return false;
}

// ── Cursor state ───────────────────────────────────────────────────────────────

async function getLastSyncTime(sb) {
  try {
    const { data } = await sb
      .from("system_config")
      .select("value")
      .eq("key", CURSOR_KEY)
      .limit(1)
      .single();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

async function setLastSyncTime(sb, iso) {
  try {
    await sb
      .from("system_config")
      .upsert({ key: CURSOR_KEY, value: iso }, { onConflict: "key" });
  } catch (e) {
    console.warn("[sf-sync] Could not persist cursor:", e.message);
  }
}

// ── Contact upsert ─────────────────────────────────────────────────────────────

// Upserts a Salesforce Contact into `contacts`. Deduplicates on sf_id first,
// then falls back to email match (to adopt pre-existing rows without an sf_id).
async function upsertContact(sb, sfContact) {
  const sfId = sfContact.Id;

  // Check for an existing contact matched by email that has no sf_id yet
  if (sfContact.Email) {
    const { data: byEmail } = await sb
      .from("contacts")
      .select("id, sf_id")
      .eq("email", sfContact.Email)
      .is("sf_id", null)
      .maybeSingle();

    if (byEmail) {
      const { data, error } = await sb
        .from("contacts")
        .update({
          sf_id: sfId,
          first_name: sfContact.FirstName || null,
          last_name: sfContact.LastName || null,
          phone: sfContact.Phone || null,
          mailing_street: sfContact.MailingStreet || null,
          mailing_city: sfContact.MailingCity || null,
          mailing_state: sfContact.MailingState || null,
          mailing_postal: sfContact.MailingPostalCode || null,
          mailing_country: sfContact.MailingCountry || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", byEmail.id)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    }
  }

  // Standard upsert on sf_id
  const { data, error } = await sb
    .from("contacts")
    .upsert(
      {
        sf_id: sfId,
        first_name: sfContact.FirstName || null,
        last_name: sfContact.LastName || null,
        email: sfContact.Email || null,
        phone: sfContact.Phone || null,
        mailing_street: sfContact.MailingStreet || null,
        mailing_city: sfContact.MailingCity || null,
        mailing_state: sfContact.MailingState || null,
        mailing_postal: sfContact.MailingPostalCode || null,
        mailing_country: sfContact.MailingCountry || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sf_id" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

// ── Association upsert ─────────────────────────────────────────────────────────

async function ensureAssociation(sb, heroId, contactId, role, sfAssocId = null) {
  const normalizedRole = role || "Surviving Family";

  if (sfAssocId) {
    await sb
      .from("hero_associations")
      .upsert(
        { sf_id: sfAssocId, hero_id: heroId, contact_id: contactId, role: normalizedRole },
        { onConflict: "sf_id" }
      );
  } else {
    await sb
      .from("hero_associations")
      .upsert(
        { hero_id: heroId, contact_id: contactId, role: normalizedRole },
        { onConflict: "hero_id,contact_id,role" }
      );
  }
}

// ── SF contact query ───────────────────────────────────────────────────────────

async function querySFContacts(lastSync) {
  let soql = [
    "SELECT Id, FirstName, LastName, Email, Phone,",
    "       MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry",
    "FROM Contact",
  ].join(" ");

  if (lastSync) {
    // Strip milliseconds — SF SOQL datetime literals don't accept them
    const soqlDate = lastSync.replace(/\.\d+Z$/, "Z");
    soql += ` WHERE LastModifiedDate >= ${soqlDate}`;
  }

  return sfQuery(soql);
}

// ── SF association query — try known field names, fall back gracefully ─────────

async function querySFAssociations() {
  // Try the most common custom object field name patterns
  const queries = [
    "SELECT Id, Contact__c, Memorial_Bracelet__c, Role__c FROM Hero_Association__c",
    "SELECT Id, Contact__c, Memorial_Bracelet__c, Relationship__c FROM Hero_Association__c",
    "SELECT Id, Contact__c, Memorial_Bracelet__c FROM Hero_Association__c",
  ];

  for (const soql of queries) {
    try {
      const records = await sfQuery(soql);
      return { records, roleField: soql.includes("Role__c") ? "Role__c" : "Relationship__c" };
    } catch {
      // Try next variant
    }
  }

  // Junction object doesn't exist or has different name — skip gracefully
  return { records: [], roleField: null };
}

// ── Rimer family special case ──────────────────────────────────────────────────

async function syncRimerFamily(sb) {
  const results = [];

  for (const rc of RIMER_FAMILY) {
    try {
      // Check if contact already exists (SF sync may have created it)
      const { data: existing } = await sb
        .from("contacts")
        .select("id")
        .eq("email", rc.email)
        .maybeSingle();

      let contactId;
      if (existing) {
        contactId = existing.id;
      } else {
        const { data: inserted, error } = await sb
          .from("contacts")
          .insert({ first_name: rc.first_name, last_name: rc.last_name, email: rc.email })
          .select("id")
          .single();
        if (error) throw error;
        contactId = inserted.id;
      }

      await ensureAssociation(sb, RIMER_HERO_ID, contactId, "Surviving Family");
      results.push({ email: rc.email, success: true });
    } catch (err) {
      results.push({ email: rc.email, success: false, error: err.message });
    }
  }

  return results;
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();
  const runStart = new Date().toISOString();

  const stats = {
    contacts_fetched: 0,
    contacts_synced: 0,
    contacts_errors: 0,
    associations_fetched: 0,
    associations_synced: 0,
    associations_errors: 0,
    rimer_results: [],
    errors: [],
    synced_at: runStart,
  };

  // ── Step 1: Sync Contacts ──────────────────────────────────────────────────

  const lastSync = await getLastSyncTime(sb);
  console.log(`[sf-sync] Starting contact sync. Last sync: ${lastSync ?? "none (full sync)"}`);

  let sfContacts = [];
  try {
    sfContacts = await querySFContacts(lastSync);
    stats.contacts_fetched = sfContacts.length;
    console.log(`[sf-sync] Fetched ${sfContacts.length} contact(s) from Salesforce`);
  } catch (err) {
    console.error("[sf-sync] Contact query failed:", err.message);
    stats.errors.push(`SF contact query: ${err.message}`);
  }

  // Maps SF Contact ID → Supabase UUID — used in association step
  const sfContactIdMap = {};

  for (const c of sfContacts) {
    try {
      const supabaseId = await upsertContact(sb, c);
      sfContactIdMap[c.Id] = supabaseId;
      stats.contacts_synced++;
    } catch (err) {
      console.error(`[sf-sync] Contact upsert failed (${c.Id}):`, err.message);
      stats.contacts_errors++;
      stats.errors.push(`Contact ${c.Id}: ${err.message}`);
    }
  }

  // ── Step 2: Sync Hero Associations ────────────────────────────────────────

  console.log("[sf-sync] Querying hero associations...");
  const { records: assocRecords, roleField } = await querySFAssociations();
  stats.associations_fetched = assocRecords.length;
  console.log(`[sf-sync] Fetched ${assocRecords.length} association(s)`);

  for (const assoc of assocRecords) {
    try {
      const sfContactId = assoc.Contact__c;
      const sfHeroId = assoc.Memorial_Bracelet__c;
      if (!sfContactId || !sfHeroId) continue;

      // Resolve Supabase contact UUID — use in-memory map first, then DB lookup
      let contactId = sfContactIdMap[sfContactId];
      if (!contactId) {
        const { data } = await sb
          .from("contacts")
          .select("id")
          .eq("sf_id", sfContactId)
          .maybeSingle();
        contactId = data?.id;
      }
      if (!contactId) {
        stats.errors.push(`Assoc ${assoc.Id}: no Supabase contact for SF ID ${sfContactId}`);
        stats.associations_errors++;
        continue;
      }

      // Resolve Supabase hero UUID via sf_id
      const { data: heroData } = await sb
        .from("heroes")
        .select("id")
        .eq("sf_id", sfHeroId)
        .maybeSingle();
      const heroId = heroData?.id;
      if (!heroId) {
        stats.errors.push(`Assoc ${assoc.Id}: no Supabase hero for SF ID ${sfHeroId}`);
        stats.associations_errors++;
        continue;
      }

      const role = (roleField && assoc[roleField]) || "Surviving Family";
      await ensureAssociation(sb, heroId, contactId, role, assoc.Id);
      stats.associations_synced++;
    } catch (err) {
      console.error(`[sf-sync] Association upsert failed (${assoc.Id}):`, err.message);
      stats.associations_errors++;
      stats.errors.push(`Assoc ${assoc.Id}: ${err.message}`);
    }
  }

  // ── Step 3: Rimer family ─────────────────────────────────────────────────

  console.log("[sf-sync] Ensuring Rimer family associations...");
  stats.rimer_results = await syncRimerFamily(sb);

  // ── Advance cursor ─────────────────────────────────────────────────────────

  await setLastSyncTime(sb, runStart);

  console.log(
    `[sf-sync] Done — contacts: ${stats.contacts_synced}/${stats.contacts_fetched}, ` +
    `associations: ${stats.associations_synced}/${stats.associations_fetched}, ` +
    `errors: ${stats.errors.length}`
  );

  return NextResponse.json({ success: true, ...stats });
}
