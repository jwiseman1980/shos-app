"use client";

import { useState } from "react";

const FULFILLMENT_OPTIONS = [
  { value: "Design + Laser", label: "Design + Laser (new design needed)" },
  { value: "Laser Production", label: "Laser Production (design exists)" },
  { value: "Pre-Made Pull", label: "Pre-Made Pull (in stock)" },
];

const SOURCE_OPTIONS = ["Email", "Phone", "Social Media", "Referral", "App", "Other"];

export default function DonateForm() {
  const [form, setForm] = useState({
    heroName: "",
    recipientName: "",
    recipientEmail: "",
    quantity: "",
    quantity6: "",
    quantity7: "",
    fulfillmentMethod: "Design + Laser",
    source: "App",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.heroName.trim() || !form.recipientName.trim()) return;

    setSubmitting(true);
    setResult(null);

    try {
      const payload = {
        ...form,
        quantity: form.quantity ? parseInt(form.quantity, 10) : 0,
        quantity6: form.quantity6 ? parseInt(form.quantity6, 10) : 0,
        quantity7: form.quantity7 ? parseInt(form.quantity7, 10) : 0,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setResult({ type: "success", message: data.message || "Order created successfully" });
        setForm({
          heroName: "",
          recipientName: "",
          recipientEmail: "",
          quantity: "",
          quantity6: "",
          quantity7: "",
          fulfillmentMethod: "Design + Laser",
          source: "App",
          notes: "",
        });
      } else {
        setResult({ type: "error", message: data.error || data.message || "Failed to create order" });
      }
    } catch (err) {
      setResult({ type: "error", message: "Network error — please try again" });
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: "var(--bg)",
    color: "var(--text-bright)",
    border: "1px solid var(--card-border)",
    borderRadius: "var(--radius-sm)",
    padding: "6px 10px",
    fontSize: 13,
    width: "100%",
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 4,
    display: "block",
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Hero Name */}
        <div>
          <label style={labelStyle}>Hero Name *</label>
          <input
            type="text"
            value={form.heroName}
            onChange={handleChange("heroName")}
            placeholder="e.g. SSG John Smith"
            required
            style={inputStyle}
          />
        </div>

        {/* Recipient Name */}
        <div>
          <label style={labelStyle}>Recipient Name *</label>
          <input
            type="text"
            value={form.recipientName}
            onChange={handleChange("recipientName")}
            placeholder="e.g. Smith Family"
            required
            style={inputStyle}
          />
        </div>

        {/* Recipient Email */}
        <div>
          <label style={labelStyle}>Recipient Email</label>
          <input
            type="email"
            value={form.recipientEmail}
            onChange={handleChange("recipientEmail")}
            placeholder="email@example.com"
            style={inputStyle}
          />
        </div>

        {/* Source */}
        <div>
          <label style={labelStyle}>Source</label>
          <select
            value={form.source}
            onChange={handleChange("source")}
            style={inputStyle}
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Total Quantity */}
        <div>
          <label style={labelStyle}>Total Quantity</label>
          <input
            type="number"
            min="1"
            value={form.quantity}
            onChange={handleChange("quantity")}
            placeholder="Total bracelets"
            style={inputStyle}
          />
        </div>

        {/* Fulfillment Method */}
        <div>
          <label style={labelStyle}>Fulfillment Method</label>
          <select
            value={form.fulfillmentMethod}
            onChange={handleChange("fulfillmentMethod")}
            style={inputStyle}
          >
            {FULFILLMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 6-inch */}
        <div>
          <label style={labelStyle}>6-inch Qty</label>
          <input
            type="number"
            min="0"
            value={form.quantity6}
            onChange={handleChange("quantity6")}
            placeholder="0"
            style={inputStyle}
          />
        </div>

        {/* 7-inch */}
        <div>
          <label style={labelStyle}>7-inch Qty</label>
          <input
            type="number"
            min="0"
            value={form.quantity7}
            onChange={handleChange("quantity7")}
            placeholder="0"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Notes — full width */}
      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          value={form.notes}
          onChange={handleChange("notes")}
          placeholder="Special instructions, sizing notes, context..."
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {/* Submit */}
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={submitting || !form.heroName.trim() || !form.recipientName.trim()}
          style={{
            background: submitting ? "var(--card-border)" : "var(--gold)",
            color: submitting ? "var(--text-dim)" : "#000",
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 700,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Creating..." : "Submit Donated Bracelet Request"}
        </button>

        {result && (
          <span
            style={{
              fontSize: 12,
              color: result.type === "success" ? "var(--status-green)" : "var(--status-red)",
            }}
          >
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
