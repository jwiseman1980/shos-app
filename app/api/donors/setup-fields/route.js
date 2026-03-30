import { NextResponse } from "next/server";

/**
 * POST /api/donors/setup-fields
 *
 * Creates the 8 stewardship fields on Donation__c and a Donor tag field on Contact.
 * Uses the SF Metadata API (composite) to create custom fields.
 * Safe to run multiple times — skips fields that already exist.
 *
 * All new fields are app-managed only.
 */

const API_VERSION = "v62.0";

// Field definitions — each one becomes a CustomField metadata component
const DONATION_FIELDS = [
  {
    fullName: "Donation__c.Thank_You_Sent__c",
    label: "Thank You Sent",
    type: "Checkbox",
    defaultValue: "false",
    description: "Whether a thank-you email has been sent for this donation",
  },
  {
    fullName: "Donation__c.Thank_You_Date__c",
    label: "Thank You Date",
    type: "Date",
    description: "Date the thank-you was sent",
  },
  {
    fullName: "Donation__c.Thank_You_By__c",
    label: "Thank You By",
    type: "Text",
    length: 100,
    description: "Volunteer who sent the thank-you",
  },
  {
    fullName: "Donation__c.Donor_Contact__c",
    label: "Donor Contact",
    type: "Lookup",
    referenceTo: "Contact",
    relationshipName: "Donations",
    relationshipLabel: "Donations",
    description: "Link to the Contact record for this donor",
  },
  {
    fullName: "Donation__c.Donor_Segment__c",
    label: "Donor Segment",
    type: "Picklist",
    description: "Computed donor tier based on lifetime value and frequency",
    valueSet: {
      valueSetDefinition: {
        value: [
          { fullName: "Major ($500+)", label: "Major ($500+)", default: false },
          { fullName: "Recurring", label: "Recurring", default: false },
          { fullName: "Regular", label: "Regular", default: false },
          { fullName: "First-Time", label: "First-Time", default: false },
          { fullName: "Lapsed", label: "Lapsed", default: false },
        ],
        sorted: false,
      },
    },
  },
  {
    fullName: "Donation__c.Campaign__c",
    label: "Campaign",
    type: "Text",
    length: 100,
    description: "Campaign or event that drove this donation",
  },
  {
    fullName: "Donation__c.Impact_Update_Sent__c",
    label: "Impact Update Sent",
    type: "Checkbox",
    defaultValue: "false",
    description: "Whether a Day 30 impact update email has been sent",
  },
  {
    fullName: "Donation__c.Impact_Update_Date__c",
    label: "Impact Update Date",
    type: "Date",
    description: "Date the impact update was sent",
  },
];

const CONTACT_FIELDS = [
  {
    fullName: "Contact.Donor_Tag__c",
    label: "Donor Tag",
    type: "MultiselectPicklist",
    visibleLines: 4,
    description: "Tags identifying this contact as a donor and their attributes",
    valueSet: {
      valueSetDefinition: {
        value: [
          { fullName: "Donor", label: "Donor", default: false },
          { fullName: "Major Donor", label: "Major Donor", default: false },
          { fullName: "Recurring Donor", label: "Recurring Donor", default: false },
          { fullName: "Monthly Donor", label: "Monthly Donor", default: false },
          { fullName: "Lapsed Donor", label: "Lapsed Donor", default: false },
          { fullName: "Corporate Sponsor", label: "Corporate Sponsor", default: false },
          { fullName: "Event Donor", label: "Event Donor", default: false },
          { fullName: "In-Kind Donor", label: "In-Kind Donor", default: false },
          { fullName: "First-Time Donor", label: "First-Time Donor", default: false },
        ],
        sorted: false,
      },
    },
  },
];

export async function POST(request) {
  try {
    if (process.env.SF_LIVE !== "true") {
      return NextResponse.json(
        { success: false, error: "SF_LIVE not enabled", mock: true },
        { status: 200 }
      );
    }

    const { authenticate } = await import("@/lib/salesforce");
    const auth = await authenticate();

    // Check which fields already exist
    const existingDonationFields = await describeFields(auth, "Donation__c");
    const existingContactFields = await describeFields(auth, "Contact");

    const allFields = [...DONATION_FIELDS, ...CONTACT_FIELDS];
    const results = [];

    for (const fieldDef of allFields) {
      const [objName, fieldName] = fieldDef.fullName.split(".");
      const existingSet =
        objName === "Donation__c" ? existingDonationFields : existingContactFields;

      if (existingSet.has(fieldName.toLowerCase())) {
        results.push({
          field: fieldDef.fullName,
          status: "already_exists",
        });
        continue;
      }

      try {
        await createField(auth, fieldDef);
        results.push({
          field: fieldDef.fullName,
          status: "created",
        });
      } catch (err) {
        results.push({
          field: fieldDef.fullName,
          status: "error",
          error: err.message,
        });
      }
    }

    const created = results.filter((r) => r.status === "created").length;
    const skipped = results.filter((r) => r.status === "already_exists").length;
    const errors = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      success: errors === 0,
      created,
      skipped,
      errors,
      results,
      zapSafe: true,
      note: "Only NEW fields were created. No existing Zap-mapped fields were modified.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function describeFields(auth, objectName) {
  const res = await fetch(
    `${auth.instanceUrl}/services/data/${API_VERSION}/sobjects/${objectName}/describe`,
    {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Describe ${objectName} failed: ${res.status}`);
  }
  const data = await res.json();
  return new Set(data.fields.map((f) => f.name.toLowerCase()));
}

async function createField(auth, fieldDef) {
  // Build Metadata API payload for CustomField
  const metadata = { ...fieldDef };
  delete metadata.fullName;

  // Use Tooling API to create CustomField
  const toolingPayload = {
    FullName: fieldDef.fullName,
    Metadata: metadata,
  };

  const res = await fetch(
    `${auth.instanceUrl}/services/data/${API_VERSION}/tooling/sobjects/CustomField`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toolingPayload),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Create field ${fieldDef.fullName} failed (${res.status}): ${err}`);
  }

  return res.json();
}
