"use client";

import RoleChat from "@/components/RoleChat";

/**
 * Dashboard-specific chat: renders the Operator inline at the bottom of the
 * cockpit layout. Always visible — no floating button needed.
 */
export default function DashboardChat({ currentUser }) {
  return (
    <div className="dashboard-chat">
      <RoleChat pathname="/" currentUser={currentUser} bottomMode />
    </div>
  );
}
