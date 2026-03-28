/**
 * Deploys custom fields to SHOS_Knowledge__c and SHOS_Friction__c
 * using the Salesforce Tooling API — no ZIP, no SOAP.
 * Run this after create-shos-sf-objects.mjs confirms both objects exist.
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

// Fields to create via Tooling API
const FIELDS = [
  // SHOS_Knowledge__c fields
  {
    fullName: "SHOS_Knowledge__c.Role__c",
    metadata: {
      type: "Picklist",
      label: "Role",
      valueSet: {
        valueSetDefinition: {
          sorted: false,
          value: [
            { fullName: "ed",     label: "ed",     default: false },
            { fullName: "cos",    label: "cos",    default: false },
            { fullName: "cfo",    label: "cfo",    default: false },
            { fullName: "coo",    label: "coo",    default: false },
            { fullName: "comms",  label: "comms",  default: false },
            { fullName: "dev",    label: "dev",    default: false },
            { fullName: "family", label: "family", default: false },
          ],
        },
      },
    },
  },
  {
    fullName: "SHOS_Knowledge__c.Content__c",
    metadata: {
      type: "LongTextArea",
      label: "Content",
      length: 131072,
      visibleLines: 10,
    },
  },
  {
    fullName: "SHOS_Knowledge__c.Last_Updated__c",
    metadata: {
      type: "DateTime",
      label: "Last Updated",
    },
  },
  {
    fullName: "SHOS_Knowledge__c.Session_Count__c",
    metadata: {
      type: "Number",
      label: "Session Count",
      precision: 4,
      scale: 0,
    },
  },
  // SHOS_Friction__c fields
  {
    fullName: "SHOS_Friction__c.Role__c",
    metadata: {
      type: "Picklist",
      label: "Role",
      valueSet: {
        valueSetDefinition: {
          sorted: false,
          value: [
            { fullName: "ed",     label: "ed",     default: false },
            { fullName: "cos",    label: "cos",    default: false },
            { fullName: "cfo",    label: "cfo",    default: false },
            { fullName: "coo",    label: "coo",    default: false },
            { fullName: "comms",  label: "comms",  default: false },
            { fullName: "dev",    label: "dev",    default: false },
            { fullName: "family", label: "family", default: false },
          ],
        },
      },
    },
  },
  {
    fullName: "SHOS_Friction__c.Type__c",
    metadata: {
      type: "Picklist",
      label: "Type",
      valueSet: {
        valueSetDefinition: {
          sorted: false,
          value: [
            { fullName: "bug",         label: "bug",         default: false },
            { fullName: "missing",     label: "missing",     default: false },
            { fullName: "improvement", label: "improvement", default: false },
            { fullName: "idea",        label: "idea",        default: false },
          ],
        },
      },
    },
  },
  {
    fullName: "SHOS_Friction__c.Priority__c",
    metadata: {
      type: "Picklist",
      label: "Priority",
      valueSet: {
        valueSetDefinition: {
          sorted: false,
          value: [
            { fullName: "high",   label: "high",   default: false },
            { fullName: "medium", label: "medium", default: false },
            { fullName: "low",    label: "low",    default: false },
          ],
        },
      },
    },
  },
  {
    fullName: "SHOS_Friction__c.Description__c",
    metadata: {
      type: "LongTextArea",
      label: "Description",
      length: 32768,
      visibleLines: 5,
    },
  },
  {
    fullName: "SHOS_Friction__c.Status__c",
    metadata: {
      type: "Picklist",
      label: "Status",
      valueSet: {
        valueSetDefinition: {
          sorted: false,
          value: [
            { fullName: "open",     label: "open",     default: true  },
            { fullName: "triaged",  label: "triaged",  default: false },
            { fullName: "queued",   label: "queued",   default: false },
            { fullName: "done",     label: "done",     default: false },
          ],
        },
      },
    },
  },
  {
    fullName: "SHOS_Friction__c.Logged_Date__c",
    metadata: {
      type: "Date",
      label: "Logged Date",
    },
  },
];

async function fieldExists(auth, fullName) {
  const url = `${auth.instanceUrl}/services/data/${API_VERSION}/tooling/query?q=${encodeURIComponent(
    `SELECT Id, DeveloperName FROM CustomField WHERE TableEnumOrId = '${fullName.split(".")[0]}' AND DeveloperName = '${fullName.split(".")[1].replace(/__c$/, "")}'`
  )}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.totalSize > 0;
}

async function createField(auth, field) {
  const url = `${auth.instanceUrl}/services/data/${API_VERSION}/tooling/sobjects/CustomField/`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      FullName: field.fullName,
      Metadata: field.metadata,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data.id;
}

async function main() {
  const auth = await authenticate();
  console.log(`✓ Connected to ${auth.instanceUrl}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const field of FIELDS) {
    process.stdout.write(`  ${field.fullName} ... `);
    try {
      const exists = await fieldExists(auth, field.fullName);
      if (exists) {
        console.log("already exists, skipping");
        skipped++;
        continue;
      }
      const id = await createField(auth, field);
      console.log(`✓ created (${id})`);
      created++;
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.log(`✗ FAILED: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error("✗", e.message); process.exit(1); });
