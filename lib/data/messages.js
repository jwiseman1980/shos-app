// ---------------------------------------------------------------------------
// Family Message data layer — reads Family_Message__c from Salesforce
// Follows the same pattern as lib/data/heroes.js: SF_LIVE toggle + fallback
// ---------------------------------------------------------------------------

const useSalesforce = process.env.SF_LIVE === "true";

// ---------------------------------------------------------------------------
// Text normalization (ported from family_message_pipeline.py per FM-STD-004)
// ---------------------------------------------------------------------------

function normalizeText(text) {
  if (!text) return "";
  // Remove diacritics
  let t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  t = t.toLowerCase();
  // Remove common message prefixes
  t = t.replace(/^dear family[,:]?\s*/i, "");
  t = t.replace(/^to the family of\s+/i, "");
  t = t.replace(/^to the .+ family[,:]?\s*/i, "");
  t = t.replace(/^dear .+ family[,:]?\s*/i, "");
  // Strip non-alphanumeric
  t = t.replace(/[^a-z0-9]/g, "");
  return t;
}

function normalizeHeroName(name) {
  if (!name) return "";
  let n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  n = n.toLowerCase().trim();
  // Remove rank prefixes
  const ranks = [
    /\bcpt\.?\b/g, /\b1lt\.?\b/g, /\b2lt\.?\b/g, /\blt\.?\b/g,
    /\bmaj\.?\b/g, /\bcol\.?\b/g, /\bltc\.?\b/g, /\bltcol\.?\b/g,
    /\bssg\.?\b/g, /\bsgt\.?\b/g, /\bsfc\.?\b/g, /\bcsm\.?\b/g,
    /\bpfc\.?\b/g, /\bspc\.?\b/g, /\bcpl\.?\b/g, /\bcw[0-5]\.?\b/g,
    /\bcdr\.?\b/g, /\blcdr\.?\b/g, /\bltjg\.?\b/g, /\bens\.?\b/g,
    /\bcapt\.?\b/g, /\bgysgt\.?\b/g, /\bssgt\.?\b/g, /\blcpl\.?\b/g,
  ];
  for (const rank of ranks) {
    n = n.replace(rank, "");
  }
  // Remove parenthetical (USMA '17) etc
  n = n.replace(/\([^)]*\)/g, "");
  // Remove quoted nicknames
  n = n.replace(/"[^"]*"/g, "");
  n = n.replace(/'[^']*'/g, "");
  // Strip non-alpha (keep spaces)
  n = n.replace(/[^a-z ]/g, "");
  // Collapse whitespace
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

/**
 * Compute SHA256 dedup hash — same algorithm as family_message_pipeline.py
 * Key: normalized hero name + sender email/name + first 100 chars of message
 */
