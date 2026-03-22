/**
 * Donation Name Sync — Parses Squarespace donation notification emails
 * and backfills donor names into Salesforce Donation__c records.
 *
 * Flow: Gmail (donation notification emails) → Parse HTML → Match SF record → Update names
 */

/**
 * Parse a Squarespace donation notification email HTML body
 * and extract donor information.
 */
export function parseDonationEmail(html) {
  const result = {
    name: null,
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    address: null,
    city: null,
    state: null,
    zip: null,
    country: null,
    amount: null,
    orderNumber: null,
    fund: null,
    donationType: null,
    placedDate: null,
  };

  try {
    // Extract name — appears right after "BILLED TO" header, as first line in the billing div
    // Pattern: <span style="text-transform: uppercase;">BILLED TO</span> ... <div ...> name<br>
    const billedToMatch = html.match(
      /BILLED TO[\s\S]*?<div[^>]*>\s*(?:<[^>]*>\s*)*([^<]+?)\s*<br/i
    );
    if (billedToMatch) {
      const fullName = billedToMatch[1].trim();
      result.name = fullName;
      const nameParts = fullName.split(/\s+/);
      if (nameParts.length >= 2) {
        result.firstName = nameParts[0];
        result.lastName = nameParts.slice(1).join(" ");
      } else if (nameParts.length === 1) {
        result.lastName = nameParts[0];
      }
      // Capitalize properly
      if (result.firstName)
        result.firstName =
          result.firstName.charAt(0).toUpperCase() +
          result.firstName.slice(1).toLowerCase();
      if (result.lastName)
        result.lastName = result.lastName
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
      result.name = [result.firstName, result.lastName]
        .filter(Boolean)
        .join(" ");
    }

    // Extract email from billing section
    const emailMatch = html.match(
      /BILLED TO[\s\S]*?color: #3E3E3E!important[^>]*>\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\s*<\/span/i
    );
    if (emailMatch) {
      result.email = emailMatch[1].trim().toLowerCase();
    }

    // Extract phone from billing section
    const phoneMatch = html.match(
      /BILLED TO[\s\S]*?color: #3E3E3E!important[^>]*>\s*(\+?\d[\d\s\-()]{7,})\s*<\/span/i
    );
    if (phoneMatch) {
      result.phone = phoneMatch[1].trim();
    }

    // Extract amount — look for the bold total in donation details
    const amountMatch = html.match(
      /font-weight:\s*bold[^>]*>\s*\$([0-9,.]+)\s*<\/span/i
    );
    if (amountMatch) {
      result.amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    }
    // Fallback: look for subtotal amount
    if (!result.amount) {
      const subtotalMatch = html.match(
        /SUBTOTAL[\s\S]*?font-weight:\s*600[^>]*>\s*<div[^>]*>\s*\$([0-9,.]+)/i
      );
      if (subtotalMatch) {
        result.amount = parseFloat(subtotalMatch[1].replace(/,/g, ""));
      }
    }

    // Extract order number
    const orderMatch = html.match(/Order\s*#(\d+)/i);
    if (orderMatch) {
      result.orderNumber = orderMatch[1];
    }

    // Extract fund/donation type
    const fundMatch = html.match(
      /font-weight:600[^>]*>\s*([^<]+?)\s*(?:<[^>]*>\s*)*(?:One Time Donation|Monthly Donation|Recurring Donation)/i
    );
    if (fundMatch) {
      result.fund = fundMatch[1].trim();
    }
    const typeMatch = html.match(
      /(One Time Donation|Monthly Donation|Recurring Donation)/i
    );
    if (typeMatch) {
      result.donationType = typeMatch[1].trim();
    }

    // Extract placed date
    const dateMatch = html.match(
      /Placed on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+[AP]M\s+[A-Z]+)/i
    );
    if (dateMatch) {
      result.placedDate = dateMatch[1].trim();
    }

    // Extract address components from billing section
    const addressBlock = html.match(
      /BILLED TO[\s\S]*?<div[^>]*style="line-height: 18px[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    if (addressBlock) {
      const lines = addressBlock[1]
        .replace(/<[^>]*>/g, "\n")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.match(/^[+\d]/) && !l.includes("@"));

      // lines[0] = name, lines[1] = street, lines[2] = maybe apt/unit, then city/state/zip, country
      const cityStateZip = lines.find((l) =>
        l.match(/[A-Z]{2},?\s+\d{5}/)
      );
      if (cityStateZip) {
        const parts = cityStateZip.split(",").map((s) => s.trim());
        if (parts.length >= 2) {
          result.city = parts[0];
          const stateZip = parts[1].trim().split(/\s+/);
          result.state = stateZip[0];
          result.zip = stateZip[1];
        }
      }
      const countryLine = lines.find(
        (l) =>
          l.match(/^(United States|Canada|United Kingdom|Australia)/i) ||
          l.match(/^[A-Z][a-z]/)
      );
      if (countryLine && !countryLine.match(/\d/)) {
        result.country = countryLine;
      }
    }
  } catch (err) {
    console.error("Error parsing donation email:", err);
  }

  return result;
}

/**
 * Match a parsed donation to a Salesforce Donation__c record.
 * Matches by email + approximate amount. Only returns records with missing names.
 */
export async function matchDonationToSF(sfQuery, parsed) {
  if (!parsed.email) return null;

  // Query for donations matching this email that don't have names yet
  const email = parsed.email.replace(/'/g, "\\'");
  let query = `SELECT Id, Donor_Email__c, Email__c, Donation_Amount__c, Donation_Date__c,
    Donor_First_Name__c, Donor_Last_Name__c, Billing_Name__c
    FROM Donation__c
    WHERE (Donor_Email__c = '${email}' OR Email__c = '${email}')
    AND (Donor_First_Name__c = null OR Donor_First_Name__c = '')
    ORDER BY Donation_Date__c DESC
    LIMIT 5`;

  const records = await sfQuery(query);

  if (records.length === 0) return null;

  // If we have amount, try to match on amount too
  if (parsed.amount && records.length > 1) {
    const amountMatch = records.find(
      (r) => Math.abs(r.Donation_Amount__c - parsed.amount) < 0.01
    );
    if (amountMatch) return amountMatch;
  }

  // Return most recent unmatched record for this email
  return records[0];
}
