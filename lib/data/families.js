/**
 * Family Intake data layer — creates heroes, contacts, and links them
 * through the full intake pipeline.
 */

const SF_LIVE = process.env.SF_LIVE === "true";

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
// Step 1: Create Hero Record (Memorial_Bracelet__c)
// ---------------------------------------------------------------------------
export async function createHeroRecord({
  firstName,
  lastName,
  middleInitial = "",
  rank,
  branch,
  memorialDate, // "YYYY-MM-DD"
  quote = "",
}) {
  if (!SF_LIVE) return { success: false, mock: true, message: "SF_LIVE is off" };
  const { sfCreate } = await import("@/lib/salesforce");

  const date = new Date(memorialDate + "T00:00:00");
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const sku = generateSku(branch, lastName);
  const displayName = [rank, firstName, middleInitial, lastName].filter(Boolean).join(" ");

  const record = await sfCreate("Memorial_Bracelet__c", {
    Name: displayName,
    First_Name__c: firstName,
    Last_Name__c: lastName,
    Middle_Name_Initial__c: middleInitial || null,
    Rank__c: rank,
    Service_Academy_or_Branch__c: branch,
    Memorial_Date__c: memorialDate,
    Memorial_Month__c: month,
    Memorial_Day__c: day,
    Lineitem_sku__c: sku,
    Active_Listing__c: false,
    Design_Status__c: "Queued",
  });

  return {
    success: true,
    heroId: record.id,
    name: displayName,
    sku,
  };
}

// ---------------------------------------------------------------------------
// Step 2: Create or find Family Contact
// ---------------------------------------------------------------------------
export async function createFamilyContact({
  firstName,
  lastName,
  email,
  phone = "",
}) {
  if (!SF_LIVE) return { success: false, mock: true };
  const { sfQuery, sfCreate } = await import("@/lib/salesforce");

  // Dedup by email
  if (email) {
    const existing = await sfQuery(
      `SELECT Id, Name, Email FROM Contact WHERE Email = '${email.replace(/'/g, "\\'")}' LIMIT 1`
    );
    if (existing.length > 0) {
      return {
        success: true,
        contactId: existing[0].Id,
        name: existing[0].Name,
        wasExisting: true,
      };
    }
  }

  const contact = await sfCreate("Contact", {
    FirstName: firstName,
    LastName: lastName,
    Email: email || null,
    Phone: phone || null,
  });

  return {
    success: true,
    contactId: contact.id,
    name: `${firstName} ${lastName}`,
    wasExisting: false,
  };
}

// ---------------------------------------------------------------------------
// Step 3: Link Family Contact to Hero
// ---------------------------------------------------------------------------
export async function linkFamilyToHero(heroId, contactId, relationship = "Surviving Family") {
  if (!SF_LIVE) return { success: false, mock: true };
  const { sfCreate, sfUpdate } = await import("@/lib/salesforce");

  // Create Hero_Association__c junction record
  const assoc = await sfCreate("Hero_Association__c", {
    Memorial_Bracelet__c: heroId,
    Contact__c: contactId,
    Role__c: relationship,
  });

  // Set the primary family contact on the bracelet
  await sfUpdate("Memorial_Bracelet__c", heroId, {
    Associated_Family_Contact__c: contactId,
  });

  return {
    success: true,
    associationId: assoc.id,
  };
}

// ---------------------------------------------------------------------------
// Step 4: Set Charity Designation (Account lookup)
// ---------------------------------------------------------------------------
export async function setCharityDesignation(heroId, orgName) {
  if (!SF_LIVE) return { success: false, mock: true };
  const { sfQuery, sfCreate, sfUpdate } = await import("@/lib/salesforce");

  // Search for existing Account
  const safeName = orgName.replace(/'/g, "\\'");
  const existing = await sfQuery(
    `SELECT Id, Name FROM Account WHERE Name LIKE '%${safeName}%' LIMIT 5`
  );

  let accountId;
  let wasExisting = false;

  if (existing.length > 0) {
    // Use first match
    accountId = existing[0].Id;
    wasExisting = true;
  } else {
    // Create new Account
    const account = await sfCreate("Account", { Name: orgName });
    accountId = account.id;
  }

  await sfUpdate("Memorial_Bracelet__c", heroId, {
    Associated_Organization__c: accountId,
  });

  return {
    success: true,
    accountId,
    orgName: wasExisting ? existing[0].Name : orgName,
    wasExisting,
  };
}

// ---------------------------------------------------------------------------
// Step 5: Set Design Brief
// ---------------------------------------------------------------------------
export async function setDesignBrief(heroId, designBrief) {
  if (!SF_LIVE) return { success: false, mock: true };
  const { sfUpdate } = await import("@/lib/salesforce");

  await sfUpdate("Memorial_Bracelet__c", heroId, {
    Design_Status__c: "Queued",
    Design_Brief__c: designBrief,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Get active intakes (recently created heroes not yet fully onboarded)
// ---------------------------------------------------------------------------
export async function getActiveIntakes() {
  if (!SF_LIVE) return [];
  const { sfQuery } = await import("@/lib/salesforce");

  // Heroes with Active_Listing__c = false (still in intake pipeline)
  const heroes = await sfQuery(`
    SELECT
      Id, Name, First_Name__c, Last_Name__c, Rank__c,
      Service_Academy_or_Branch__c, Memorial_Date__c,
      Lineitem_sku__c, Design_Status__c, Design_Brief__c,
      Active_Listing__c,
      Associated_Family_Contact__c,
      Associated_Family_Contact__r.Name,
      Associated_Family_Contact__r.Email,
      Associated_Organization__c,
      Associated_Organization__r.Name,
      CreatedDate
    FROM Memorial_Bracelet__c
    WHERE Active_Listing__c = false
    ORDER BY CreatedDate DESC
  `);

  // Check which have donated orders
  const heroIds = heroes.map((h) => `'${h.Id}'`).join(",");
  let orders = [];
  if (heroIds) {
    orders = await sfQuery(`
      SELECT Memorial_Bracelet__c, COUNT(Id) cnt
      FROM Squarespace_Order_Item__c
      WHERE Memorial_Bracelet__c IN (${heroIds})
      GROUP BY Memorial_Bracelet__c
    `);
  }
  const orderMap = new Map(orders.map((o) => [o.Memorial_Bracelet__c, o.cnt]));

  return heroes.map((h) => ({
    heroId: h.Id,
    name: h.Name,
    firstName: h.First_Name__c,
    lastName: h.Last_Name__c,
    rank: h.Rank__c,
    branch: h.Service_Academy_or_Branch__c,
    memorialDate: h.Memorial_Date__c,
    sku: h.Lineitem_sku__c,
    designStatus: h.Design_Status__c,
    designBrief: h.Design_Brief__c,
    createdDate: h.CreatedDate,
    // Intake step completion flags
    steps: {
      heroCreated: true,
      familyLinked: !!h.Associated_Family_Contact__c,
      charitySet: !!h.Associated_Organization__c,
      designBriefSet: !!h.Design_Brief__c,
      orderCreated: (orderMap.get(h.Id) || 0) > 0,
    },
    familyContact: h.Associated_Family_Contact__c
      ? {
          id: h.Associated_Family_Contact__c,
          name: h.Associated_Family_Contact__r?.Name,
          email: h.Associated_Family_Contact__r?.Email,
        }
      : null,
    charity: h.Associated_Organization__c
      ? {
          id: h.Associated_Organization__c,
          name: h.Associated_Organization__r?.Name,
        }
      : null,
  }));
}
