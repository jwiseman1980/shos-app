import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import { getVolunteers } from "@/lib/data/volunteers";

export default async function VolunteersPage() {
  const volunteers = await getVolunteers();

  return (
    <PageShell title="Volunteer Portal" subtitle={`${volunteers.length} team members`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {volunteers.map((v) => (
          <DataCard key={v.name}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: v.color, display: "flex", alignItems: "center",
                justifyContent: "center", fontWeight: 700, fontSize: 14,
                color: "#fff", flexShrink: 0,
              }}>
                {v.initials}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-bright)", fontSize: 14 }}>{v.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{v.role}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                  {v.domains.join(", ")}
                </div>
              </div>
            </div>
          </DataCard>
        ))}
      </div>
    </PageShell>
  );
}
