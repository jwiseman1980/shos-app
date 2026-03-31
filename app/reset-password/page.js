"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const email = params.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState(null); // null | "done" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setErrorMsg("Passwords don't match");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("done");
      } else {
        setErrorMsg(data.error || "Something went wrong");
      }
    } catch {
      setErrorMsg("Connection error");
    } finally {
      setLoading(false);
    }
  }

  if (!token || !email) {
    return (
      <p style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>
        Invalid reset link. <Link href="/forgot-password">Request a new one.</Link>
      </p>
    );
  }

  return status === "done" ? (
    <>
      <p style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "center", marginBottom: 16 }}>
        Password updated. You can now sign in.
      </p>
      <Link href="/login" className="login-btn" style={{ display: "block", textAlign: "center" }}>
        Sign In
      </Link>
    </>
  ) : (
    <form onSubmit={handleSubmit}>
      {errorMsg && <p className="login-error">{errorMsg}</p>}
      <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
        Setting password for <strong>{email}</strong>
      </p>
      <input
        type="password"
        className="login-input"
        placeholder="New password (8+ characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        minLength={8}
        required
      />
      <input
        type="password"
        className="login-input"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />
      <button type="submit" className="login-btn" disabled={loading}>
        {loading ? "Updating…" : "Set New Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="login-page">
      <div className="login-box">
        <img src="/brand/steel-hearts-logo-gold.svg" alt="Steel Hearts" style={{ width: 64, height: 64, margin: "0 auto 12px", display: "block" }} />
        <h1>SHOS</h1>
        <p className="login-subtitle">Set a new password</p>
        <Suspense fallback={<p style={{ color: "var(--text-dim)", textAlign: "center" }}>Loading…</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
