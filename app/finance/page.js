import PageShell from "@/components/PageShell";

export default function FinancePage() {
  return (
    <PageShell title="Financial Dashboard" subtitle="Revenue, disbursements, and charity obligations">
      <div className="placeholder-page">
        <div className="placeholder-icon">&#36;</div>
        <h2>Financial Dashboard</h2>
        <p>Monthly donation trends, fulfillment rate, top charities, and recent transactions.</p>
        <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8 }}>Coming in Phase 3</p>
      </div>
    </PageShell>
  );
}
