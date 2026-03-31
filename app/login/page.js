"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error")
      ? "Invalid email or password"
      : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    // Only intercept if JS is fully ready
    if (!e.preventDefault) return;
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = await res.json();
        setError(data.error || "Invalid credentials");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form
        className="login-box"
        onSubmit={handleSubmit}
        action="/api/auth/form"
        method="post"
      >
        <img src="/brand/steel-hearts-logo-gold.svg" alt="Steel Hearts" style={{ width: 64, height: 64, margin: "0 auto 12px", display: "block" }} />
        <h1>SHOS</h1>
        <p className="login-subtitle">Steel Hearts Operating System</p>
        {error && <p className="login-error">{error}</p>}
        <input
          type="email"
          className="login-input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          autoComplete="email"
        />
        <input
          type="password"
          className="login-input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
        <a href="/forgot-password" style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--text-dim)" }}>
          Forgot password?
        </a>
      </form>
    </div>
  );
}
