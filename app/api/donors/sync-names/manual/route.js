import { sfQuery, sfUpdate } from "@/lib/salesforce";
import { parseDonationEmail } from "@/lib/donation-sync";
import { cookies } from "next/headers";

/**
 * POST /api/donors/sync-names/manual
 *
 * Accepts raw email HTML and parses + updates SF directly.
 * Use this for backfilling from emails that aren't in the steel-hearts.org inbox yet.
 *
 * Body: { html: "..." } or { emails: [{ html: "..." }, ...] }
 *
 * Also accepts pre-parsed data directly:
 * Body: { donations: [{ email, firstName, lastName, amount }, ...] }
 */
export async function POST(request) {
  const cookieStore = await cookies();
  const session = cookieStore.get("shos_session");
  const apiKey = request.headers.get("x-api-key");

  if (!session && apiKey !== process.env.SHOS_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const results = [];
    let updated = 0;

    // Option 1: Pre-parsed donation data
    if (body.donations) {
      for (const d of body.donations) {
        if (!d.email) continue;

        const email = d.email.replace(/'/g, "\\'").toLowerCase();
        const records = await sfQuery(
          `SELECT Id, Donor_First_Name__c, Donor_Last_Name__c, Billing_Name__c, Donation_Amount__c
           FROM Donation__c
           WHERE (Donor_Email__c = '${email}' OR Email__c = '${email}')
           AND (Donor_First_Name__c = null OR Donor_First_Name__c = '')
           ORDER BY Donation_Date__c DESC LIMIT 5`
        );

        if (records.length === 0) {
          results.push({ email: d.email, status: "no_match" });
          continue;
        }

        // Match by amount if provided
        let record = records[0];
        if (d.amount && records.length > 1) {
          const amtMatch = records.find(
            (r) => Math.abs(r.Donation_Amount__c - d.amount) < 0.01
          );
          if (amtMatch) record = amtMatch;
        }

        const updateData = {};
        if (d.firstName) updateData.Donor_First_Name__c = d.firstName;
        if (d.lastName) updateData.Donor_Last_Name__c = d.lastName;
        if (d.firstName || d.lastName) {
          updateData.Billing_Name__c = [d.firstName, d.lastName]
            .filter(Boolean)
            .join(" ");
        }

        await sfUpdate("Donation__c", record.Id, updateData);
        updated++;
        results.push({
          email: d.email,
          sfId: record.Id,
          name: updateData.Billing_Name__c,
          status: "updated",
        });
      }

      return Response.json({ success: true, updated, results });
    }

    // Option 2: Raw HTML emails
    const htmlList = body.html
      ? [body.html]
      : (body.emails || []).map((e) => e.html).filter(Boolean);

    for (const html of htmlList) {
      const parsed = parseDonationEmail(html);

      if (!parsed.email || (!parsed.firstName && !parsed.lastName)) {
        results.push({
          status: "parse_failed",
          email: parsed.email,
          name: parsed.name,
        });
        continue;
      }

      const email = parsed.email.replace(/'/g, "\\'");
      const records = await sfQuery(
        `SELECT Id, Donor_First_Name__c, Donor_Last_Name__c, Donation_Amount__c
         FROM Donation__c
         WHERE (Donor_Email__c = '${email}' OR Email__c = '${email}')
         AND (Donor_First_Name__c = null OR Donor_First_Name__c = '')
         ORDER BY Donation_Date__c DESC LIMIT 5`
      );

      if (records.length === 0) {
        results.push({
          email: parsed.email,
          name: parsed.name,
          status: "no_match",
        });
        continue;
      }

      let record = records[0];
      if (parsed.amount && records.length > 1) {
        const amtMatch = records.find(
          (r) => Math.abs(r.Donation_Amount__c - parsed.amount) < 0.01
        );
        if (amtMatch) record = amtMatch;
      }

      const updateData = {};
      if (parsed.firstName) updateData.Donor_First_Name__c = parsed.firstName;
      if (parsed.lastName) updateData.Donor_Last_Name__c = parsed.lastName;
      if (parsed.name) updateData.Billing_Name__c = parsed.name;

      await sfUpdate("Donation__c", record.Id, updateData);
      updated++;
      results.push({
        email: parsed.email,
        sfId: record.Id,
        name: parsed.name,
        amount: parsed.amount,
        status: "updated",
      });
    }

    return Response.json({ success: true, updated, results });
  } catch (err) {
    console.error("Manual sync error:", err);
    return Response.json(
      { error: "Sync failed: " + err.message },
      { status: 500 }
    );
  }
}
