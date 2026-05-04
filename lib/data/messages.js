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
    braceletId: r.hero_id || null,
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
  // heroes.family_contact_id FK points to contacts_legacy in this project.
  // Postgrest caps responses at 1000 rows; paginate to get the full backlog.
  const PAGE = 1000;
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("family_messages")
      .select(`
        *,
        hero:heroes!hero_id(
          name, lineitem_sku, family_contact_id,
          family_contact:contacts_legacy!family_contact_id(first_name, last_name, email)
        )
      `)
      .order("submitted_date", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Supabase family_messages query failed: ${error.message}`);
    const rows = data || [];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
    if (from > 50000) break; // safety stop
  }
  return all.map(mapRecord);
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

// ---------------------------------------------------------------------------
// Real-time capture from Squarespace order intake
// ---------------------------------------------------------------------------

/**
 * Strip size/variant suffix from a SKU so it matches heroes.lineitem_sku.
 * ARMY-STEVENSON-7D → ARMY-STEVENSON
 */
function toBaseSku(sku) {
  if (!sku) return "";
  return sku
    .replace(/-[67]D$/i, "")
    .replace(/-[67]$/i, "")
    .replace(/-D$/i, "");
}

async function findHeroBySku(sb, sku) {
  if (!sku) return { id: null, name: null };
  const base = toBaseSku(sku);
  if (!base) return { id: null, name: null };
  const { data } = await sb
    .from("heroes")
    .select("id, name")
    .ilike("lineitem_sku", base)
    .limit(1)
    .maybeSingle();
  return { id: data?.id ?? null, name: data?.name ?? null };
}

/**
 * Capture a Squarespace tribute message into family_messages.
 *
 * Called by processIncomingOrder when an order arrives with customerMessage
 * (Squarespace's "Notes / instructions for seller" field — purchasers use it
 * to write a tribute about the fallen service member).
 *
 * One row per unique hero in the order. Items that don't resolve to a hero
 * are bucketed by SKU so we still capture the message even when the bracelet
 * isn't yet in the heroes table.
 *
 * Idempotent — pre-checks by (order_ref, hero_id, message) to avoid
 * duplicates when the cron re-fetches the same order, and to skip rows
 * already imported from Salesforce by migrate-sf-to-supabase.
 *
 * @param {Object} sb            Supabase client
 * @param {Object} input
 * @param {string} input.orderNumber
 * @param {string} input.customerMessage   Raw Squarespace customerMessage
 * @param {string} input.billingName
 * @param {string} input.billingEmail
 * @param {Array}  input.items             [{ sku, productName, quantity, ... }]
 * @param {string} input.orderDate         ISO string or YYYY-MM-DD
 *
 * @returns {{ inserted: number, skipped: number, reason?: string, errors: string[] }}
 */
export async function captureFamilyMessagesFromOrder(sb, {
  orderNumber,
  customerMessage,
  billingName,
  billingEmail,
  items = [],
  orderDate,
}) {
  const message = (customerMessage ?? "").trim();
  if (!message) return { inserted: 0, skipped: 0, reason: "no_message", errors: [] };

  if (isSpam(billingName || "", message)) {
    return { inserted: 0, skipped: 0, reason: "spam", errors: [] };
  }

  // Group order items by hero_id (or by SKU when the hero isn't matched yet).
  // This produces one family_message per distinct hero/bracelet in the order.
  const buckets = new Map();
  for (const item of items) {
    const sku = item.sku || "";
    const hero = await findHeroBySku(sb, sku);
    const key = hero.id || `__sku__${sku || "unknown"}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        hero_id: hero.id,
        hero_name: hero.name,
        sku: sku || null,
        item_description: item.productName || null,
      });
    }
  }

  // No items at all (rare, but possible) — still capture the tribute, unlinked.
  if (buckets.size === 0) {
    buckets.set("__none__", { hero_id: null, hero_name: null, sku: null, item_description: null });
  }

  const submittedDate = orderDate ? String(orderDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const errors = [];
  let inserted = 0;
  let skipped = 0;

  for (const bucket of buckets.values()) {
    try {
      // Idempotency pre-check: an existing row keyed on (order_ref, message) +
      // matching hero_id covers both prior cron runs (which set dedup_hash) and
      // SF-migrated rows (which have null dedup_hash but populated order_ref).
      let existsQuery = sb
        .from("family_messages")
        .select("id")
        .eq("order_ref", orderNumber)
        .eq("message", message);

      existsQuery = bucket.hero_id
        ? existsQuery.eq("hero_id", bucket.hero_id)
        : existsQuery.is("hero_id", null);

      const { data: existing } = await existsQuery.maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }

      const dedupHash = await computeDedupHash(
        bucket.hero_name || bucket.sku || bucket.item_description || "",
        billingEmail || billingName || "",
        message
      );

      const { error: insertErr } = await sb.from("family_messages").insert({
        hero_id: bucket.hero_id,
        message,
        from_name: billingName || null,
        from_email: billingEmail || null,
        source: "Squarespace Purchase",
        item_description: bucket.item_description,
        order_ref: orderNumber,
        sku: bucket.sku,
        submitted_date: submittedDate,
        status: "new",
        consent_to_share: false,
        wants_memorial_updates: false,
        dedup_hash: dedupHash,
      });

      if (insertErr) {
        // dedup_hash UNIQUE collision — another path beat us to it. Treat as skip.
        if (insertErr.code === "23505") {
          skipped++;
        } else {
          errors.push(`hero=${bucket.hero_id ?? "none"}: ${insertErr.message}`);
        }
      } else {
        inserted++;
      }
    } catch (err) {
      errors.push(`hero=${bucket.hero_id ?? "none"}: ${err.message}`);
    }
  }

  return { inserted, skipped, errors };
}
