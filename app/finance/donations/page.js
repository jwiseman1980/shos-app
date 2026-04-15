import PageShell from "@/components/PageShell";
import DonationsDashboard from "@/components/DonationsDashboard";
import DonationReceivedForm from "@/components/DonationReceivedForm";
import DataCard from "@/components/DataCard";
import { getServerClient } from "@/lib/supabase";
import { getVolunteers } from "@/lib/data/volunteers";
import { getCurrentYear } from "@/lib/dates";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Data fetchers (server-side only)
// ---------------------------------------------------------------------------

/**
 * All donations recorded in Supabase for the given year, most recent first.
 * Uses select("*") to be resilient to column-name differences between schema
 * file and the live Supabase table (donation_amount vs amount).
 */
async function getDonations2026(year) {
  const sb = getServerClient();
  const yearStr = String(year);
  const nextYearStr = String(year + 1);

  const { data, error } = await sb
    .from("donations")
    .select("*")
    .gte("donation_date", `${yearStr}-01-01`)
    .lt("donation_date", `${nextYearStr}-01-01`)
    .order("donation_date", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[donations-page] Supabase error:", error.message);
    return [];
  }

  return (data || []).map((r) => ({
    id: r.id,
    sfId: r.sf_id || null,
    recordType: "donation",
    donorName:
      r.billing_name ||
      [r.donor_first_name, r.donor_last_name].filter(Boolean).join(" ") ||
      null,
    donorEmail: r.donor_email || null,
    // Live Supabase column may be donation_amount or amount — check both
    amount: Number(r.donation_amount ?? r.amount ?? 0),
    donationDate: r.donation_date || null,
    source: r.source || "other",
    paymentMethod: r.payment_method || null,
    campaign: r.campaign || null,
    notes: r.notes || null,
    thankYouSent: r.thank_you_sent || false,
    thankYouDate: r.thank_you_date || null,
    thankYouBy: r.thank_you_by || null,
    donorSegment: r.donor_segment || null,
  }));
}

/**
 * D-variant orders (SKU ends in -7D or -6D, unit_price = 45) for the year.
 * Each D-variant = an extra $10 donation to the Steel Hearts Fund.
 */
async function getDVariantDonations(year) {
  const sb = getServerClient();
  const yearStr = String(year);
  const nextYearStr = String(year + 1);

  const { data: items, error } = await sb
    .from("order_items")
    .select(`
      id,
      lineitem_sku,
      quantity,
      unit_price,
      hero:heroes!hero_id(name),
      order:orders!order_id(
        id,
        billing_name,
        billing_email,
        order_date,
        order_type
      )
    `)
    .eq("order.order_type", "paid")
    .eq("unit_price", 45)
    .or("lineitem_sku.ilike.%-7D,lineitem_sku.ilike.%-6D")
    .gte("order.order_date", `${yearStr}-01-01T00:00:00.000Z`)
    .lt("order.order_date", `${nextYearStr}-01-01T00:00:00.000Z`)
    .order("order(order_date)", { ascending: false });

  if (error) {
    console.error("[donations-page] D-variant query error:", error.message);
    return [];
  }

  return (items || [])
    .filter((item) => item.order) // skip items with no resolved order
    .map((item) => ({
      id: `dv-${item.id}`,
      recordType: "d-variant",
      donorName: item.order?.billing_name || null,
      donorEmail: item.order?.billing_email || null,
      amount: 10, // the extra $10 Steel Hearts donation
      donationDate: item.order?.order_date?.slice(0, 10) || null,
      source: "d-variant",
      paymentMethod: "credit_card",
      notes: item.hero?.name
        ? `D-variant bracelet for ${item.hero.name}`
        : `D-variant bracelet (${item.lineitem_sku})`,
      thankYouSent: false,
      orderId: item.order?.id || null,
      heroName: item.hero?.name || null,
      sku: item.lineitem_sku || null,
    }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DonationsPage({ searchParams }) {
  const params = await searchParams;
  const year = Number(params?.year) || getCurrentYear();

  // Run both queries in parallel; if either fails, fall back to empty array
  const [donations, dVariants, volunteers] = await Promise.all([
    getDonations2026(year).catch(() => []),
    getDVariantDonations(year).catch(() => []),
    getVolunteers().catch(() => []),
  ]);

  const totalCount = donations.length + dVariants.length;
  const totalAmount = [...donations, ...dVariants].reduce(
    (s, d) => s + (d.amount || 0),
    0
  );

  const formatAmount = (a) =>
    `$${(a || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <PageShell
      title={`Donations ${year}`}
      subtitle={`${totalCount} total · ${formatAmount(totalAmount)} raised across all sources`}
      action={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Year picker */}
          <a
            href={`/finance/donations?year=${year - 1}`}
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              textDecoration: "none",
              padding: "4px 10px",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            ← {year - 1}
          </a>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-bright)",
              padding: "4px 12px",
              background: "var(--card-bg)",
              border: "1px solid var(--gold)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {year}
          </span>
          <a
            href={`/finance/donations?year=${year + 1}`}
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              textDecoration: "none",
              padding: "4px 10px",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {year + 1} →
          </a>
        </div>
      }
    >
      {/* Main dashboard (client component with all interactivity) */}
      <DonationsDashboard
        donations={donations}
        dVariants={dVariants}
        year={year}
        volunteers={volunteers}
      />

      {/* Manual Entry — for DonorBox CSV imports, checks, cash, etc. */}
      <div style={{ marginTop: 24 }}>
        <DataCard title="Manual Entry — Check / Cash / DonorBox / Other">
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            Use this form for donations not yet in the system: cash, checks, DonorBox imports,
            or any source without a live API sync. Once entered, they appear in the table above
            on next page load.
          </p>
          <DonationReceivedForm />
        </DataCard>
      </div>
    </PageShell>
  );
}
