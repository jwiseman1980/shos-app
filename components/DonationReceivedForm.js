"use client";

import { useState } from "react";

const SOURCES = ["Donorbox", "Stripe", "PayPal", "Check", "Cash", "Event", "Other"];
const METHODS = ["Credit Card", "PayPal", "Check", "Cash", "ACH", "Zelle", "Wire", "Other"];
const RECEIPT_STATUSES = ["Sent", "Pending", "Not Required"];

export default function DonationReceivedForm({ onSaved }) {
  const [form, setForm] = useState({
    donorFirstName: "",
    donorLastName: "",
    donorEmail: "",
    amount: "",
    donationDate: new Date().toISOString().slice(0, 10),
    source: "Donorbox",
    paymentMethod: "Credit Card",
    restricted: false,
    designation: "",
    receiptStatus: "Pending",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.donationDate) {
      setError("Amount and date are required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/finance/donations-received", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          donationType: form.source,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to save");
        return;
      }

      setSuccess(true);
      setForm((f) => ({
        ...f,
        donorFirstName: "",
        donorLastName: "",
        donorEmail: "",
        amount: "",
        designation: "",
        notes: "",
      }));

      if (onSaved) onSaved();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
        <div className="form-group">
          <label className="form-label">First Name</label>
          <input
            className="form-input"
            value={form.donorFirstName}
            onChange={(e) => update("donorFirstName", e.target.value)}
            placeholder="Donor first name"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Last Name</label>
          <input
            className="form-input"
            value={form.donorLastName}
            onChange={(e) => update("donorLastName", e.target.value)}
            placeholder="Donor last name"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            className="form-input"
            type="email"
            value={form.donorEmail}
            onChange={(e) => update("donorEmail", e.target.value)}
            placeholder="donor@example.com"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Amount *</label>
          <input
            className="form-input"
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => update("amount", e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Date *</label>
          <input
            className="form-input"
            type="date"
            value={form.donationDate}
            onChange={(e) => update("donationDate", e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Source</label>
          <select
            className="form-select"
            value={form.source}
            onChange={(e) => update("source", e.target.value)}
          >
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Payment Method</label>
          <select
            className="form-select"
            value={form.paymentMethod}
            onChange={(e) => update("paymentMethod", e.target.value)}
          >
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Receipt Status</label>
          <select
            className="form-select"
            value={form.receiptStatus}
            onChange={(e) => update("receiptStatus", e.target.value)}
          >
            {RECEIPT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.restricted}
              onChange={(e) => update("restricted", e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            Restricted Donation
          </label>
        </div>
        {form.restricted && (
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Designation</label>
            <input
              className="form-input"
              value={form.designation}
              onChange={(e) => update("designation", e.target.value)}
              placeholder="What is this donation restricted to?"
            />
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: "8px 12px", background: "var(--status-red-bg)", color: "var(--status-red)", borderRadius: "var(--radius-sm)", marginBottom: 12, fontSize: 12 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "8px 12px", background: "var(--status-green-bg)", color: "var(--status-green)", borderRadius: "var(--radius-sm)", marginBottom: 12, fontSize: 12 }}>
          Donation saved to Salesforce
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving}
        style={{ marginTop: 8 }}
      >
        {saving ? "Saving..." : "Save Donation"}
      </button>
    </form>
  );
}
