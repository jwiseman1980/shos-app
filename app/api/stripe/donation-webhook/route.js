// ---------------------------------------------------------------------------
// STUB: Stripe Donation Webhook
// Status: NOT ACTIVE — waiting on new website /donate page
//
// When ready to activate:
//   1. Add STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY to .env.local + Vercel
//   2. Register this endpoint in Stripe Dashboard → Webhooks
//      URL: https://shos-app.vercel.app/api/stripe/donation-webhook
//      Events: payment_intent.succeeded, checkout.session.completed
//   3. Apply for Stripe nonprofit rate at stripe.com/nonprofits
//      Expected rate: 0.5% + $0.30 (vs standard 2.9% + $0.30)
//   4. Uncomment implementation below
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

export async function POST(request) {
  // STUB — not yet active
  return NextResponse.json({ received: true, status: "stub — not yet active" }, { status: 200 });

  /* IMPLEMENTATION (uncomment when ready):

  const sig = request.headers.get("stripe-signature");
  const body = await request.text();

  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    const session = event.data.object;
    const { sfCreate } = await import("@/lib/salesforce");

    await sfCreate("Donation__c", {
      Donor_First_Name__c: session.customer_details?.name?.split(" ")[0] || null,
      Donor_Last_Name__c:  session.customer_details?.name?.split(" ").slice(1).join(" ") || null,
      Donor_Email__c:      session.customer_details?.email || null,
      Donation_Amount__c:  (session.amount_total || 0) / 100,
      Donation_Date__c:    new Date(session.created * 1000).toISOString().slice(0, 10),
      Source__c:           "Stripe",
      Origin__c:           session.metadata?.campaign || "Website",
      Payment_Method__c:   "Stripe",
      Order_ID__c:         session.id,
    });
  }

  return NextResponse.json({ received: true });
  */
}
