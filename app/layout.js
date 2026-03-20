import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { isAuthenticated } from "@/lib/auth";
import { headers } from "next/headers";

export const metadata = {
  title: "SHOS — Steel Hearts Operating System",
  description: "Internal operations dashboard for Steel Hearts Foundation",
};

export default async function RootLayout({ children }) {
  // Check if we're on the login page by reading the header
  const headersList = await headers();
  const url = headersList.get("x-url") || headersList.get("x-invoke-path") || "";
  const isLoginPage = url.includes("/login");

  // Only show sidebar for authenticated pages
  const authenticated = await isAuthenticated();
  const showSidebar = authenticated && !isLoginPage;

  return (
    <html lang="en">
      <body>
        {showSidebar ? (
          <div className="app-layout">
            <Sidebar />
            <main className="app-content">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
