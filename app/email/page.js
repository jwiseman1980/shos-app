import PageShell from "@/components/PageShell";

export default function EmailPage() {
  return (
    <PageShell title="Email Composer" subtitle="Anniversary remembrance email templates">
      <div className="placeholder-page">
        <div className="placeholder-icon">&#9993;</div>
        <h2>Email Composer</h2>
        <p>Select a hero, generate personalized anniversary email, copy or open in Gmail.</p>
        <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8 }}>Coming in Phase 3</p>
      </div>
    </PageShell>
  );
}
