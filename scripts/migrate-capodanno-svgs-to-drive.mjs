/**
 * Downloads the two Capodanno SVG files from Salesforce Files
 * and uploads them to Google Drive via the live Vercel app,
 * which has the service account credentials.
 *
 * Files:
 *   069V500000YHndVIAT — Capodanno_USN-CAPODANNO.svg       (7" standard)
 *   069V500000YHjBhIAL — Capodanno_Female Cut_USN-CAPODANNO.svg (6" female cut)
 *
 * Run: node scripts/migrate-capodanno-svgs-to-drive.mjs
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

const HERO_ID = "a0uV50000091lyzIAA"; // LT Vincent R. Capodanno — Memorial_Bracelet__c
const VERCEL_URL = "https://shos-app.vercel.app";
const API_KEY = process.env.SHOS_API_KEY;

// ContentVersion IDs for each design (use REST API VersionData endpoint)
const DESIGNS = [
  {
    sku: "USN-CAPODANNO-7",
    fileName: "USN-CAPODANNO-7.svg",
    contentVersionId: "068V500000Z0jp3IAB",
    label: '7" standard',
  },
  {
    sku: "USN-CAPODANNO-6",
    fileName: "USN-CAPODANNO-6.svg",
    contentVersionId: "068V500000Z0fNFIAZ",
    label: '6" female cut',
  },
];

async function getSFAuth() {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.SF_CLIENT_ID,
    refresh_token: process.env.SF_REFRESH_TOKEN,
  });
  const res = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`SF auth failed: ${await res.text()}`);
  const data = await res.json();
  return { token: data.access_token, instanceUrl: data.instance_url };
}

async function main() {
  if (!API_KEY) throw new Error("SHOS_API_KEY not set in .env.local");

  const { token: sfToken, instanceUrl } = await getSFAuth();
  console.log("✓ SF authenticated\n");

  for (const design of DESIGNS) {
    console.log(`Processing ${design.label} — ${design.sku}`);

    // 1. Download SVG bytes via REST API VersionData endpoint
    process.stdout.write(`  Downloading from SF...`);
    const dlRes = await fetch(
      `${instanceUrl}/services/data/v62.0/sobjects/ContentVersion/${design.contentVersionId}/VersionData`,
      { headers: { Authorization: `Bearer ${sfToken}` } }
    );
    if (!dlRes.ok) {
      console.log(` ✗ Failed (${dlRes.status}): ${await dlRes.text()}`);
      continue;
    }
    const svgBytes = await dlRes.arrayBuffer();
    console.log(` ${Math.round(svgBytes.byteLength / 1024)}KB`);

    // 2. POST to Vercel upload endpoint
    process.stdout.write(`  Uploading to Drive via Vercel...`);
    const form = new FormData();
    form.append("file", new Blob([svgBytes], { type: "image/svg+xml" }), design.fileName);
    form.append("sku", design.sku);
    form.append("heroId", HERO_ID);

    const uploadRes = await fetch(`${VERCEL_URL}/api/designs/upload`, {
      method: "POST",
      headers: { "x-api-key": API_KEY },
      body: form,
    });
    const result = await uploadRes.json();

    if (result.success) {
      console.log(` ✓`);
      console.log(`  View:     ${result.viewLink}`);
      console.log(`  Download: ${result.downloadLink}`);
      console.log(`  File:     ${result.fileName}`);
    } else {
      console.log(` ✗`);
      console.log(`  Error:`, result);
    }
    console.log();
  }

  console.log("Done. Both SVGs are now in the Bracelet Designs Drive folder.");
  console.log("SF Design_Brief__c and Design_Brief_6in__c have been updated with Drive links.");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