async function computeDedupHash(heroName, senderIdentifier, messageText) {
  const hero = normalizeHeroName(heroName || "");
  const sender = normalizeText(senderIdentifier || "");
  const msg = normalizeText((messageText || "").slice(0, 100));
  const key = `${hero}|${sender}|${msg}`;
  // Use Web Crypto API (available in Node 18+ and Edge Runtime)
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Detect spam (ported from family_message_pipeline.py)
 */
function isSpam(name, message) {
  for (const field of [name, message]) {
    if (field && field.length > 8) {
      const alpha = [...field].filter((c) => /[a-zA-Z]/.test(c)).length;
      const spaces = [...field].filter((c) => c === " ").length;
      if (alpha > 10 && spaces === 0 && field.length > 12) {
        const upper = [...field].filter((c) => /[A-Z]/.test(c)).length;
        const lower = [...field].filter((c) => /[a-z]/.test(c)).length;
        if (upper > 3 && lower > 3 && field.length > 15) {
          return true;
        }
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Salesforce queries
// ---------------------------------------------------------------------------

const MESSAGES_SOQL = `
  SELECT
    Id,
    Name,
    Message__c,
    From_Name__c,
    From_Email__c,
    Item_Description__c,
    Order_ID__c,
    SKU__c,
    Submitted_Date__c,
    Source__c,
    Status__c,
    Consent_to_Share__c,
    Wants_Memorial_Updates__c,
    Memorial_Bracelet__c,
    Memorial_Bracelet__r.Name,
    Memorial_Bracelet__r.Lineitem_sku__c,
    Memorial_Bracelet__r.Associated_Family_Contact__c,
    Memorial_Bracelet__r.Associated_Family_Contact__r.Name,
    Memorial_Bracelet__r.Associated_Family_Contact__r.Email
  FROM Family_Message__c
  ORDER BY Memorial_Bracelet__r.Name ASC NULLS LAST, Submitted_Date__c DESC
`.trim();

function mapRecord(r) {
  return {
    sfId: r.Id,
    name: r.Name,
    message: r.Message__c || "",
    fromName: r.From_Name__c || "",
    fromEmail: r.From_Email__c || "",
    itemDescription: r.Item_Description__c || "",
    orderId: r.Order_ID__c || "",
    sku: r.SKU__c || "",
    submittedDate: r.Submitted_Date__c || null,
    source: r.Source__c || "",
    status: r.Status__c || "New",
    consentToShare: Boolean(r.Consent_to_Share__c),
    wantsUpdates: Boolean(r.Wants_Memorial_Updates__c),
    braceletId: r.Memorial_Bracelet__c || null,
    braceletName: r.Memorial_Bracelet__r?.Name || null,
    braceletSku: r.Memorial_Bracelet__r?.Lineitem_sku__c || null,
    familyContactId: r.Memorial_Bracelet__r?.Associated_Family_Contact__c || null,
    familyContactName: r.Memorial_Bracelet__r?.Associated_Family_Contact__r?.Name || null,
    familyContactEmail: r.Memorial_Bracelet__r?.Associated_Family_Contact__r?.Email || null,
  };
}

async function fetchMessagesFromSF() {
  const { sfQuery } = await import("@/lib/salesforce");
  const records = await sfQuery(MESSAGES_SOQL);
  return records.map(mapRecord);
}

async function loadMessages() {
  if (useSalesforce) {
    try {
      return await fetchMessagesFromSF();
    } catch (err) {
      console.error("SF Family_Message query failed:", err.message);
    }
  }
  // No JSON fallback for messages — SF is the only source
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All Family_Message__c records */
export async function getAllMessages() {
  return loadMessages();
}

/** Messages grouped by hero/bracelet with computed stats */
export async function getMessagesGroupedByHero() {
  const all = await loadMessages();

  // Group by braceletId (null = unmatched)
  const groups = {};
  for (const msg of all) {
    const key = msg.braceletId || "__unmatched__";
    if (!groups[key]) {
      groups[key] = {
        braceletId: msg.braceletId,
        braceletName: msg.braceletName,
        braceletSku: msg.braceletSku,
        familyContactId: msg.familyContactId,
        familyContactName: msg.familyContactName,
        familyContactEmail: msg.familyContactEmail,
        messages: [],
      };
    }
    groups[key].messages.push(msg);
  }

  // Compute per-group stats
  const heroGroups = Object.values(groups).map((g) => {
    const newCount = g.messages.filter((m) => m.status === "New").length;
    const readyCount = g.messages.filter((m) => m.status === "Ready to Send").length;
    const sentCount = g.messages.filter((m) => m.status === "Sent").length;
    const heldCount = g.messages.filter((m) => m.status === "Held").length;
    const uniqueSenders = new Set(
      g.messages.map((m) => (m.fromEmail || m.fromName || "unknown").toLowerCase())
    ).size;

    return {
      ...g,
      totalMessages: g.messages.length,
      newMessages: newCount,
      readyToSendMessages: readyCount,
      sentMessages: sentCount,
      heldMessages: heldCount,
      uniqueSenders,
      eligible: newCount + readyCount >= 6,
      isUnmatched: !g.braceletId,
    };
  });

  // Sort: eligible first, then by message count desc
  heroGroups.sort((a, b) => {
    if (a.isUnmatched !== b.isUnmatched) return a.isUnmatched ? 1 : -1;
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.totalMessages - a.totalMessages;
  });

  return heroGroups;
}

/** Messages with no bracelet link */
export async function getUnmatchedMessages() {
  const all = await loadMessages();
  return all.filter((m) => !m.braceletId);
}

/** Aggregate stats */
export async function getMessageStats() {
  const all = await loadMessages();
  const linked = all.filter((m) => m.braceletId);
  const unmatched = all.filter((m) => !m.braceletId);

  // Count unique heroes with messages
  const heroIds = new Set(linked.map((m) => m.braceletId));

  // Count heroes eligible (6+ new/ready)
  const heroCounts = {};
  for (const m of linked) {
    if (m.status === "New" || m.status === "Ready to Send") {
      heroCounts[m.braceletId] = (heroCounts[m.braceletId] || 0) + 1;
    }
  }
  const eligibleHeroes = Object.values(heroCounts).filter((c) => c >= 6).length;

  const sentCount = all.filter((m) => m.status === "Sent").length;

  return {
    totalMessages: all.length,
    linkedMessages: linked.length,
    unmatchedMessages: unmatched.length,
    heroesWithMessages: heroIds.size,
    eligibleHeroes,
    sentMessages: sentCount,
    newMessages: all.filter((m) => m.status === "New").length,
    readyToSend: all.filter((m) => m.status === "Ready to Send").length,
    heldMessages: all.filter((m) => m.status === "Held").length,
    bySource: {
      squarespace: all.filter((m) => m.source === "Squarespace Purchase").length,
      bioPage: all.filter((m) => m.source === "Bio Page Form").length,
      other: all.filter((m) => m.source !== "Squarespace Purchase" && m.source !== "Bio Page Form").length,
    },
  };
}

/** Find duplicate records using dedup hash */
export async function findDuplicates() {
  const all = await loadMessages();

  // Compute hash for each record
  const hashGroups = {};
  for (const msg of all) {
    const heroName = msg.braceletName || msg.sku || msg.itemDescription || "";
    const sender = msg.fromEmail || msg.fromName || "";
    const hash = await computeDedupHash(heroName, sender, msg.message);

    if (!hashGroups[hash]) {
      hashGroups[hash] = [];
    }
    hashGroups[hash].push({ ...msg, dedupHash: hash });
  }

  // Find groups with 2+ records (duplicates)
  const duplicateGroups = Object.entries(hashGroups)
    .filter(([, msgs]) => msgs.length > 1)
    .map(([hash, msgs]) => {
      // Sort by submittedDate asc — keep the oldest (first import)
      const sorted = msgs.sort((a, b) => {
        const da = a.submittedDate ? new Date(a.submittedDate) : new Date(0);
        const db = b.submittedDate ? new Date(b.submittedDate) : new Date(0);
        return da - db;
      });
      return {
        hash,
        keep: sorted[0],
        duplicates: sorted.slice(1),
        count: sorted.length,
      };
    });

  // Find spam records
  const spamRecords = all.filter((m) => isSpam(m.fromName, m.message));

  // IDs to delete (duplicates + spam)
  const duplicateIds = duplicateGroups.flatMap((g) => g.duplicates.map((d) => d.sfId));
  const spamIds = spamRecords.map((s) => s.sfId).filter((id) => !duplicateIds.includes(id));

  return {
    totalRecords: all.length,
    duplicateGroups: duplicateGroups.length,
    duplicateRecordsToDelete: duplicateIds.length,
    spamRecords: spamRecords.length,
    spamRecordsToDelete: spamIds.length,
    totalToDelete: duplicateIds.length + spamIds.length,
    deleteIds: [...duplicateIds, ...spamIds],
    details: {
      duplicates: duplicateGroups.slice(0, 20), // first 20 for preview
      spam: spamRecords.slice(0, 10), // first 10 for preview
    },
  };
}

export { normalizeText, normalizeHeroName, computeDedupHash, isSpam };
