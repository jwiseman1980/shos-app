import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

// Root route → role-based home:
//   admin    → /dashboard/today (full triage feed)
//   manager  → /anniversaries (or whatever they manage)
//   volunteer/external → /me (their assignments)
export default async function RootPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(user.homeRoute || "/dashboard/today");
}
