/**
 * init-coo-knowledge.mjs
 * Queries Salesforce and initializes the COO knowledge file in SHOS_Knowledge__c.
 *
 * Field corrections from schema discovery (2026-03-28):
 *   - Orders:     Fulfillment_Status__c (not Order_Status__c), Order_Total__c (not Total_Price__c)
 *   - Order Items: Production_Status__c (not Item_Status__c), Lineitem_sku__c (not SKU__c),
 *                  Memorial_Bracelet__c (not Hero__c)
 *   - Heroes:     Memorial_Bracelet__c object (Hero__c does not exist),
 *                  Pipeline_Stage__c (not Intake_Status__c),
 *                  Service_Academy_or_Branch__c (not Branch__c)
 *   - SHOS_Knowledge__c: Only base fields exist in org (no Role__c, Content__c, etc.)
 *     The record is saved with Name only; markdown is also written to a local file.
 *
 * Run with: node scripts/init-coo-knowledge.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../.env.local');

function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key && !(key in process.env)) process.env[key] = value;
    }
    console.log(`[env] Loaded from ${filePath}`);
  } catch (err) {
    console.error(`[env] Failed to load ${filePath}:`, err.message);
    process.exit(1);
  }
}

loadEnv(envPath);

// ---------------------------------------------------------------------------
// Salesforce auth — refresh token flow
// ---------------------------------------------------------------------------
const SF_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';
const API_VERSION = 'v62.0';

let cachedAuth = null;
let cacheTime = 0;
const CACHE_TTL = 55 * 60 * 1000;

async function authenticate() {
  const now = Date.now();
  if (cachedAuth && now - cacheTime < CACHE_TTL) return cachedAuth;

  const { SF_CLIENT_ID: clientId, SF_REFRESH_TOKEN: refreshToken, SF_INSTANCE_URL: instanceUrl } = process.env;
  if (!clientId || !refreshToken) throw new Error('Missing SF_CLIENT_ID or SF_REFRESH_TOKEN');

  const params = new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken });
  const res = await fetch(SF_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Salesforce auth failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  cachedAuth = {
    accessToken: data.access_token,
    instanceUrl: data.instance_url || instanceUrl || 'https://steelheartsincorporated.my.salesforce.com',
  };
  cacheTime = now;
  return cachedAuth;
}

function clearAuthCache() { cachedAuth = null; cacheTime = 0; }

async function sfFetch(path, options = {}) {
  let auth = await authenticate();
  const makeReq = (a) =>
    fetch(`${a.instanceUrl}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${a.accessToken}`, 'Content-Type': 'application/json', ...options.headers },
    });

  let res = await makeReq(auth);
  if (res.status === 401) {
    clearAuthCache();
    auth = await authenticate();
    res = await makeReq(auth);
  }
  return res;
}

async function sfQuery(soql) {
  const encoded = encodeURIComponent(soql);
  let allRecords = [];
  let nextUrl = `/services/data/${API_VERSION}/query?q=${encoded}`;
  while (nextUrl) {
    const res = await sfFetch(nextUrl);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`SOQL query failed (${res.status}): ${err}`);
    }
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    nextUrl = data.nextRecordsUrl || null;
  }
  return allRecords;
}

async function sfCreate(objectName, data) {
  const res = await sfFetch(`/services/data/${API_VERSION}/sobjects/${objectName}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Create ${objectName} failed (${res.status}): ${err}`);
  }
  return res.json();
}

async function sfUpdate(objectName, id, data) {
  const res = await sfFetch(`/services/data/${API_VERSION}/sobjects/${objectName}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (res.status !== 204 && !res.ok) {
    const err = await res.text();
    throw new Error(`Update ${objectName}/${id} failed (${res.status}): ${err}`);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function today() { return new Date().toISOString().slice(0, 10); }

function formatDatetime(isoStr) {
  if (!isoStr) return 'N/A';
  return new Date(isoStr).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function currency(val) {
  if (val == null) return 'N/A';
  return `$${Number(val).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n=== COO Knowledge File Initializer ===\n');
  console.log(`Date: ${today()}`);
  console.log('Authenticating with Salesforce...');
  await authenticate();
  console.log('Auth OK.\n');

  // -------------------------------------------------------------------------
  // 1. Salesforce queries — using correct field names discovered from schema
  // -------------------------------------------------------------------------
  console.log('Running Salesforce queries...');

  // Active orders: not Fulfilled and not Cancelled (Fulfillment_Status__c)
  const activeOrders = await sfQuery(
    `SELECT Id, Name, Fulfillment_Status__c, Order_Type__c, Order_Total__c, Shipping_Name__c, Manufactured__c, CreatedDate FROM Squarespace_Order__c WHERE Fulfillment_Status__c NOT IN ('Fulfilled', 'Cancelled', 'cancelled') ORDER BY CreatedDate DESC LIMIT 50`
  );

  // Hero intake pipeline — Memorial_Bracelet__c with a Pipeline_Stage__c set
  const heroPipeline = await sfQuery(
    `SELECT Id, Name, Service_Academy_or_Branch__c, Pipeline_Stage__c, Active_Listing__c, Design_Status__c, Lineitem_sku__c FROM Memorial_Bracelet__c WHERE Pipeline_Stage__c != null ORDER BY CreatedDate DESC LIMIT 20`
  );

  // Order items needing attention (not yet shipped)
  const needsAttentionItems = await sfQuery(
    `SELECT Id, Name, Lineitem_sku__c, Production_Status__c, Memorial_Bracelet__c, Squarespace_Order__c FROM Squarespace_Order_Item__c WHERE Production_Status__c IN ('Needs Decision', 'Design Needed', 'Ready to Ship') ORDER BY CreatedDate DESC LIMIT 30`
  );

  // Orders with items ready to ship (via order item Production_Status__c)
  const readyToShipItems = await sfQuery(
    `SELECT Id, Name, Lineitem_sku__c, Production_Status__c, Memorial_Bracelet__c, Squarespace_Order__c FROM Squarespace_Order_Item__c WHERE Production_Status__c = 'Ready to Ship' LIMIT 20`
  );

  console.log(`Active orders (non-Fulfilled/Cancelled): ${activeOrders.length}`);
  console.log(`Heroes in pipeline: ${heroPipeline.length}`);
  console.log(`Order items needing attention: ${needsAttentionItems.length}`);
  console.log(`Order items ready to ship: ${readyToShipItems.length}\n`);

  // -------------------------------------------------------------------------
  // 2. Compute summary stats
  // -------------------------------------------------------------------------
  const statusCounts = {};
  for (const o of activeOrders) {
    const s = o.Fulfillment_Status__c || 'No Status Set';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  const stageCounts = {};
  for (const h of heroPipeline) {
    const s = h.Pipeline_Stage__c || 'Unknown';
    stageCounts[s] = (stageCounts[s] || 0) + 1;
  }

  const itemStatusCounts = {};
  for (const i of needsAttentionItems) {
    const s = i.Production_Status__c || 'Unknown';
    itemStatusCounts[s] = (itemStatusCounts[s] || 0) + 1;
  }

  const activeListingCount = heroPipeline.filter(h => h.Active_Listing__c).length;
  const needsDecisionCount = itemStatusCounts['Needs Decision'] || 0;
  const designNeededCount  = itemStatusCounts['Design Needed'] || 0;
  const readyToShipCount   = itemStatusCounts['Ready to Ship'] || 0;

  const manufacturedOrders = activeOrders.filter(o => o.Manufactured__c).length;
  const unmanufacturedOrders = activeOrders.filter(o => !o.Manufactured__c).length;

  // -------------------------------------------------------------------------
  // 3. Build markdown sections
  // -------------------------------------------------------------------------
  const todayStr = today();
  const nowIso = new Date().toISOString();

  // --- Order status breakdown ---
  const orderStatusLines = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `- **${s}:** ${n}`)
    .join('\n') || '- No active orders';

  // --- Hero pipeline stage breakdown ---
  const stageLines = Object.entries(stageCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `- **${s}:** ${n}`)
    .join('\n') || '- No heroes in pipeline';

  // --- Active orders table ---
  const orderRows = activeOrders.map(o =>
    `| ${o.Name} | ${o.Shipping_Name__c || 'N/A'} | ${o.Fulfillment_Status__c || 'None'} | ${o.Order_Type__c || 'N/A'} | ${currency(o.Order_Total__c)} | ${o.Manufactured__c ? 'Yes' : 'No'} | ${formatDatetime(o.CreatedDate)} |`
  ).join('\n') || '| — | — | — | — | — | — | — |';

  // --- Hero pipeline table ---
  const heroRows = heroPipeline.map(h =>
    `| ${h.Name} | ${h.Service_Academy_or_Branch__c || 'N/A'} | ${h.Pipeline_Stage__c || 'N/A'} | ${h.Design_Status__c || 'Not Started'} | ${h.Lineitem_sku__c || 'N/A'} | ${h.Active_Listing__c ? 'Yes' : 'No'} |`
  ).join('\n') || '| — | — | — | — | — | — |';

  // --- Items needing attention table ---
  const itemRows = needsAttentionItems.map(i =>
    `| ${i.Name} | ${i.Lineitem_sku__c || 'N/A'} | ${i.Production_Status__c || 'N/A'} |`
  ).join('\n') || '| — | — | — |';

  // --- Ready to ship items table ---
  const shipItemRows = readyToShipItems.map(i =>
    `| ${i.Name} | ${i.Lineitem_sku__c || 'N/A'} | ${i.Production_Status__c} |`
  ).join('\n') || '| — | — | — |';

  // -------------------------------------------------------------------------
  // 4. Determine todos
  // -------------------------------------------------------------------------
  const blockingItems = [];
  const highPriorityItems = [];
  const queuedItems = [];

  if (readyToShipCount > 0) {
    blockingItems.push(`${readyToShipCount} order item(s) marked "Ready to Ship" — create ShipStation labels and ship packages immediately.`);
  }
  if (designNeededCount > 0) {
    highPriorityItems.push(`${designNeededCount} order item(s) with status "Design Needed" — create SVG files and schedule laser production run.`);
  }
  if (needsDecisionCount > 0) {
    highPriorityItems.push(`${needsDecisionCount} order item(s) with status "Needs Decision" — review and assign production path for each.`);
  }
  const familyOutreachHeroes = heroPipeline.filter(h => h.Pipeline_Stage__c === 'Family Outreach');
  if (familyOutreachHeroes.length > 0) {
    highPriorityItems.push(`${familyOutreachHeroes.length} hero(es) in Family Outreach stage — follow up with families to advance through pipeline.`);
  }
  const charityDesignHeroes = heroPipeline.filter(h => h.Pipeline_Stage__c === 'Charity Designation');
  if (charityDesignHeroes.length > 0) {
    queuedItems.push(`${charityDesignHeroes.length} hero(es) in Charity Designation stage — confirm designated charity before advancing to design.`);
  }
  const intakeHeroes = heroPipeline.filter(h => h.Pipeline_Stage__c === 'Intake');
  if (intakeHeroes.length > 0) {
    queuedItems.push(`${intakeHeroes.length} hero(es) in Intake stage — complete intake data collection.`);
  }
  if (unmanufacturedOrders > 0) {
    queuedItems.push(`${unmanufacturedOrders} active order(s) not yet marked as Manufactured — verify production status.`);
  }

  if (blockingItems.length === 0) blockingItems.push('None identified at this time.');
  if (highPriorityItems.length === 0) highPriorityItems.push('None identified at this time.');
  if (queuedItems.length === 0) queuedItems.push('Pipeline clear at this time.');

  // -------------------------------------------------------------------------
  // 5. Assemble full markdown
  // -------------------------------------------------------------------------
  const markdown = `# COO Knowledge File
**Role:** Chief Operating Officer
**Last Updated:** ${todayStr}
**Session Count:** 1

---

## Role Definition
The COO owns everything from hero intake request to bracelet on a family's wrist. Design files, laser production, ShipStation, inventory — the full physical product lifecycle.

---

## Current State (as of ${todayStr})

| Metric | Count |
|--------|-------|
| Active Orders (non-Fulfilled / non-Cancelled) | ${activeOrders.length} |
| Orders Manufactured | ${manufacturedOrders} |
| Orders Not Yet Manufactured | ${unmanufacturedOrders} |
| Heroes in Intake Pipeline | ${heroPipeline.length} |
| Heroes Active on Website | ${activeListingCount} |
| Order Items — Needs Decision | ${needsDecisionCount} |
| Order Items — Design Needed | ${designNeededCount} |
| Order Items — Ready to Ship | ${readyToShipCount} |

### Order Fulfillment Status Breakdown
${orderStatusLines}

### Hero Pipeline Stage Breakdown
${stageLines}

---

## Active Pipeline

### Heroes in Intake (Memorial_Bracelet__c)
| Name | Branch | Pipeline Stage | Design Status | SKU | Active Listing |
|------|--------|---------------|--------------|-----|---------------|
${heroRows}

---

## Orders Requiring Action

### Order Items — Ready to Ship
| Item Name | SKU | Status |
|-----------|-----|--------|
${shipItemRows}

### Order Items — Needs Decision / Design Needed
| Item Name | SKU | Status |
|-----------|-----|--------|
${itemRows}

### All Active Orders
| Order # | Recipient | Status | Type | Total | Manufactured | Created |
|---------|-----------|--------|------|-------|-------------|---------|
${orderRows}

---

## Active Todos

### Blocking
${blockingItems.map(i => `- ${i}`).join('\n')}

### High Priority
${highPriorityItems.map(i => `- ${i}`).join('\n')}

### Queued
${queuedItems.map(i => `- ${i}`).join('\n')}

---

## SOPs Referenced
- COO-001: Hero intake process
- COO-002: Laser production run
- COO-003: ShipStation fulfillment

---

## Salesforce Schema Reference

### Objects
- **Orders:** Squarespace_Order__c
- **Order Items:** Squarespace_Order_Item__c
- **Heroes / Bracelets:** Memorial_Bracelet__c (Note: there is no Hero__c object)

### Key Field Names (corrected from initial spec)
| Concept | Object | Field |
|---------|--------|-------|
| Order status | Squarespace_Order__c | Fulfillment_Status__c |
| Order total | Squarespace_Order__c | Order_Total__c |
| Item production status | Squarespace_Order_Item__c | Production_Status__c |
| Item SKU | Squarespace_Order_Item__c | Lineitem_sku__c |
| Hero link on item | Squarespace_Order_Item__c | Memorial_Bracelet__c |
| Hero branch | Memorial_Bracelet__c | Service_Academy_or_Branch__c |
| Hero pipeline stage | Memorial_Bracelet__c | Pipeline_Stage__c |
| Hero design status | Memorial_Bracelet__c | Design_Status__c |

### Key Order Fulfillment Statuses
Pending, Unfulfilled, Ready to Ship, Fulfilled, Cancelled, cancelled

### Key Production Statuses (Order Items)
Needs Decision, Design Needed, Ready to Ship, Shipped

### Key Pipeline Stages (Memorial_Bracelet__c)
Intake, Family Outreach, Charity Designation, Design, Production, Donated Fulfillment, Website Listing, Active, Research, Sunset

### Note on SHOS_Knowledge__c
As of ${todayStr}, the SHOS_Knowledge__c object only has base Salesforce fields (Id, Name, CreatedDate, etc.).
Custom fields (Role__c, Content__c, Last_Updated__c, Session_Count__c) have not been deployed to this org.
This record was created with Name = 'COO Knowledge' as a placeholder. Deploy the custom fields to enable
full knowledge file storage in Salesforce.

---

## Decision Log
| Date | Decision | Reasoning |
|------|----------|-----------|
| ${todayStr} | Knowledge file initialized | First COO session — baseline state documented from live SF data |
| ${todayStr} | Corrected field names from schema | Hero__c does not exist; Memorial_Bracelet__c is the correct object. Order_Status__c → Fulfillment_Status__c. Item_Status__c → Production_Status__c. SKU__c → Lineitem_sku__c. |

---

## Session Log
| Date | Summary |
|------|---------|
| ${todayStr} | Initial knowledge file created from SF data pull. Found ${activeOrders.length} active orders, ${heroPipeline.length} heroes in pipeline, ${needsAttentionItems.length} items needing attention (${needsDecisionCount} Needs Decision, ${designNeededCount} Design Needed, ${readyToShipCount} Ready to Ship). SHOS_Knowledge__c missing custom fields — record saved with Name only; markdown saved locally as well. |
`;

  // -------------------------------------------------------------------------
  // 6. Print the markdown
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log('GENERATED COO KNOWLEDGE FILE:');
  console.log('='.repeat(70) + '\n');
  console.log(markdown);
  console.log('='.repeat(70) + '\n');

  // -------------------------------------------------------------------------
  // 7. Save markdown locally as backup
  // -------------------------------------------------------------------------
  const localPath = resolve(__dirname, '../coo-knowledge.md');
  writeFileSync(localPath, markdown, 'utf8');
  console.log(`[local] Markdown written to: ${localPath}`);

  // -------------------------------------------------------------------------
  // 8. Upsert to SHOS_Knowledge__c
  //    The object exists but only has base fields. We save Name as a placeholder.
  //    If custom fields are later deployed, extend this payload.
  // -------------------------------------------------------------------------
  console.log('\nChecking for existing SHOS_Knowledge__c record (Name = "COO Knowledge")...');

  let existingRecords;
  try {
    existingRecords = await sfQuery(`SELECT Id, Name FROM SHOS_Knowledge__c WHERE Name = 'COO Knowledge' LIMIT 1`);
  } catch (err) {
    console.warn('[SF] Could not query SHOS_Knowledge__c:', err.message);
    existingRecords = [];
  }

  // SHOS_Knowledge__c has Name as an auto-number field (not writable).
  // No custom fields (Role__c, Content__c, etc.) have been deployed to this org yet.
  // We create an empty record as a placeholder — the auto-number Name is assigned by SF.
  let sfNote = '';

  if (existingRecords.length > 0) {
    const recordId = existingRecords[0].Id;
    console.log(`Found existing record: ${recordId}. Custom fields not deployed — no content update possible.`);
    sfNote = `Existing placeholder record: ${recordId}. Deploy custom fields (Content__c, Role__c, Last_Updated__c, Session_Count__c) to store full markdown in SF.`;
    console.log(`[SF] ${sfNote}`);
  } else {
    console.log('No existing record found. Creating placeholder record (Name is auto-number, no payload needed)...');
    try {
      // Empty POST — Name is auto-assigned, no custom fields exist yet
      const result = await sfCreate('SHOS_Knowledge__c', {});
      sfNote = `New placeholder record created: ${result.id} (auto-name). Deploy custom fields to store full markdown content in SF.`;
      console.log(`\n[SF] POST complete. ${sfNote}`);
    } catch (err) {
      sfNote = `Failed to create SHOS_Knowledge__c record: ${err.message}`;
      console.warn(`\n[SF] ${sfNote}`);
    }
  }

  // -------------------------------------------------------------------------
  // 9. Summary
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Date:                    ${todayStr}`);
  console.log(`Active orders:           ${activeOrders.length} (${manufacturedOrders} manufactured, ${unmanufacturedOrders} not)`);
  console.log(`Heroes in pipeline:      ${heroPipeline.length} (${activeListingCount} active on website)`);
  console.log(`Items needing attention: ${needsAttentionItems.length} (${needsDecisionCount} Needs Decision, ${designNeededCount} Design Needed, ${readyToShipCount} Ready to Ship)`);
  console.log(`Local markdown:          ${localPath}`);
  console.log(`Salesforce:              ${sfNote}`);
  console.log('='.repeat(70) + '\n');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
