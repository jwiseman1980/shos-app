import { redirect } from "next/navigation";

// Root route → Feed (triage queue)
export default function RootPage() {
  redirect("/dashboard/today");
}
