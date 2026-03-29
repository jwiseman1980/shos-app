// ---------------------------------------------------------------------------
// Family Message data layer — reads family_messages from Supabase
// ---------------------------------------------------------------------------

import { getServerClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Text normalization (ported from family_message_pipeline.py per FM-STD-004)
// ---------------------------------------------------------------------------

function normalizeText(text) {
  if (!text) return "";
  let t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  t = t.toLowerCase();
  t = t.replace(/^dear family[,:]?\s*/i, "");
  t = t.replace(/^to the family of\s+/i, "");
  t = t.replace(/^to the .+ family[,:]?\s*/i, "");
  t = t.replace(/^dear .+ family[,:]?\s*/i, "");
  t = t.replace(/[^a-z0-9]/g, "");
  return t;
}

function normalizeHeroName(name) {
  if (!name) return "";
  let n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  n = n.toLowerCase().trim();
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
  n = n.replace(/\([^)]*\)/g, "");
  n = n.replace(/"[^"]*"/g, "");
  n = n.replace(/'[^']*'/g, "");
  n = n.replace(/[^a-z ]/g, "");
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

/**
 * Compute SHA256 dedup hash — same algorithm as family_message_pipeline.py
 */
async function computeDedupHash(heroName, senderIdentifier, messageText) {
  const hero = normalizeHeroName(heroName || "");
  const sender = normalizeText(senderIdentifier || "");
  const msg = normalizeText((messageText || "").slice(0, 100));
  const key = `${hero}|${sender}|${msg}`;
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
// Supabase queries
// ---------------------------------------------------------------------------

function mapRecord(r) {
  const hero = r.hero || {};
  const familyContact = hero.family_contact || {};
  return {
    sfId: r.sf_id || r.id,
    id: r.id,
    name: r.name,
    message: r.message || "",
    fromName: r.from_name || "",
    fromEmail: r.from_email || "",
    itemDescription: r.item_description || "",
    orderId: r.order_id || "",
    sku: r.sku || "",
    submittedDate: r.submitted_date || null,
    source: r.source || "",
    status: r.status || "New",
    consentToShare: Boolean(r.consent_to_share),
    wantsUpdates: Boolean(r.wants_memorial_updates),
    braceletId: r.memorial_bracelet_id || null,
    braceletName: hero.name || null,
    braceletSku: hero.lineitem_sku || null,
    familyContactId: hero.family_contact_id || null,
    familyContactName: familyContact.first_name
      ? [familyContact.first_name, familyContact.last_name].filter(Boolean).join(" ")
      : null,
    familyContactEmail: familyContact.email || null,
  };
}

async function fetchMessagesFromSupabase() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("family_messages")
    .select(`
      *,
      hero:heroes!memorial_bracelet_id(
        name, lineitem_sku, family_contact_id,
        family_contact:contacts!family_contact_id(first_name, last_name, email)
      )
    `)
    .order("submitted_date", { ascending: false });

  if (error) throw new Error(`Supabase family_messages query failed: ${error.message}`);
  return (data || []).map(mapRecord);
}

async function loadMessages() {
  try {
    return await fetchMessagesFromSupabase();
  } catch (err) {
    console.error("Supabase Family_Message query failed:", err.message);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All family message records */
export async function getAllMessages() {
  return loadMessages();
}

/** Messages grouped by hero/bracelet with computed stats */
export async function getMessagesGroupedByHero() {
  const all = await loadMessages();

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

  const heroIds = new Set(linked.map((m) => m.braceletId));

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

  const duplicateGroups = Object.entries(hashGroups)
    .filter(([, msgs]) => msgs.length > 1)
    .map(([hash, msgs]) => {
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

  const spamRecords = all.filter((m) => isSpam(m.fromName, m.message));

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
      duplicates: duplicateGroups.slice(0, 20),
      spam: spamRecords.slice(0, 10),
    },
  };
}

export { normalizeText, normalizeHeroName, computeDedupHash, isSpam };
