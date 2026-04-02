import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import GystNav from "@/components/GystNav";

export default async function GystLayout({ children }) {
  const user = await getSessionUser();
  if (!user?.isFounder) redirect("/");

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-bright)" }}>GYST</h1>
        <p style={{ fontSize: 12, color: "var(--text-dim)" }}>Personal operations — founder only</p>
      </div>
      <GystNav />
      {children}
    </div>
  );
}
