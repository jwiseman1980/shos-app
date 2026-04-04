"use client";

import EmailInbox from "@/components/EmailInbox";

export default function EmailPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>Email Triage</h1>
        <p className="page-subtitle">joseph.wiseman@steel-hearts.org — Triage, respond, and convert to tasks</p>
      </div>

      <EmailInbox mailbox="joseph" />
    </div>
  );
}
