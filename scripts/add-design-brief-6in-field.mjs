/**
 * Adds Design_Brief_6in__c (LongTextArea) to Memorial_Bracelet__c
 * and grants FLS to the System Administrator permission set.
 */

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

async function main() {
  const auth = await authenticate();
  console.log(`✓ Connected to ${auth.instanceUrl}`);

  const headers = {
    Authorization: `Bearer ${auth.accessToken}`,
    "Content-Type": "application/json",
  };

  // 1. Check if field already exists
  const existsRes = await fetch(
    `${auth.instanceUrl}/services/data/${API_VERSION}/tooling/query?q=` +
      encodeURIComponent(
        `SELECT Id FROM CustomField WHERE TableEnumOrId = 'Memorial_Bracelet__c' AND DeveloperName = 'Design_Brief_6in'`
      ),
    { headers }
  );
  const existsData = await existsRes.json();
  if (existsData.totalSize > 0) {
    console.log("  Field already exists, skipping creation.");
  } else {
    // 2. Create the field
    const createRes = await fetch(
      `${auth.instanceUrl}/services/data/${API_VERSION}/tooling/sobjects/CustomField/`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          FullName: "Memorial_Bracelet__c.Design_Brief_6in__c",
          Metadata: {
            type: "LongTextArea",
            label: "Design Brief (6in)",
            length: 32768,
            visibleLines: 3,
          },
        }),
      }
    );
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(`Create failed: ${JSON.stringify(createData)}`);
    console.log(`✓ Created Design_Brief_6in__c (${createData.id})`);
    // Allow Salesforce to index the new field
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 3. Find the SysAdmin PermissionSet
  const psRes = await fetch(
    `${auth.instanceUrl}/services/data/${API_VERSION}/query?q=` +
      encodeURIComponent(
        `SELECT Id FROM PermissionSet WHERE IsOwnedByProfile = true AND Profile.Name = 'System Administrator' LIMIT 1`
      ),
    { headers }
  );
  const psData = await psRes.json();
  if (!psData.records?.length) throw new Error("SysAdmin PermissionSet not found");
  const psId = psData.records[0].Id;
  console.log(`  PermissionSet: ${psId}`);

  // 4. Check if FLS already set
  const flsCheckRes = await fetch(
    `${auth.instanceUrl}/services/data/${API_VERSION}/query?q=` +
      encodeURIComponent(
        `SELECT Id FROM FieldPermissions WHERE ParentId = '${psId}' AND Field = 'Memorial_Bracelet__c.Design_Brief_6in__c'`
      ),
    { headers }
  );
  const flsCheckData = await flsCheckRes.json();
  if (flsCheckData.records?.length) {
    console.log("  FLS already set, skipping.");
  } else {
    // 5. Grant FLS
    const flsRes = await fetch(
      `${auth.instanceUrl}/services/data/${API_VERSION}/sobjects/FieldPermissions/`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          ParentId: psId,
          SobjectType: "Memorial_Bracelet__c",
          Field: "Memorial_Bracelet__c.Design_Brief_6in__c",
          PermissionsRead: true,
          PermissionsEdit: true,
        }),
      }
    );
    const flsData = await flsRes.json();
    if (!flsRes.ok) throw new Error(`FLS failed: ${JSON.stringify(flsData)}`);
    console.log(`✓ FLS granted (${flsData.id})`);
  }

  console.log("\n✓ Done. Design_Brief_6in__c is ready on Memorial_Bracelet__c.");
  console.log("  Next: populate this field with the 6\" design Drive URL for each hero that has a 6\" variant.");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
