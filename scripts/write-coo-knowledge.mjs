import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
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
  console.log("✓ Authenticated");

  const content = readFileSync(join(__dirname, "../coo-knowledge.md"), "utf8");

  // Check for existing record — first by Role__c, then any record (to claim the placeholder)
  const queryRes = await sfFetch(auth,
    `/services/data/${API_VERSION}/query?q=${encodeURIComponent("SELECT Id, Name FROM SHOS_Knowledge__c WHERE Role__c = 'coo' LIMIT 1")}`
  );
  const queryData = await queryRes.json();
  let existing = queryData.records?.[0];

  // If no role-matched record, grab the placeholder (first record) and claim it
  if (!existing) {
    const anyRes = await sfFetch(auth,
      `/services/data/${API_VERSION}/query?q=${encodeURIComponent("SELECT Id, Name FROM SHOS_Knowledge__c LIMIT 1")}`
    );
    const anyData = await anyRes.json();
    existing = anyData.records?.[0];
    if (existing) console.log(`  Using existing placeholder record (${existing.Id})`);
  }

  const now = new Date().toISOString();
  const payload = {
    Role__c: "coo",
    Content__c: content,
    Last_Updated__c: now,
    Session_Count__c: 1,
  };

  if (existing) {
    const updateRes = await sfFetch(auth,
      `/services/data/${API_VERSION}/sobjects/SHOS_Knowledge__c/${existing.Id}`,
      { method: "PATCH", body: JSON.stringify(payload) }
    );
    if (updateRes.status === 204) {
      console.log(`✓ Updated COO knowledge file (${existing.Id})`);
    } else {
      const err = await updateRes.text();
      throw new Error(`Update failed: ${err}`);
    }
  } else {
    const createRes = await sfFetch(auth,
      `/services/data/${API_VERSION}/sobjects/SHOS_Knowledge__c`,
      { method: "POST", body: JSON.stringify(payload) }
    );
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(`Create failed: ${JSON.stringify(createData)}`);
    console.log(`✓ Created COO knowledge file (${createData.id})`);
  }

  console.log(`✓ Content length: ${content.length} chars`);
}

main().catch(e => { console.error("✗", e.message); process.exit(1); });
