"use client";

import { useState, useRef } from "react";

const BANK_ACCOUNTS = [
  { value: "Checking-2352", label: "Chase Checking (...2352)" },
  { value: "CC-3418", label: "Chase Credit Card (...3418)" },
];

export default function ExpenseUploader({ month, year, onUploadComplete }) {
  const [bankAccount, setBankAccount] = useState("Checking-2352");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith(".csv")) {
      setError("Please upload a .csv file");
      return;
    }

    setUploading(true);
    setError(null);
    setPreview(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bankAccount", bankAccount);
      formData.append("month", month);
      formData.append("year", year);

      const res = await fetch("/api/finance/expenses/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Upload failed");
        return;
      }

      setPreview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!preview?.rows) return;
    setUploading(true);
    setError(null);

    try {
      const res = await fetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: preview.rows,
          month,
          year,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Save failed");
        return;
      }

      setPreview(null);
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const activeCount = preview ? preview.rows.filter((r) => !r.isExcluded && !r.isCredit).length : 0;
  const excludedCount = preview ? preview.rows.filter((r) => r.isExcluded).length : 0;
  const creditCount = preview ? preview.rows.filter((r) => r.isCredit && !r.isExcluded).length : 0;

  return (
    <div>
      {/* Bank account selector */}
      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <label className="form-label" style={{ margin: 0 }}>Bank Account</label>
        {BANK_ACCOUNTS.map((ba) => (
          <button
            key={ba.value}
            onClick={() => setBankAccount(ba.value)}
            className={bankAccount === ba.value ? "btn btn-primary" : "btn btn-ghost"}
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            {ba.label}
          </button>
        ))}
      </div>

      {/* Upload zone */}
      {!preview && (
        <div
          className={`upload-zone ${dragOver ? "dragover" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {uploading ? (
            <div className="upload-zone-text">Parsing CSV...</div>
          ) : (
            <div className="upload-zone-text">
              <strong>Drop Chase CSV here</strong> or click to browse
              <div style={{ fontSize: 11, marginTop: 4 }}>
                Download from chase.com &rarr; Statements &amp; Documents &rarr; Download Transactions
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: "8px 12px", background: "var(--status-red-bg)", color: "var(--status-red)", borderRadius: "var(--radius-sm)", marginTop: 12, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12 }}>
              <span style={{ color: "var(--text-dim)" }}>Total rows:</span>{" "}
              <strong style={{ color: "var(--text-bright)" }}>{preview.rows.length}</strong>
            </div>
            <div style={{ fontSize: 12 }}>
              <span style={{ color: "var(--text-dim)" }}>Expenses:</span>{" "}
              <strong style={{ color: "var(--status-green)" }}>{activeCount}</strong>
            </div>
            <div style={{ fontSize: 12 }}>
              <span style={{ color: "var(--text-dim)" }}>Excluded:</span>{" "}
              <strong style={{ color: "var(--text-dim)" }}>{excludedCount}</strong>
            </div>
            {creditCount > 0 && (
              <div style={{ fontSize: 12 }}>
                <span style={{ color: "var(--text-dim)" }}>Credits/Refunds:</span>{" "}
                <strong style={{ color: "var(--status-blue)" }}>{creditCount}</strong>
              </div>
            )}
            {preview.errors?.length > 0 && (
              <div style={{ fontSize: 12 }}>
                <span style={{ color: "var(--status-orange)" }}>Parse warnings: {preview.errors.length}</span>
              </div>
            )}
          </div>

          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <table className="data-table" style={{ width: "100%", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Date</th>
                  <th style={{ textAlign: "left" }}>Description</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "left" }}>Category</th>
                  <th style={{ textAlign: "left" }}>Vendor</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} style={{ opacity: row.isExcluded ? 0.4 : 1 }}>
                    <td style={{ whiteSpace: "nowrap" }}>{row.transactionDate}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.description}
                    </td>
                    <td style={{
                      textAlign: "right",
                      fontWeight: 600,
                      color: row.isCredit ? "var(--status-blue)" : "var(--text-bright)",
                    }}>
                      {row.isCredit ? "-" : ""}${Math.abs(row.amount).toFixed(2)}
                    </td>
                    <td style={{ color: "var(--text-dim)", fontSize: 10 }}>
                      {row.isExcluded ? "—" : (row.category || "Uncategorized")}
                    </td>
                    <td style={{ color: "var(--text-dim)", fontSize: 10 }}>{row.vendor || "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      {row.isExcluded ? (
                        <span className="badge badge-gray" style={{ fontSize: 9 }}>Excluded</span>
                      ) : row.isCredit ? (
                        <span className="badge badge-blue" style={{ fontSize: 9 }}>Credit</span>
                      ) : (
                        <span className="badge badge-green" style={{ fontSize: 9 }}>Expense</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={uploading}
            >
              {uploading ? "Saving..." : `Save ${activeCount} Expenses to Salesforce`}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => { setPreview(null); setError(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
