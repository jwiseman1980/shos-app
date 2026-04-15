import PageShell from "@/components/PageShell";
import DonateForm from "@/components/DonateForm";
import Link from "next/link";

export const metadata = {
  title: "Log Donation — SHOS",
};

export default function DonateOrderPage() {
  return (
    <PageShell
      title="Log Donated Bracelets"
      subtitle="Record bracelets donated to families, events, or partners"
      action={
        <Link
          href="/orders"
          style={{
            fontSize: 12, color: "var(--text-dim)", textDecoration: "none",
            padding: "5px 10px", border: "1px solid var(--card-border)",
            borderRadius: 6,
          }}
        >
          ← Back to Orders
        </Link>
      }
    >
      <div style={{ maxWidth: 600 }}>
        <div style={{
          background: "var(--gold-soft)",
          border: "1px solid var(--gold-border)",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 24,
          fontSize: 13,
          color: "var(--text)",
          lineHeight: 1.6,
        }}>
          <strong style={{ color: "var(--gold)" }}>Donated order types:</strong> Use this form for
          bracelets given to Gold Star families, event giveaways (DRMF Ruck &amp; Roll, MMMM, etc.),
          partner organizations, or replacement bracelets. These orders are logged with type
          &ldquo;donated&rdquo; and appear in the full order history.
        </div>
        <DonateForm />
      </div>
    </PageShell>
  );
}
