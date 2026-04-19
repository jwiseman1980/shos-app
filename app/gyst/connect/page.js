"use client";

import { useEffect, useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";

export default function ConnectPage() {
  const [linkToken, setLinkToken] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | syncing | done | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setLinkToken(d.link_token))
      .catch(() => setMessage("Failed to initialize Plaid. Check credentials."));

    loadAccounts();
  }, []);

  async function loadAccounts() {
    const res = await fetch("/api/plaid/accounts");
    if (res.ok) {
      const d = await res.json();
      setAccounts(d.accounts || []);
    }
  }

  const onSuccess = useCallback(async (public_token, metadata) => {
    setStatus("loading");
    try {
      const exRes = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token,
          institution: metadata.institution,
        }),
      });
      if (!exRes.ok) throw new Error("Exchange failed");

      setStatus("syncing");
      setMessage("Syncing accounts and transactions...");

      await fetch("/api/plaid/accounts", { method: "POST" });
      await fetch("/api/plaid/sync-transactions", { method: "POST" });

      await loadAccounts();
      setStatus("done");
      setMessage("Connected! Transactions are syncing in the background.");
    } catch {
      setStatus("error");
      setMessage("Connection failed. Please try again.");
    }
  }, []);

  const config = { token: linkToken, onSuccess };
  const { open, ready } = usePlaidLink(config);

  const handleSync = async () => {
    setStatus("syncing");
    setMessage("Syncing...");
    await fetch("/api/plaid/accounts", { method: "POST" });
    await fetch("/api/plaid/sync-transactions", { method: "POST" });
    await loadAccounts();
    setStatus("done");
    setMessage("Sync complete.");
  };

  const totalBalance = accounts.reduce((sum, a) => {
    if (a.type === "credit") return sum;
    return sum + (a.current_balance || 0);
  }, 0);

  return (
    <div style={{ padding: "32px", maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-bright)", marginBottom: 4 }}>
        Bank Accounts
      </h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 32, fontSize: 14 }}>
        Connect USAA and other accounts for automatic transaction sync. No more CSV imports.
      </p>

      {/* Action bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        <button
          onClick={() => open()}
          disabled={!ready || status === "loading" || status === "syncing"}
          style={btnStyle("#c4a237")}
        >
          + Connect Account
        </button>
        {accounts.length > 0 && (
          <button
            onClick={handleSync}
            disabled={status === "syncing"}
            style={btnStyle("var(--border)")}
          >
            {status === "syncing" ? "Syncing..." : "Sync Now"}
          </button>
        )}
      </div>

      {message && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            marginBottom: 24,
            background: status === "error" ? "rgba(220,53,69,0.12)" : "rgba(196,162,55,0.1)",
            color: status === "error" ? "#f66" : "#c4a237",
            fontSize: 13,
            border: `1px solid ${status === "error" ? "rgba(220,53,69,0.3)" : "rgba(196,162,55,0.3)"}`,
          }}
        >
          {message}
        </div>
      )}

      {/* Net balance strip */}
      {accounts.length > 0 && (
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "20px 24px",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "var(--text-dim)", fontSize: 13 }}>Total Cash Balance</span>
          <span style={{ fontSize: 26, fontWeight: 700, color: "#c4a237" }}>
            {fmt(totalBalance)}
          </span>
        </div>
      )}

      {/* Accounts list */}
      {accounts.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {accounts.map((a) => (
            <div
              key={a.id}
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "14px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-bright)", fontSize: 14 }}>
                  {a.name} {a.mask ? `••••${a.mask}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                  {a.institution} · {a.subtype || a.type}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: "var(--text-bright)", fontSize: 16 }}>
                  {a.current_balance != null ? fmt(a.current_balance) : "—"}
                </div>
                {a.available_balance != null && a.available_balance !== a.current_balance && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    {fmt(a.available_balance)} avail
                  </div>
                )}
                {a.last_synced_at && (
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                    {new Date(a.last_synced_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            color: "var(--text-dim)",
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏦</div>
          <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>
            No accounts connected
          </div>
          <div style={{ fontSize: 13 }}>
            Click "Connect Account" to link USAA or other institutions.
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function btnStyle(bg) {
  return {
    background: bg === "#c4a237" ? "#c4a237" : "transparent",
    color: bg === "#c4a237" ? "#0e0e12" : "var(--text)",
    border: `1px solid ${bg === "#c4a237" ? "#c4a237" : "var(--border)"}`,
    borderRadius: 6,
    padding: "8px 18px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  };
}
