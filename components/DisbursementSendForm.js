"use client";

import { useState } from "react";

export default function DisbursementSendForm({ org, cycleMonth, cycleYear, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(org.amountDue || org.outstandingBalance));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [confirmation, setConfirmation] = useState("");
  const [method, setMethod] = useState("PayPal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (org.status === "complete") {
    return (
      <span style={{ fontSize: 12, color: "var(--status-green)", fontWeight: 600 }}>
        Sent ${org.amountSent.toLocaleString()}
      </span>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/finance/disbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.orgId,
          amount: parseFloat(amount),
          disbursementDate: date,
          confirmationNumber: confirmation,
          paymentMethod: method,
          cycleMonth,
          cycleYear,
          receiptCaptured: !!confirmation,
          fundType: "Restricted",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="btn btn-primary"
        style={{ fontSize: 12, padding: "4px 12px" }}
        onClick={() => setOpen(true)}
      >
        {org.status === "partial" ? "Send More" : "Mark as Sent"}
      </button>

      {open && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{
            background: "var(--surface-2)", border: "1px solid var(--border)",
            borderRadius: 8, padding: 24, width: 380, maxWidth: "90vw",
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-bright)", marginBottom: 16 }}>
              Disbursement — {org.orgName}
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Amount
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                  className="input"
                />
              </label>

              <label style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Date Sent
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                  className="input"
                />
              </label>

              <label style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Payment Method
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                  className="input"
                >
                  <option>PayPal</option>
                  <option>Check</option>
                  <option>Bank Transfer</option>
                  <option>Venmo</option>
                  <option>Zelle</option>
                  <option>Other</option>
                </select>
              </label>

              <label style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Confirmation # (optional — marks receipt captured)
                <input
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="PayPal transaction ID, check #, etc."
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                  className="input"
                />
              </label>

              {error && (
                <div style={{ fontSize: 12, color: "var(--status-red)" }}>{error}</div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  {loading ? "Saving..." : "Confirm & Save"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOpen(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
