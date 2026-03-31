"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // null | "sent" | "error"
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus("sent");
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <img src="/brand/steel-hearts-logo-gold.svg" alt="Steel Hearts" style={{ width: 64, height: 64, margin: "0 auto 12px", display: "block" }} />
        <h1>SHOS</h1>
        <p className="login-subtitle">Reset your password</p>

        {status === "sent" ? (
          <>
            <p style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "center", marginBottom: 16 }}>
              If that email is registered, you'll receive a reset link shortly.
            </p>
            <Link href="/login" className="login-btn" style={{ display: "block", textAlign: "center" }}>
              Back to Sign In
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {status === "error" && (
              <p className="login-error">Something went wrong. Try again.</p>
            )}
            <input
              type="email"
              className="login-input"
              placeholder="Your steel-hearts.org email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
            <Link href="/login" style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--text-dim)" }}>
              Back to Sign In
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
