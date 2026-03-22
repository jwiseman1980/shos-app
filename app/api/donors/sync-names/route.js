import { sfQuery, sfUpdate } from "@/lib/salesforce";
import { getGmailClient } from "@/lib/gmail";
import { parseDonationEmail, matchDonationToSF } from "@/lib/donation-sync";
import { cookies } from "next/headers";

/**
 * POST /api/donors/sync-names
 *
 * Syncs donor names from Squarespace donation notification emails in Gmail
 * into Salesforce Donation__c records that are missing first/last names.
 *
 * Uses the Gmail API (via domain-wide delegation) to read emails from
 * joseph.wiseman@steel-hearts.org, parses the HTML, and updates SF.
 *
 * Query params:
 *   ?maxEmails=20  — how many recent emails to process (default 20)
 *   ?dryRun=true   — preview matches without updating SF
 */
export async function POST(request) {
  // Auth check
  const cookieStore = await cookies();
  const session = cookieStore.get("shos_session");
  const apiKey = request.headers.get("x-api-key");

  if (!session && apiKey !== process.env.SHOS_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const maxEmails = parseInt(searchParams.get("maxEmails") || "20");
    const dryRun = searchParams.get("dryRun") === "true";

    // Check if Gmail is configured
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    ) {
      return Response.json(
        { error: "Gmail API not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY." },
        { status: 500 }
      );
    }

    // Get Gmail client impersonating joseph.wiseman@steel-hearts.org
    const gmail = await getGmailClient("joseph.wiseman@steel-hearts.org");

    // Search for donation notification emails
    const searchResult = await gmail.users.messages.list({
      userId: "me",
      q: 'from:no-reply@squarespace.com subject:"new donation has arrived"',
      maxResults: maxEmails,
    });

    const messages = searchResult.data.messages || [];
    if (messages.length === 0) {
      return Response.json({
        success: true,
        message: "No donation notification emails found",
        processed: 0,
        updated: 0,
        skipped: 0,
      });
    }

    const results = [];
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const msg of messages) {
      try {
        // Fetch full message
        const fullMsg = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });

        // Get HTML body
        let html = "";
        const payload = fullMsg.data.payload;

        if (payload.mimeType === "text/html" && payload.body?.data) {
          html = Buffer.from(payload.body.data, "base64").toString("utf-8");
        } else if (payload.parts) {
          const htmlPart = payload.parts.find(
            (p) => p.mimeType === "text/html"
          );
          if (htmlPart?.body?.data) {
            html = Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
          }
        }

        if (!html) {
          results.push({
            messageId: msg.id,
            status: "skipped",
            reason: "No HTML body found",
          });
          skipped++;
          continue;
        }

        // Parse the email
        const parsed = parseDonationEmail(html);

        if (!parsed.email) {
          results.push({
            messageId: msg.id,
            status: "skipped",
            reason: "Could not parse donor email",
            parsed,
          });
          skipped++;
          continue;
        }

        if (!parsed.firstName && !parsed.lastName) {
          results.push({
            messageId: msg.id,
            status: "skipped",
            reason: "Could not parse donor name",
            parsed,
          });
          skipped++;
          continue;
        }

        // Match to SF record
        const sfRecord = await matchDonationToSF(sfQuery, parsed);

        if (!sfRecord) {
          results.push({
            messageId: msg.id,
            status: "skipped",
            reason: "No matching SF record with missing names",
            parsed: {
              name: parsed.name,
              email: parsed.email,
              amount: parsed.amount,
            },
          });
          skipped++;
          continue;
        }

        if (dryRun) {
          results.push({
            messageId: msg.id,
            status: "would_update",
            sfId: sfRecord.Id,
            parsed: {
              name: parsed.name,
              firstName: parsed.firstName,
              lastName: parsed.lastName,
              email: parsed.email,
              amount: parsed.amount,
            },
          });
          continue;
        }

        // Update SF record
        const updateData = {};
        if (parsed.firstName)
          updateData.Donor_First_Name__c = parsed.firstName;
        if (parsed.lastName) updateData.Donor_Last_Name__c = parsed.lastName;
        if (parsed.name) updateData.Billing_Name__c = parsed.name;

        await sfUpdate("Donation__c", sfRecord.Id, updateData);
        updated++;

        results.push({
          messageId: msg.id,
          status: "updated",
          sfId: sfRecord.Id,
          name: parsed.name,
          email: parsed.email,
          amount: parsed.amount,
        });
      } catch (msgErr) {
        errors++;
        results.push({
          messageId: msg.id,
          status: "error",
          error: msgErr.message,
        });
      }
    }

    return Response.json({
      success: true,
      processed: messages.length,
      updated,
      skipped,
      errors,
      dryRun,
      results,
    });
  } catch (err) {
    console.error("Donation sync error:", err);
    return Response.json(
      { error: "Sync failed: " + err.message },
      { status: 500 }
    );
  }
}
