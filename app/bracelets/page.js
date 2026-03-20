import PageShell from "@/components/PageShell";

export default function BraceletsPage() {
  return (
    <PageShell title="Bracelet Pipeline" subtitle="Commission tracking from inquiry to shipped">
      <div className="placeholder-page">
        <div className="placeholder-icon">&#9675;</div>
        <h2>Bracelet Pipeline</h2>
        <p>Kanban board for bracelet commissions, production status, and fulfillment tracking.</p>
        <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8 }}>Coming in Phase 2</p>
      </div>
    </PageShell>
  );
}
