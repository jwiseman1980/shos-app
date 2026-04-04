"use client";

import EmailInbox from "@/components/EmailInbox";

export default function CSInboxPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>Customer Service Inbox</h1>
        <p className="page-subtitle">contact@steel-hearts.org — Triage, respond, and archive customer inquiries</p>
      </div>

      <EmailInbox mailbox="contact" />
    </div>
  );
}
