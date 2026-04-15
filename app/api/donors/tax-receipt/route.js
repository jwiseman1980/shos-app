import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req) {
  try {
    const { donorEmail, year } = await req.json();
    if (!donorEmail || !year) {
      return NextResponse.json({ error: "donorEmail and year required" }, { status: 400 });
    }

    const sb = getServerClient();
    // Pull all donations for this donor in the requested year
    const { data: donations, error } = await sb
      .from("donations")
      .select("*")
      .eq("donor_email", donorEmail)
      .gte("donation_date", `${year}-01-01`)
      .lte("donation_date", `${year}-12-31`)
      .order("donation_date");

    if (error) throw new Error(error.message);
    if (!donations || donations.length === 0) {
      return NextResponse.json({ error: `No donations found for ${donorEmail} in ${year}` }, { status: 404 });
    }

    const totalAmount = donations.reduce((s, d) => s + (d.donation_amount || d.amount || 0), 0);
    const donorName =
      donations[0]?.billing_name ||
      [donations[0]?.donor_first_name, donations[0]?.donor_last_name].filter(Boolean).join(" ") ||
      donorEmail.split("@")[0].replace(/[._]/g, " ");

    // Format donation list
    const donationLines = donations.map((d) => {
      const amt = d.donation_amount || d.amount || 0;
      const date = new Date(d.donation_date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const sourceNote = d.source ? ` (${d.source})` : "";
      return `- ${date}: $${amt.toFixed(2)}${sourceNote}`;
    }).join("\n");

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Write a sincere, IRS-compliant tax receipt letter for a charitable donation. No em dashes. No bullet points in the body. Use clean paragraph formatting.

Donor: ${donorName}
Email: ${donorEmail}
Year: ${year}
Total Donated: $${totalAmount.toFixed(2)}
Donations:
${donationLines}

Organization: Steel Hearts Foundation
EIN: 47-2511085
Address: [Steel Hearts Foundation, EIN 47-2511085]
Tax-exempt status: 501(c)(3)

Requirements:
- Must include: donor name, total amount, year, EIN, statement that no goods or services were provided in exchange
- Sincere and warm, not a form letter
- 3-4 short paragraphs
- Close with: Joseph Wiseman, Executive Director, Steel Hearts Foundation
- Include the individual donation dates and amounts

Write ONLY the email body (no subject line, no headers).`,
      }],
    });

    const body = completion.content[0].text;
    const subject = `${year} Tax Receipt - Steel Hearts Foundation (EIN: 47-2511085)`;

    return NextResponse.json({
      donorName,
      donorEmail,
      year,
      totalAmount,
      donationCount: donations.length,
      subject,
      body,
    });
  } catch (err) {
    console.error("Tax receipt error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
