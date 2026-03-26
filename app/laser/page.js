export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import { getItemsByStatus } from "@/lib/data/orders";
import LaserQueue from "@/components/LaserQueue";

const PRODUCTION_PRESETS = [
  { name: "Green/Teal", color: "#5fb89a", hex: "#5fb89a", power: 15, speed: 200, freq: 65, source: "D1.1", desc: "Mint/seafoam green" },
  { name: "Blue", color: "#5ba3cf", hex: "#5ba3cf", power: 15, speed: "150-200", freq: 100, source: "D2.2, C3.2", desc: "Sky blue/cyan" },
  { name: "Lavender", color: "#9b8ec4", hex: "#9b8ec4", power: 15, speed: 200, freq: 100, source: "D1.2", desc: "Light purple" },
  { name: "Pink (bright)", color: "#e05b9c", hex: "#e05b9c", power: 15, speed: 100, freq: 200, source: "D3.4", desc: "Hot pink" },
  { name: "Pink/Rose", color: "#d4839b", hex: "#d4839b", power: 15, speed: 150, freq: "200-300", source: "D2.4-D2.5", desc: "Soft pink" },
  { name: "Gold/Amber", color: "#c9a84c", hex: "#c9a84c", power: 5, speed: 100, freq: 65, source: "D4.1", desc: "Rich warm gold" },
  { name: "Peach/Salmon", color: "#d4956b", hex: "#d4956b", power: 30, speed: 100, freq: 65, source: "D4.5", desc: "Warm peach" },
  { name: "Rose/Mauve", color: "#b07d8e", hex: "#b07d8e", power: 15, speed: 100, freq: 150, source: "D3.3", desc: "Dusty rose" },
  { name: "Gunmetal Grey", color: "#6b7280", hex: "#6b7280", power: 10, speed: 300, freq: 100, source: "F4.5", desc: "Cool dark grey" },
  { name: "Warm Bronze", color: "#a0845c", hex: "#a0845c", power: 10, speed: 300, freq: 65, source: "F4.4", desc: "Light bronze" },
  { name: "Dark Teal", color: "#4a6b6f", hex: "#4a6b6f", power: 12, speed: 400, freq: 100, source: "F4.8", desc: "Grey-teal" },
  { name: "Light Tan", color: "#c9b896", hex: "#c9b896", power: 8, speed: 300, freq: 65, source: "F1.4", desc: "Champagne/cream" },
  { name: "Slate Grey", color: "#7d8288", hex: "#7d8288", power: "9-10", speed: 300, freq: 100, source: "F1.5-F1.6", desc: "Medium grey" },
];

const STANDARD_ENGRAVE = {
  preset: "Success 6",
  material: '5/64" (2mm) 304 Stainless Steel',
  mode: "Engrave",
  power: 31,
  speed: 2500,
  passes: 2,
  linesCm: 300,
  engraving: "Bi-directional",
  pulseWidth: 500,
  frequency: 60,
};

const BED_POSITIONS = [
  { pos: 1, size: '7"', x: 0.7, y: 0.341, w: 6.859, h: 0.621 },
  { pos: 2, size: '7"', x: 0.7, y: 1.528, w: 6.859, h: 0.621 },
  { pos: 2, size: '6"', x: 0.621, y: 1.743, w: 5.9, h: 0.44 },
  { pos: 3, size: '7"', x: 0.7, y: 2.707, w: 6.859, h: 0.621 },
];

const KEY_FINDINGS = [
  "Speed is the master variable — 100-200 mm/s unlocks the full color spectrum",
  "Frequency is the color shifter — 65 kHz (warm) → 100 (blue) → 150 (purple) → 200-300 (pink)",
  "Power above 20% just makes brown/black — stay 5-15% for color",
  "Cross hatch + multi-pass at slow speeds overcooks to black",
  "Colors shift with viewing angle (thin-film interference) — normal, not a defect",
  "All presets pending tumble validation on non-brushed finish",
];

