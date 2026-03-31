import DataCard from "@/components/DataCard";
import IdeasForm from "@/components/IdeasForm";
import { getServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const sb = getServerClient();
  const { data: ideas } = await sb
    .from("friction_logs")
    .select("*")
    .in("type", ["idea", "feature", "bug"])
    .eq("status", "open")
    .order("logged_date", { ascending: false })
    .limit(30);

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)" }}>
          Ideas &amp; Proposals
        </div>
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0" }}>
          Submit ideas from anywhere. The Architect picks them up in build sessions.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <DataCard title="Submit an Idea">
          <IdeasForm />
        </DataCard>

        <DataCard title={`Open Queue (${ideas?.length || 0})`}>
          {!ideas?.length ? (
            <p style={{ fontSize: 13, color: "var(--text-dim)", padding: 16 }}>
              No open ideas. The queue is clear.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
              {ideas.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: "10px 14px",
                    background: "var(--bg)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: `3px solid ${
                      item.priority === "high" ? "#e74c3c" :
                      item.priority === "medium" ? "#c4a237" : "var(--border)"
                    }`,
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500, marginBottom: 4 }}>
                    {item.description?.split("\n")[0] || "Untitled"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", gap: 12 }}>
                    <span>{item.priority}</span>
                    <span>{item.type}</span>
                    <span>{item.logged_date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataCard>
      </div>
    </>
  );
}
