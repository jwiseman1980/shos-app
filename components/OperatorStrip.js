"use client";

import RoleChat from "@/components/RoleChat";

/**
 * Operator Strip — compact inline chat at the bottom of the console.
 *
 * Reuses RoleChat in bottomMode. Always visible, expands on focus.
 */
export default function OperatorStrip({ currentUser }) {
  return (
    <div className="operator-strip">
      <RoleChat pathname="/" currentUser={currentUser} bottomMode />
    </div>
  );
}
