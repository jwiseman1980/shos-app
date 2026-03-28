/**
 * write-knowledge.mjs [role]
 *
 * Pushes a role knowledge file to SHOS_Knowledge__c in Salesforce.
 *
 * Usage:
 *   node scripts/write-knowledge.mjs coo
 *   node scripts/write-knowledge.mjs cos
 *   node scripts/write-knowledge.mjs cfo
 *   node scripts/write-knowledge.mjs comms
 *   node scripts/write-knowledge.mjs dev
 *   node scripts/write-knowledge.mjs family
 *   node scripts/write-knowledge.mjs ed
 *
 * Reads:  [role]-knowledge.md from project root
 * Writes: SHOS_Knowledge__c with Role__c = [role]
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const role = process.argv[2]?.toLowerCase();
const VALID_ROLES = ["ed", "cos", "cfo", "coo", "comms", "dev", "family"];

if (!role || !VALID_ROLES.includes(role)) {
  console.error(`Usage: node scripts/write-knowledge.mjs [role]`);
  console.error(`Valid roles: ${VALID_ROLES.join(", ")}`);
  process.exit(1);
}

const knowledgePath = join(__dirname, `../${role}-knowledge.md`);
let content;
try {
  content = readFileSync(knowledgePath, "utf8");
} catch {
  console.error(`✗ Knowledge file not found: ${knowledgePath}`);
  console.error(`  Create ${role}-knowledge.md in the project root first.`);
  process.exit(1);
}

// Load env
const envPath = join(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const SF_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
const API_VERSION = "v62.0";

async function authenticate() {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.SF_CLIENT_ID,
    refresh_token: process.env.SF_REFRESH_TOKEN,
  });
  const res = await fetch(SF_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);
  const data = await res.json();
  return { accessToken: data.access_token, instanceUrl: data.instance_url };
}

async function sfFetch(auth, path, options = {}) {
  const res = await fetch(`${auth.instanceUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

async function main() {
  const auth = await authenticate();
  console.log(`✓ Authenticated — pushing ${role} knowledge file`);

  // Find existing record for this role
  const queryRes = await sfFetch(auth,
    `/services/data/${API_VERSION}/query?q=${encodeURIComponent(
      `SELECT Id, Name FROM SHOS_Knowledge__c WHERE Role__c = '${role}' LIMIT 1`
    )}`
  );
  const queryData = await queryRes.json();
  let existing = queryData.records?.[0];

  const now = new Date().toISOString();
  const payload = {
    Role__c: role,
    Content__c: content,
    Last_Updated__c: now,
  };

  if (existing) {
    // Update existing — increment session count
    const updateRes = await sfFetch(auth,
      `/services/data/${API_VERSION}/sobjects/SHOS_Knowledge__c/${existing.Id}`,
      { method: "PATCH", body: JSON.stringify(payload) }
    );
    if (updateRes.status === 204) {
      console.log(`✓ Updated ${role.toUpperCase()} knowledge record (${existing.Id})`);
    } else {
      const err = await updateRes.text();
      throw new Error(`Update failed: ${err}`);
    }
  } else {
    // Create new record
    const createRes = await sfFetch(auth,
      `/services/data/${API_VERSION}/sobjects/SHOS_Knowledge__c`,
      { method: "POST", body: JSON.stringify(payload) }
    );
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(`Create failed: ${JSON.stringify(createData)}`);
    console.log(`✓ Created ${role.toUpperCase()} knowledge record (${createData.id})`);
  }

  console.log(`✓ Content length: ${content.length} chars`);
  console.log(`  File: ${knowledgePath}`);
}

main().catch(e => { console.error("✗", e.message); process.exit(1); });
