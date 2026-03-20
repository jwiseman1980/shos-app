import PageShell from "@/components/PageShell";

export default function MemorialsPage() {
  return (
    <PageShell title="Memorial Pages" subtitle="Preview and manage hero memorial page content">
      <div className="placeholder-page">
        <div className="placeholder-icon">&#10070;</div>
        <h2>Memorial Page Generator</h2>
        <p>Preview hero memorial pages with branch-specific theming before publishing to the public site.</p>
        <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8 }}>Coming in Phase 3</p>
      </div>
    </PageShell>
  );
}
