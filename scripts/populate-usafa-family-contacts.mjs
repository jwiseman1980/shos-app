/**
 * Populate USAFA Family Contacts from Chris Marti's Master Spreadsheet
 *
 * This script:
 * 1. Matches spreadsheet heroes to Supabase heroes by last name
 * 2. Creates new contacts for heroes missing family contacts
 * 3. Updates existing contacts with address/phone data from spreadsheet
 * 4. Links contacts to heroes via family_contact_id
 * 5. Creates hero_associations for the relationship
 *
 * Run: node scripts/populate-usafa-family-contacts.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Spreadsheet data — all rows from Chris's USAFA SH Master Spreadsheet
// ---------------------------------------------------------------------------
const SPREADSHEET_DATA = [
  {
    name: "Karl W. Richter",
    lastName: "Richter",
    gradYear: 1964,
    rank: "1Lt",
    branch: "USAF",
    kiaDate: "1967-07-28",
    unit: "421 Tac FTR SQ",
    braceletInProduction: false,
    charity: "St Judes",
    familyContacted: false,
    familyContact: null,
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Lance Peter Sijan",
    lastName: "Sijan",
    gradYear: 1965,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "1968-01-22",
    unit: "480th Tactical Fighter Squadron",
    braceletInProduction: true,
    charity: "Vietnam Veteran's Memorial Fund",
    charityUrl: "https://donate.vvmf.org/page/contribute/donate-to-the-vvmf",
    familyContacted: false,
    familyContact: null,
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Leroy W. Homer Jr",
    lastName: "Homer",
    gradYear: 1987,
    rank: "Maj",
    branch: "USAF",
    kiaDate: "2001-09-11",
    unit: "United Flight 93",
    braceletInProduction: true,
    charity: "LeRoy Homer Jr Foundation",
    charityUrl: "https://leroywhomerjr.org",
    familyContacted: true,
    familyContact: { name: "Melodie Homer", firstName: "Melodie", lastName: "Homer" },
    familyBraceletSent: true,
    address: null,
  },
  {
    name: 'Eric "Boot" Das',
    lastName: "Das",
    gradYear: 1995,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2003-04-07",
    unit: "335th FTR SQ",
    braceletInProduction: true,
    charity: "The Navigator's",
    charityUrl: "navigators.org/donate",
    familyContacted: true,
    familyContact: { name: "Nicole West", firstName: "Nicole", lastName: "West", phone: "707-344-1151" },
    familyBraceletSent: true,
    address: null,
  },
  {
    name: "Steven Plumhoff",
    lastName: "Plumhoff",
    gradYear: 1992,
    rank: "Maj",
    branch: "USAF",
    kiaDate: "2003-11-23",
    unit: "58th Operations Squadron",
    braceletInProduction: false,
    charity: "NONE",
    familyContacted: false,
    familyContact: null,
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Kevin M. Shea",
    lastName: "Shea",
    gradYear: 1984,
    rank: "Lt Col",
    branch: "USMC",
    kiaDate: "2004-09-14",
    unit: "Regimental Combat Team 1, 1st Marine Division",
    braceletInProduction: true,
    charity: "Semper Fi Fund",
    charityUrl: "https://semperfifund.org/",
    familyContacted: false,
    familyContact: null,
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Derek Mears Argel",
    lastName: "Argel",
    gradYear: 2001,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2005-05-30",
    unit: "23rd Special Tactics Squadron",
    braceletInProduction: true,
    charity: "A Soldier's Child",
    familyContacted: true,
    familyContact: { name: "Deb Argel-Bastian", firstName: "Deb", lastName: "Argel-Bastian" },
    familyBraceletSent: true,
    address: { street: "121 North W Street", city: "Lompoc", state: "CA", postal: "93436" },
  },
  {
    name: "Jeremy Jeff Fresques",
    lastName: "Fresques",
    gradYear: 2001,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2005-05-30",
    unit: "23rd Special Tactics Squadron",
    braceletInProduction: true,
    charity: "Special Operations Warrior Foundation",
    familyContacted: true,
    familyContact: { name: "Sherry Fresques", firstName: "Sherry", lastName: "Fresques", email: "sfresques@gmail.com" },
    familyBraceletSent: true,
    address: null,
  },
  {
    name: "Rodolfo Rodriguez",
    lastName: "Rodriguez",
    gradYear: 1998,
    rank: "Maj",
    branch: "USAF",
    kiaDate: "2008-09-20",
    unit: "86th Construction and Training Squadron",
    braceletInProduction: true,
    charity: "NONE",
    familyContacted: false,
    familyContact: null,
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Roslyn Littmann Schulte",
    lastName: "Schulte",
    gradYear: 2006,
    rank: "1Lt",
    branch: "USAF",
    kiaDate: "2009-05-20",
    unit: "613 Air & Space Ops Center",
    braceletInProduction: true,
    charity: "Jewish National Fund",
    familyContacted: false,
    familyContact: null,
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Mark Russell McDowell",
    lastName: "McDowell",
    gradYear: 2005,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2009-07-17",
    unit: "336th Fighter Squadron",
    braceletInProduction: true,
    charity: "Wreaths Across America",
    familyContacted: false,
    familyContact: null,
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Joseph Dennis Helton",
    lastName: "Helton",
    gradYear: 2007,
    rank: "1Lt",
    branch: "USAF",
    kiaDate: "2009-09-08",
    unit: "6th Security Forces Squadron",
    braceletInProduction: true,
    charity: "Lt Helton Memorial Foundation Scholarship",
    familyContacted: true,
    familyContact: { name: "Jiffy Helton Sarver", firstName: "Jiffy", lastName: "Helton Sarver" },
    familyBraceletSent: true,
    address: { street: "650 Trillium Lane", city: "Lilburn", state: "GA", postal: "30047" },
  },
  {
    name: "David Anthony Wisniewski",
    lastName: "Wisniewski",
    gradYear: 2002,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2010-07-02",
    unit: "66th Rescue Squadron",
    braceletInProduction: true,
    charity: "NONE",
    familyContacted: false,
    familyContact: { name: "Chet Wisniewski", firstName: "Chet", lastName: "Wisniewski" },
    familyBraceletSent: false,
    address: null,
  },
  {
    name: 'Frank "Bruiser" Bryant',
    lastName: "Bryant",
    gradYear: 1995,
    rank: "Lt Col",
    branch: "USAF",
    kiaDate: "2011-04-27",
    unit: "438th Air Expeditionary Advisor Group",
    braceletInProduction: true,
    charity: "Falcon Athletic Foundation - Wrestling",
    familyContacted: true,
    familyContact: null, // contacted but no name in spreadsheet
    familyBraceletSent: true,
    address: null,
  },
  {
    name: "David L Brodeur",
    lastName: "Brodeur",
    gradYear: 1999,
    rank: "Maj",
    branch: "USAF",
    kiaDate: "2011-04-27",
    unit: "18th Aggressor Squadron",
    braceletInProduction: false,
    charity: "Massachusetts Soldiers Legacy Fund",
    familyContacted: true,
    familyContact: { name: "Susie Brodeur", firstName: "Susie", lastName: "Brodeur" },
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Justin J. Wilkens",
    lastName: "Wilkens",
    gradYear: 2009,
    rank: "1 Lt",
    branch: "USAF",
    kiaDate: "2012-02-18",
    unit: "34th Special Operations Squadron",
    braceletInProduction: true,
    charity: "Special Operations Warrior Foundation",
    familyContacted: true,
    familyContact: null, // "Yes (1 to Fiance)" but no name
    familyBraceletSent: true,
    address: null,
  },
  {
    name: "James M Steel",
    lastName: "Steel",
    gradYear: 2006,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2013-04-03",
    unit: "77th Fighter Squadron",
    braceletInProduction: true,
    charity: "The American Fallen Soldiers Project",
    familyContacted: true,
    familyContact: { name: "Dorothy Mahaffy Steel", firstName: "Dorothy", lastName: "Mahaffy Steel" },
    familyBraceletSent: true,
    address: { street: "12154 Windsor Hall Way", city: "Herndon", state: "VA", postal: "20170" },
  },
  {
    name: 'Mark "Tyler" Voss',
    lastName: "Voss",
    gradYear: 2008,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2013-05-03",
    unit: "93rd Air Refueling Squadron",
    braceletInProduction: true,
    charity: 'Mark "Tyler" Voss Memorial Scholarship',
    familyContacted: true,
    familyContact: { name: "Marcy Voss", firstName: "Marcy", lastName: "Voss" },
    familyBraceletSent: true,
    address: { street: "703 Dresden Wood Dr", city: "Boerne", state: "TX", postal: "78006" },
    // Also: Wayne Voss (father)
  },
  {
    name: "Victoria A. Pinckney (Castro)",
    lastName: "Pinckney",
    gradYear: 2008,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2013-05-03",
    unit: "93rd Air Refueling Squadron",
    braceletInProduction: true,
    charity: "St Judes",
    familyContacted: true,
    familyContact: { name: "Larry Castro", firstName: "Larry", lastName: "Castro", email: "getinoldr@hotmail.com" },
    familyBraceletSent: true,
    address: null,
  },
  {
    name: "David I. Lyon (Lissy)",
    lastName: "Lyon",
    gradYear: 2008,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2013-12-27",
    unit: "21st Logistics Readiness Squadron",
    braceletInProduction: true,
    charity: "Steel Hearts",
    familyContacted: true,
    familyContact: { name: "Dana Pounds-Lyon", firstName: "Dana", lastName: "Pounds-Lyon" },
    familyBraceletSent: true,
    address: null,
  },
  {
    name: "Matthew D. Roland",
    lastName: "Roland",
    gradYear: 2010,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2015-08-26",
    unit: "23rd Special Tactics Squadron",
    braceletInProduction: true,
    charity: "Military Mission Inc.",
    familyContacted: true,
    familyContact: { name: "Mark Roland", firstName: "Mark", lastName: "Roland" },
    familyBraceletSent: true,
    address: { street: "732 Old Mill Lane", city: "Lexington", state: "KY", postal: "40514" },
  },
  {
    name: "Jordan D. Pierson",
    lastName: "Pierson",
    gradYear: 2010,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2015-10-02",
    unit: "39th Airlift Squadron",
    braceletInProduction: true,
    charity: "Battle Dawgs",
    familyContacted: true,
    familyContact: { name: "Jana Pierson", firstName: "Jana", lastName: "Pierson" },
    familyBraceletSent: true,
    address: { street: "4150 South 300 East, Apt 513", city: "Millcreek", state: "UT", postal: "84107" },
  },
  {
    name: "Adrianna Vorderbruggen",
    lastName: "Vorderbruggen",
    gradYear: 2002,
    rank: "Maj",
    branch: "USAF",
    kiaDate: "2015-12-21",
    unit: "OSI Exp Det 2405",
    braceletInProduction: true,
    charity: "NONE",
    familyContacted: false,
    familyContact: null,
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Frederick Drew Dellecker",
    lastName: "Dellecker",
    gradYear: 2013,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2017-03-14",
    unit: "318th Special Operations Squadron",
    braceletInProduction: true,
    charity: "Pilots N Paws",
    familyContacted: true,
    familyContact: { name: "Karen Keebler Dellecker", firstName: "Karen", lastName: "Keebler Dellecker" },
    familyBraceletSent: true,
    address: null,
  },
  {
    name: "James Brice Johnson",
    lastName: "Johnson",
    gradYear: 2007,
    rank: "LCDR",
    branch: "Navy",
    kiaDate: "2018-03-14",
    unit: "VFA-213",
    braceletInProduction: true,
    charity: "The Wingman Foundation",
    familyContacted: false,
    familyContact: null,
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Mark K. Weber",
    lastName: "Weber",
    gradYear: 2011,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2018-03-15",
    unit: "38th Rescue Squadron",
    braceletInProduction: true,
    charity: "That Others May Live Foundation",
    familyContacted: false,
    familyContact: null,
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Travis Wilkie",
    lastName: "Wilkie",
    gradYear: 2018,
    rank: "2d Lt",
    branch: "USAF",
    kiaDate: "2018-11-21",
    unit: "71st Student Squadron",
    braceletInProduction: true,
    charity: "Steel Hearts",
    familyContacted: true,
    familyContact: null, // contacted but no name
    familyBraceletSent: true,
    address: null,
  },
  {
    name: 'Kenneth "Kage" Allen',
    lastName: "Allen",
    gradYear: 2017,
    rank: "1Lt",
    branch: "USAF",
    kiaDate: "2020-06-15",
    unit: "493rd Fighter Squadron",
    braceletInProduction: true,
    charity: "The Fallen Wings Foundation",
    familyContacted: true,
    familyContact: { name: "Hannah Allen", firstName: "Hannah", lastName: "Allen" },
    familyBraceletSent: true,
    address: null,
  },
  {
    name: "John Robertson",
    lastName: "Robertson",
    gradYear: 2019,
    rank: "Capt",
    branch: "USAF",
    kiaDate: "2024-05-14",
    unit: "",
    braceletInProduction: false,
    charity: null,
    familyContacted: false,
    familyContact: null,
    familyBraceletSent: false,
    address: null,
  },
  {
    name: "Nicholas Scooter Hamilton",
    lastName: "Hamilton",
    gradYear: 2000,
    rank: "",
    branch: "",
    kiaDate: null,
    unit: "",
    braceletInProduction: true,
    charity: "Fallen Wings Foundation",
    familyContacted: true,
    familyContact: null, // contacted through company
    familyBraceletSent: true,
    address: null,
  },
];

// ---------------------------------------------------------------------------
// Hero matching — map spreadsheet last names to Supabase hero search terms
// ---------------------------------------------------------------------------
const HERO_SEARCH_MAP = {
  "Richter": "Richter",
  "Sijan": "Sijan",
  "Homer": "Homer",
  "Das": "Das",
  "Plumhoff": "Plumhoff",
  "Shea": "Shea",
  "Argel": "Argel",
  "Fresques": "Fresques",
  "Rodriguez": "Rodriguez",
  "Schulte": "Schulte",
  "McDowell": "McDowell",
  "Helton": "Helton",
  "Wisniewski": "Wisniewski",
  "Bryant": "Bryant",
  "Brodeur": "Brodeur",
  "Wilkens": "Wilkens",
  "Steel": "Steel",
  "Voss": "Voss",
  "Pinckney": "Pinckney",
  "Lyon": "Lyon",
  "Roland": "Roland",
  "Pierson": "Pierson",
  "Vorderbruggen": "Vorderbruggen",
  "Dellecker": "Dellecker",
  "Johnson": "Johnson",
  "Weber": "Weber",
  "Wilkie": "Wilkie",
  "Allen": "Allen",
  "Robertson": "Robertson",
  "Hamilton": "Hamilton",
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  USAFA Family Contact Migration${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(70)}\n`);

  const stats = {
    heroesMatched: 0,
    heroesNotFound: [],
    contactsCreated: 0,
    contactsUpdated: 0,
    heroesLinked: 0,
    associationsCreated: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of SPREADSHEET_DATA) {
    console.log(`\n--- ${row.name} ---`);

    // Step 1: Find the hero in Supabase
    // Search by name containing last name AND USAFA — handles suffixes like "Jr.", nicknames, etc.
    const { data: heroes, error: heroErr } = await sb
      .from('heroes')
      .select('id, name, last_name, family_contact_id, organization_id')
      .ilike('name', `%${row.lastName}%`)
      .ilike('name', `%USAFA%`);

    if (heroErr) {
      console.error(`  ERROR finding hero: ${heroErr.message}`);
      stats.errors.push({ hero: row.name, error: heroErr.message });
      continue;
    }

    let hero = heroes?.[0];

    // If multiple matches (e.g., common last names), narrow by first name
    if (heroes && heroes.length > 1) {
      const firstName = row.name.split(' ')[0].replace(/"/g, '');
      hero = heroes.find(h => h.name.includes(firstName)) || heroes[0];
      if (heroes.length > 1) {
        console.log(`  Multiple matches, selected: ${hero.name}`);
      }
    }

    // Fallback: search without USAFA for edge cases
    if (!hero) {
      const { data: broader } = await sb
        .from('heroes')
        .select('id, name, last_name, family_contact_id, organization_id')
        .ilike('name', `%${row.lastName}%`);

      if (broader && broader.length === 1) {
        hero = broader[0];
      } else if (broader && broader.length > 1) {
        const firstName = row.name.split(' ')[0].replace(/"/g, '');
        hero = broader.find(h => h.name.includes(firstName));
        if (!hero) {
          console.log(`  MULTIPLE matches for ${row.lastName}, candidates:`);
          broader.forEach(h => console.log(`    - ${h.name} (id: ${h.id})`));
          console.log(`  Skipping — needs manual review`);
          stats.skipped++;
          continue;
        }
      }
    }

    if (!hero) {
      console.log(`  NOT FOUND in Supabase`);
      stats.heroesNotFound.push(row.name);
      continue;
    }

    console.log(`  Matched: ${hero.name} (${hero.id})`);
    stats.heroesMatched++;

    // Step 2: Handle family contact
    if (!row.familyContact) {
      console.log(`  No family contact data in spreadsheet — skipping contact creation`);
      stats.skipped++;
      continue;
    }

    const fc = row.familyContact;

    if (hero.family_contact_id) {
      // Hero already has a contact — check if we can update with address/phone
      console.log(`  Already has family_contact_id: ${hero.family_contact_id}`);

      const { data: existingContact } = await sb
        .from('contacts')
        .select('*')
        .eq('id', hero.family_contact_id)
        .single();

      if (existingContact) {
        const updates = {};

        if (fc.phone && !existingContact.phone) {
          updates.phone = fc.phone;
        }
        if (fc.email && !existingContact.email) {
          updates.email = fc.email;
        }
        if (row.address && !existingContact.mailing_street) {
          updates.mailing_street = row.address.street;
          updates.mailing_city = row.address.city;
          updates.mailing_state = row.address.state;
          updates.mailing_postal = row.address.postal;
          updates.mailing_country = 'US';
        }

        if (Object.keys(updates).length > 0) {
          console.log(`  Updating existing contact with: ${JSON.stringify(updates)}`);
          if (!DRY_RUN) {
            const { error: updateErr } = await sb
              .from('contacts')
              .update(updates)
              .eq('id', hero.family_contact_id);
            if (updateErr) {
              console.error(`  ERROR updating contact: ${updateErr.message}`);
              stats.errors.push({ hero: row.name, error: updateErr.message });
            } else {
              stats.contactsUpdated++;
            }
          } else {
            stats.contactsUpdated++;
          }
        } else {
          console.log(`  Existing contact already has all available data`);
          stats.skipped++;
        }
      }

      // Even for existing contacts, update bracelet_sent if spreadsheet says sent
      if (row.familyBraceletSent && !DRY_RUN) {
        const { data: heroCheck } = await sb
          .from('heroes')
          .select('bracelet_sent')
          .eq('id', hero.id)
          .single();
        if (heroCheck && !heroCheck.bracelet_sent) {
          const { error: bsErr } = await sb
            .from('heroes')
            .update({ bracelet_sent: true })
            .eq('id', hero.id);
          if (!bsErr) {
            console.log(`  Updated bracelet_sent → true`);
            stats.braceletSentUpdated = (stats.braceletSentUpdated || 0) + 1;
          }
        }
      } else if (row.familyBraceletSent && DRY_RUN) {
        console.log(`  Would update bracelet_sent → true (if currently false)`);
      }

      continue;
    }

    // Step 3: Create new contact
    console.log(`  Creating contact: ${fc.firstName} ${fc.lastName}`);

    const contactFields = {
      first_name: fc.firstName,
      last_name: fc.lastName,
    };
    if (fc.email) contactFields.email = fc.email;
    if (fc.phone) contactFields.phone = fc.phone;
    if (row.address) {
      contactFields.mailing_street = row.address.street;
      contactFields.mailing_city = row.address.city;
      contactFields.mailing_state = row.address.state;
      contactFields.mailing_postal = row.address.postal;
      contactFields.mailing_country = 'US';
    }

    console.log(`  Contact data: ${JSON.stringify(contactFields)}`);

    let contactId;

    if (!DRY_RUN) {
      // Check for existing contact by email first
      if (fc.email) {
        const { data: existing } = await sb
          .from('contacts')
          .select('id')
          .eq('email', fc.email)
          .limit(1);
        if (existing && existing.length > 0) {
          contactId = existing[0].id;
          console.log(`  Found existing contact by email: ${contactId}`);
        }
      }

      if (!contactId) {
        // Check by name
        const { data: byName } = await sb
          .from('contacts')
          .select('id')
          .ilike('first_name', fc.firstName)
          .ilike('last_name', fc.lastName)
          .limit(1);
        if (byName && byName.length > 0) {
          contactId = byName[0].id;
          console.log(`  Found existing contact by name: ${contactId}`);
        }
      }

      if (!contactId) {
        const { data: newContact, error: createErr } = await sb
          .from('contacts')
          .insert(contactFields)
          .select('id')
          .single();

        if (createErr) {
          console.error(`  ERROR creating contact: ${createErr.message}`);
          stats.errors.push({ hero: row.name, error: createErr.message });
          continue;
        }
        contactId = newContact.id;
        console.log(`  Created contact: ${contactId}`);
        stats.contactsCreated++;
      }

      // Step 4: Link contact to hero
      const { error: linkErr } = await sb
        .from('heroes')
        .update({ family_contact_id: contactId })
        .eq('id', hero.id);

      if (linkErr) {
        console.error(`  ERROR linking contact: ${linkErr.message}`);
        stats.errors.push({ hero: row.name, error: linkErr.message });
      } else {
        console.log(`  Linked to hero`);
        stats.heroesLinked++;
      }

      // Step 5: Update bracelet_sent if spreadsheet says it was sent
      if (row.familyBraceletSent) {
        const { data: heroCheck } = await sb
          .from('heroes')
          .select('bracelet_sent')
          .eq('id', hero.id)
          .single();

        if (heroCheck && !heroCheck.bracelet_sent) {
          const { error: bsErr } = await sb
            .from('heroes')
            .update({ bracelet_sent: true })
            .eq('id', hero.id);
          if (!bsErr) {
            console.log(`  Updated bracelet_sent → true`);
            stats.braceletSentUpdated = (stats.braceletSentUpdated || 0) + 1;
          }
        }
      }

      // Step 6: Create hero_association
      const { error: assocErr } = await sb
        .from('hero_associations')
        .upsert({
          hero_id: hero.id,
          contact_id: contactId,
          role: 'Surviving Family',
        }, { onConflict: 'hero_id,contact_id,role' });

      if (assocErr) {
        // Might fail on unique constraint if already exists — that's fine
        if (!assocErr.message.includes('duplicate')) {
          console.error(`  ERROR creating association: ${assocErr.message}`);
        }
      } else {
        stats.associationsCreated++;
      }

    } else {
      stats.contactsCreated++;
      stats.heroesLinked++;
      stats.associationsCreated++;
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  MIGRATION SUMMARY${DRY_RUN ? ' (DRY RUN — nothing written)' : ''}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`  Heroes matched:        ${stats.heroesMatched}`);
  console.log(`  Contacts created:       ${stats.contactsCreated}`);
  console.log(`  Contacts updated:       ${stats.contactsUpdated}`);
  console.log(`  Heroes linked:          ${stats.heroesLinked}`);
  console.log(`  Associations created:   ${stats.associationsCreated}`);
  console.log(`  Bracelet sent updated:   ${stats.braceletSentUpdated || 0}`);
  console.log(`  Skipped (no data):      ${stats.skipped}`);
  console.log(`  Heroes not found:       ${stats.heroesNotFound.length}`);
  if (stats.heroesNotFound.length > 0) {
    stats.heroesNotFound.forEach(n => console.log(`    - ${n}`));
  }
  console.log(`  Errors:                 ${stats.errors.length}`);
  if (stats.errors.length > 0) {
    stats.errors.forEach(e => console.log(`    - ${e.hero}: ${e.error}`));
  }
  console.log('');
}

main().catch(console.error);
