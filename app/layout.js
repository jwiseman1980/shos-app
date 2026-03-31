import "./globals.css";
import Sidebar from "@/components/Sidebar";
import FloatingRoleChat from "@/components/FloatingRoleChat";
import { isAuthenticated, getSessionUser } from "@/lib/auth";
import { headers } from "next/headers";

export const metadata = {
  title: "SHOS — Steel Hearts Operating System",
  description: "Internal operations dashboard for Steel Hearts Foundation",
};

export default async function RootLayout({ children }) {
  const headersList = await headers();
  const url = headersList.get("x-url") || headersList.get("x-invoke-path") || "";
  const isLoginPage = url.includes("/login");

  const authenticated = await isAuthenticated();
  const showSidebar = authenticated && !isLoginPage;

  // Don't show FloatingRoleChat on dashboard — it has the inline OperatorStrip
  const isDashboard = url === "/" || url === "" || url.endsWith("/shos-app");
  const showFloatingChat = showSidebar && !isDashboard;

  let user = null;
  if (showSidebar) {
    user = await getSessionUser();
  }

  return (
    <html lang="en">
      <body>
        {showSidebar ? (
          <div className="app-layout">
            <Sidebar user={user} />
            <main className="app-content">{children}</main>
            {showFloatingChat && (
              <FloatingRoleChat currentUser={user ? { name: user.name, email: user.email } : null} />
            )}
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
