"use client";

import { useState } from "react";
import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setStatus({ error: "New passwords don't match" });
      return;
    }

    if (newPassword.length < 8) {
      setStatus({ error: "Password must be at least 8 characters" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus({ success: "Password updated successfully" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setStatus({ error: data.error || "Failed to update password" });
      }
    } catch {
      setStatus({ error: "Connection error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell title="Settings" subtitle="Account preferences">
      <div className="section" style={{ maxWidth: 480 }}>
        <DataCard title="Change Password">
          <form onSubmit={handleSubmit}>
            {status?.error && (
              <div style={{ color: "var(--status-red)", fontSize: 13, marginBottom: 12 }}>
                {status.error}
              </div>
            )}
            {status?.success && (
              <div style={{ color: "var(--status-green)", fontSize: 13, marginBottom: 12 }}>
                {status.success}
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="login-input"
                style={{ width: "100%" }}
                required
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="login-input"
                style={{ width: "100%" }}
                required
                minLength={8}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="login-input"
                style={{ width: "100%" }}
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 20px", fontSize: 13, fontWeight: 600,
                borderRadius: 6, border: "none", cursor: "pointer",
                background: "var(--gold)", color: "#000",
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </DataCard>
      </div>
    </PageShell>
  );
}
