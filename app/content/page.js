import PageShell from "@/components/PageShell";

export default function ContentPage() {
  return (
    <PageShell title="Content Generator" subtitle="Social media post templates and Canva prompts">
      <div className="placeholder-page">
        <div className="placeholder-icon">&#9998;</div>
        <h2>Content Generator</h2>
        <p>Select a hero, generate Instagram/Facebook/Story posts with branch-specific hashtags and mottos.</p>
        <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8 }}>Coming in Phase 3</p>
      </div>
    </PageShell>
  );
}
