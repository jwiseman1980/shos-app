import "./globals.css";
import ConsoleShell from "@/components/ConsoleShell";
import { isAuthenticated, getSessionUser } from "@/lib/auth";
import { headers } from "next/headers";
import { loadQueueItems, loadRecentDomains, mergeCalendarAndQueue } from "@/lib/data/dashboard";
import { buildQueue } from "@/lib/priority-engine";
import { getTodayEvents } from "@/lib/calendar";
import { listInbox } from "@/lib/gmail";

export const metadata = {
  title: "SHOS — Steel Hearts Operating System",
  description: "Internal operations dashboard for Steel Hearts Foundation",
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayRange() {
  const tz = "America/New_York";
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz });
  const etOffset = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value || "GMT-5";
  const m = etOffset.match(/GMT([+-])(\d+)/);
  const tzSuffix = m ? `${m[1]}${m[2].padStart(2, "0")}:00` : "-05:00";
  return {
    timeMin: `${todayStr}T00:00:00${tzSuffix}`,
    timeMax: `${todayStr}T23:59:59${tzSuffix}`,
  };
}

export default async function RootLayout({ children }) {
  const headersList = await headers();
  const url = headersList.get("x-url") || headersList.get("x-invoke-path") || "";
  const isLoginPage = url.includes("/login");

  const authenticated = await isAuthenticated();
  const showShell = authenticated && !isLoginPage;

  let user = null;
  let tasks = [];
  let calendarEvents = [];
  let emails = [];
  let greeting = "Good morning";

  if (showShell) {
    user = await getSessionUser();
    const firstName = user?.name?.split(" ")[0] || "Operator";
    greeting = `${getGreeting()}, ${firstName}`;

    const { timeMin, timeMax } = getTodayRange();

    const [
      { items, historicalAverages },
      recentDomains,
      calEvents,
      emailResult,
    ] = await Promise.all([
      loadQueueItems(user).catch(() => ({ items: [], historicalAverages: {} })),
      loadRecentDomains().catch(() => []),
      getTodayEvents({ timeMin, timeMax }).catch((err) => {
        if (!err.message?.includes("not configured")) {
          console.error("[layout] Calendar fetch failed:", err.message);
        }
        return [];
      }),
      listInbox({ maxResults: 30, query: "in:inbox" }).catch((err) => {
        console.error("[layout] Email fetch failed:", err.message);
        return { messages: [] };
      }),
    ]);

    calendarEvents = calEvents;
    const queue = buildQueue(items, recentDomains, historicalAverages);
    tasks = mergeCalendarAndQueue(calendarEvents, queue);

    emails = (emailResult.messages || []).map((msg) => ({
      id: msg.id,
      threadId: msg.threadId,
      subject: msg.subject || "(no subject)",
      from: msg.from || "",
      fromName: msg.from?.match(/^"?([^"<]*)"?\s*</)?.[1]?.trim() || msg.from,
      snippet: msg.snippet || "",
      date: msg.date,
      isUnread: msg.labelIds?.includes("UNREAD"),
      category: msg.category,
    }));
  }

  return (
    <html lang="en">
      <body>
        {showShell ? (
          <ConsoleShell
            user={user}
            tasks={tasks}
            calendarEvents={calendarEvents}
            emails={emails}
            greeting={greeting}
          >
            {children}
          </ConsoleShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
