/**
 * Salesforce Finance Setup Script
 * Creates Expense__c object and adds fields to Donation_Disbursement__c
 * Run: node scripts/sf-setup-finance.mjs
 */

const SF_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
const SF_CLIENT_ID = "PlatformCLI";
const SF_REFRESH_TOKEN = process.env.SF_REFRESH_TOKEN; // set in .env.local, never hardcode
const SF_INSTANCE_URL = "https://steelheartsincorporated.my.salesforce.com";
const API_VERSION = "v62.0";

async function getAccessToken() {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: SF_CLIENT_ID,
    refresh_token: SF_REFRESH_TOKEN,
  });
  const res = await fetch(SF_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function toolingPost(token, path, body) {
  const res = await fetch(`${SF_INSTANCE_URL}/services/data/${API_VERSION}/tooling${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

async function toolingGet(token, path) {
  const res = await fetch(`${SF_INSTANCE_URL}/services/data/${API_VERSION}/tooling${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

function log(label, result) {
  if (result.ok) {
    console.log(`  ✓ ${label} — id: ${result.data?.id || "ok"}`);
  } else {
    const msg = Array.isArray(result.data)
      ? result.data.map((e) => e.message || e.errorCode).join(", ")
      : JSON.stringify(result.data);
    if (msg.includes("duplicate") || msg.includes("already exists") || msg.includes("DUPLICATE")) {
      console.log(`  ~ ${label} — already exists, skipping`);
    } else {
      console.error(`  ✗ ${label} — ${result.status}: ${msg}`);
    }
  }
}

async function createField(token, fullName, metadata) {
  const label = fullName.split(".")[1] || fullName;
  const result = await toolingPost(token, "/sobjects/CustomField", { FullName: fullName, Metadata: metadata });
  log(label, result);
  return result;
}

async function main() {
  console.log("Authenticating to Salesforce...");
  const token = await getAccessToken();
  console.log("Authenticated.\n");

  // ── Step 1: Add fields to Donation_Disbursement__c ──────────────────────
  console.log("Adding fields to Donation_Disbursement__c...");

  await createField(token, "Donation_Disbursement__c.Cycle_Month__c", {
    type: "Number",
    label: "Cycle Month",
    precision: 18,
    scale: 0,
    required: false,
    description: "Month (1-12) of the disbursement cycle this record belongs to.",
  });

  await createField(token, "Donation_Disbursement__c.Cycle_Year__c", {
    type: "Number",
    label: "Cycle Year",
    precision: 18,
    scale: 0,
    required: false,
    description: "Year of the disbursement cycle this record belongs to.",
  });

  await createField(token, "Donation_Disbursement__c.Receipt_Captured__c", {
    type: "Checkbox",
    label: "Receipt Captured",
    defaultValue: false,
    description: "True when a receipt/confirmation email has been captured for this disbursement.",
  });

  console.log();

  // ── Step 2: Create Expense__c custom object ──────────────────────────────
  console.log("Creating Expense__c custom object...");

  const objResult = await toolingPost(token, "/sobjects/CustomObject", {
    FullName: "Expense__c",
    Metadata: {
      label: "Expense",
      pluralLabel: "Expenses",
      nameField: {
        type: "AutoNumber",
        label: "Expense Number",
        displayFormat: "EXP-{0000}",
        startingNumber: 1,
      },
      deploymentStatus: "Deployed",
      sharingModel: "ReadWrite",
      description: "Categorized operating expenses from Chase checking and credit card accounts.",
    },
  });
  log("Expense__c object", objResult);

  // Wait a moment for the object to be fully provisioned before adding fields
  if (objResult.ok) {
    console.log("  Waiting for object to provision...");
    await new Promise((r) => setTimeout(r, 4000));
  }

  // ── Step 3: Add fields to Expense__c ────────────────────────────────────
  console.log("\nAdding fields to Expense__c...");

  await createField(token, "Expense__c.Transaction_Date__c", {
    type: "Date",
    label: "Transaction Date",
    required: true,
  });

  await createField(token, "Expense__c.Description__c", {
    type: "Text",
    label: "Description",
    length: 255,
    required: true,
    description: "Raw transaction description from Chase statement.",
  });

  await createField(token, "Expense__c.Amount__c", {
    type: "Currency",
    label: "Amount",
    precision: 18,
    scale: 2,
    required: true,
  });

  await createField(token, "Expense__c.Category__c", {
    type: "Picklist",
    label: "Category",
    valueSet: {
      restricted: true,
      valueSetDefinition: {
        sorted: false,
        value: [
          { fullName: "Payroll & Taxes", default: false },
          { fullName: "Software & Subscriptions", default: false },
          { fullName: "Marketing & Advertising", default: false },
          { fullName: "Shipping & Fulfillment", default: false },
          { fullName: "Inventory & Materials", default: false },
          { fullName: "Professional Services", default: false },
          { fullName: "Other / Miscellaneous", default: true },
        ],
      },
    },
  });

  await createField(token, "Expense__c.Bank_Account__c", {
    type: "Picklist",
    label: "Bank Account",
    valueSet: {
      restricted: true,
      valueSetDefinition: {
        sorted: false,
        value: [
          { fullName: "Checking-2352", default: false },
          { fullName: "CC-3418", default: false },
        ],
      },
    },
  });

  await createField(token, "Expense__c.Vendor__c", {
    type: "Text",
    label: "Vendor",
    length: 100,
    required: false,
    description: "Cleaned vendor name derived from the raw transaction description.",
  });

  await createField(token, "Expense__c.Month__c", {
    type: "Number",
    label: "Month",
    precision: 18,
    scale: 0,
    required: false,
    description: "Report period month (1-12).",
  });

  await createField(token, "Expense__c.Year__c", {
    type: "Number",
    label: "Year",
    precision: 18,
    scale: 0,
    required: false,
    description: "Report period year.",
  });

  await createField(token, "Expense__c.Is_Excluded__c", {
    type: "Checkbox",
    label: "Is Excluded",
    defaultValue: false,
    description: "True for internal transfers, SQ payments, and items that should not appear in expense totals.",
  });

  await createField(token, "Expense__c.Notes__c", {
    type: "LongTextArea",
    label: "Notes",
    length: 32768,
    visibleLines: 3,
    required: false,
  });

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