const tdStyle = { padding: "8px 12px", fontSize: 13, verticalAlign: "top" };
const thStyle = { padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", textAlign: "left" };

export default async function LaserPage() {
  let readyToLaser = [];
  let inProduction = [];
  try {
    [readyToLaser, inProduction] = await Promise.all([
      getItemsByStatus("Ready to Laser"),
      getItemsByStatus("In Production"),
    ]);
  } catch (err) {
    console.error("Laser queue load error:", err.message);
  }

  const laserQueue = [...readyToLaser, ...inProduction];

  return (
    <PageShell title="Laser Production" subtitle="xTool F2 Ultra — settings, color catalog, and bed positions">
      {/* KPIs */}
      <div className="stat-grid">
        <StatBlock label="Color Presets" value={PRODUCTION_PRESETS.length} note="Production-ready colors" accent="var(--gold)" />
        <StatBlock label="Test Squares" value={230} note="Across 6 phases (A-F)" accent="var(--status-blue)" />
        <StatBlock label="Bracelets Tested" value={20} note="Physical reference samples" accent="var(--status-green)" />
        <StatBlock label="Tumble Validated" value="Pending" note="Need tumbled finish tests" accent="var(--status-orange)" />
      </div>

      {/* Production Queue */}
      {laserQueue.length > 0 && (
        <div className="section">
          <DataCard title={`Laser Queue (${laserQueue.length} items)`}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
              Items ready to burn. Max 3 per run. Download SVG, load in xTool Creative Studio, apply Success 6 settings. Hit Done when finished.
            </div>
            <LaserQueue items={laserQueue} />
          </DataCard>
        </div>
      )}

      {/* Color Palette */}
      <div className="section">
        <DataCard title="Color Engrave Palette — Production Presets">
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            All at Pulse 200ns, Lines/cm 1000, Focus 0.4in, 1 Pass, Cross hatch OFF. Pending tumble validation.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {PRODUCTION_PRESETS.map((p) => (
              <div key={p.name} style={{
                background: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                borderRadius: 8,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: p.color,
                    border: "1px solid rgba(255,255,255,0.1)",
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-bright)" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{p.desc}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, fontSize: 11, color: "var(--text-dim)" }}>
                  <span>Power: <b style={{ color: "var(--text-bright)" }}>{p.power}%</b></span>
                  <span>Speed: <b style={{ color: "var(--text-bright)" }}>{p.speed}</b></span>
                  <span>Freq: <b style={{ color: "var(--text-bright)" }}>{p.freq} kHz</b></span>
                  <span>Source: <b style={{ color: "var(--text-dim)" }}>{p.source}</b></span>
                </div>
              </div>
            ))}
          </div>
        </DataCard>
      </div>

      {/* Key Findings */}
      <div className="section">
        <DataCard title="Key Findings">
          <ul style={{ margin: 0, padding: "0 0 0 20px", fontSize: 13, lineHeight: 1.8 }}>
            {KEY_FINDINGS.map((f, i) => (
              <li key={i} style={{ color: "var(--text-bright)" }}>{f}</li>
            ))}
          </ul>
        </DataCard>
      </div>

      {/* Standard Engrave Settings */}
      <div className="section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <DataCard title="Standard Engrave — Success 6">
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            Production preset for regular (non-color) bracelet engraving.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {[
                ["Material", STANDARD_ENGRAVE.material],
                ["Mode", STANDARD_ENGRAVE.mode],
                ["Power", `${STANDARD_ENGRAVE.power}%`],
                ["Speed", `${STANDARD_ENGRAVE.speed} mm/s`],
                ["Passes", STANDARD_ENGRAVE.passes],
                ["Lines/cm", STANDARD_ENGRAVE.linesCm],
                ["Engraving", STANDARD_ENGRAVE.engraving],
                ["Pulse Width", `${STANDARD_ENGRAVE.pulseWidth} ns`],
                ["Frequency", `${STANDARD_ENGRAVE.frequency} kHz`],
              ].map(([label, value]) => (
                <tr key={label} style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <td style={{ ...tdStyle, color: "var(--text-dim)", width: "40%" }}>{label}</td>
                  <td style={{ ...tdStyle, color: "var(--text-bright)", fontWeight: 500 }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataCard>

        <DataCard title="Bed Positions — 3 Slots">
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            Position 2 is either 7" OR 6" — not both. 3 bracelets per run max. 6" positions 1 & 3 TBD.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                <th style={thStyle}>Pos</th>
                <th style={thStyle}>Size</th>
                <th style={thStyle}>X</th>
                <th style={thStyle}>Y</th>
                <th style={thStyle}>W</th>
                <th style={thStyle}>H</th>
              </tr>
            </thead>
            <tbody>
              {BED_POSITIONS.map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "var(--text-bright)" }}>{p.pos}</td>
                  <td style={tdStyle}>{p.size}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{p.x}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{p.y}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{p.w}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{p.h}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataCard>
      </div>

      {/* Color Science */}
      <div className="section">
        <DataCard title="Color Science — Speed × Frequency Map">
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            At Power 15%, Pulse 200ns, Lines/cm 1000. Speed controls oxide thickness, frequency shifts the color family.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                <th style={thStyle}>Speed \ Freq</th>
                <th style={thStyle}>65 kHz</th>
                <th style={thStyle}>100 kHz</th>
                <th style={thStyle}>150 kHz</th>
                <th style={thStyle}>200 kHz</th>
                <th style={thStyle}>300 kHz</th>
              </tr>
            </thead>
            <tbody>
              {[
                { speed: "100 mm/s", colors: ["Copper/rose", "Peach/rose", "Lavender/pink", "Bright pink", "Dark brown"] },
                { speed: "150 mm/s", colors: ["Light pink", "Blue/cyan", "Green/teal", "Rose/pink", "Rose/pink"] },
                { speed: "200 mm/s", colors: ["GREEN", "BLUE", "Purple/mauve", "Pink/rose", "Pink"] },
                { speed: "300 mm/s", colors: ["Gold/tan", "Grey/olive", "Brown", "\u2014", "\u2014"] },
                { speed: "400 mm/s", colors: ["Gold/copper", "Brown", "Olive/grey", "Brown", "Brown"] },
              ].map((row) => (
                <tr key={row.speed} style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "var(--text-bright)" }}>{row.speed}</td>
                  {row.colors.map((c, i) => {
                    const isBreakthrough = ["GREEN", "BLUE"].includes(c) || c.includes("pink") || c.includes("Pink") || c.includes("purple") || c.includes("Purple") || c.includes("Lavender") || c.includes("cyan") || c.includes("teal") || c.includes("Blue") || c.includes("Green");
                    return (
                      <td key={i} style={{
                        ...tdStyle,
                        color: isBreakthrough ? "var(--status-green)" : "var(--text-dim)",
                        fontWeight: isBreakthrough ? 600 : 400,
                      }}>
                        {c}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </DataCard>
      </div>

      {/* Next Steps */}
      <div className="section">
        <DataCard title="Next Steps">
          <ol style={{ margin: 0, padding: "0 0 0 20px", fontSize: 13, lineHeight: 2 }}>
            <li style={{ color: "var(--text-bright)" }}>Buy vibratory tumbler (Harbor Freight 18 lb — scheduled 2026-03-23)</li>
            <li style={{ color: "var(--text-bright)" }}>Tumble test batch of blanks (2-4 hours ceramic media)</li>
            <li style={{ color: "var(--text-bright)" }}>Burn validation squares on tumbled finish</li>
            <li style={{ color: "var(--text-bright)" }}>Lock production presets</li>
            <li style={{ color: "var(--text-bright)" }}>Test on actual bracelet design (reverse etch)</li>
            <li style={{ color: "var(--text-dim)" }}>Future: Explore gcode direct generation</li>
          </ol>
        </DataCard>
      </div>
    </PageShell>
  );
}
