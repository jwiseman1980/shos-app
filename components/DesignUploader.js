"use client";

import { useState, useRef } from "react";

const statusColors = {
  Queued: { bg: "#6b728022", text: "#6b7280" },
  "In Progress": { bg: "#3b82f622", text: "#3b82f6" },
  Submitted: { bg: "#f59e0b22", text: "#f59e0b" },
  Complete: { bg: "#22c55e22", text: "#22c55e" },
};

const priorityColors = {
  Urgent: { bg: "#ef444422", text: "#ef4444" },
  High: { bg: "#f59e0b22", text: "#f59e0b" },
  Normal: { bg: "#6b728022", text: "#6b7280" },
  Low: { bg: "#6b728022", text: "#52525b" },
};

function Badge({ value, colors }) {
  const c = colors[value] || { bg: "#6b728022", text: "#6b7280" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 12,
      fontSize: 11, fontWeight: 600, background: c.bg, color: c.text,
    }}>
      {value}
    </span>
  );
}

function DesignCard({ item, onStatusChange, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith(".svg")) {
      setUploadResult({ error: "Only SVG files accepted" });
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sku", item.sku);
      formData.append("heroId", item.id);

      const res = await fetch("/api/designs/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (data.success) {
        setUploadResult({ success: true, viewLink: data.viewLink });
        if (onUpload) onUpload(item.id);
      } else {
        setUploadResult({ error: data.message || data.error || "Upload failed" });
      }
    } catch (err) {
      setUploadResult({ error: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const handleStatusClick = async (newStatus) => {
    try {
      const res = await fetch("/api/designs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroId: item.id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success && onStatusChange) {
        onStatusChange(item.id, newStatus);
      }
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  return (
    <div style={{
      background: "var(--card-bg)",
      border: dragOver ? "2px dashed var(--gold)" : "1px solid var(--card-border)",
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      transition: "border 0.2s",
    }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-bright)" }}>
            {item.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
            {item.sku} {"\u00b7"} {item.branch}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Badge value={item.designPriority} colors={priorityColors} />
          <Badge value={item.designStatus} colors={statusColors} />
        </div>
      </div>

      {/* Design Brief */}
      {item.designBrief && (
        <div style={{
          background: "var(--bg)",
          border: "1px solid var(--card-border)",
          borderRadius: 6,
          padding: 10,
          fontSize: 12,
          color: "var(--text-dim)",
          lineHeight: 1.6,
          marginBottom: 12,
          whiteSpace: "pre-wrap",
        }}>
          {item.designBrief}
        </div>
      )}

      {/* Due Date */}
      {item.designDueDate && (
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
          Due: <span style={{ color: "var(--text-bright)", fontWeight: 500 }}>
            {new Date(item.designDueDate).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Upload Area */}
      <div style={{
        border: "1px dashed var(--card-border)",
        borderRadius: 6,
        padding: 16,
        textAlign: "center",
        marginBottom: 12,
        background: dragOver ? "rgba(201, 168, 76, 0.05)" : "transparent",
      }}>
        {uploading ? (
          <div style={{ fontSize: 13, color: "var(--gold)" }}>Uploading...</div>
        ) : uploadResult?.success ? (
          <div>
            <div style={{ fontSize: 13, color: "var(--status-green)", marginBottom: 4 }}>
              {"\u2713"} Design uploaded successfully
            </div>
            {uploadResult.viewLink && (
              <a href={uploadResult.viewLink} target="_blank" rel="noopener"
                style={{ fontSize: 11, color: "var(--status-blue)" }}>
                View in Drive
              </a>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 8 }}>
              Drag & drop SVG here, or{" "}
              <span
                onClick={() => fileRef.current?.click()}
                style={{ color: "var(--gold)", cursor: "pointer", textDecoration: "underline" }}
              >
                browse
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
              File should be named {item.sku}.svg
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".svg"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        )}
        {uploadResult?.error && (
          <div style={{ fontSize: 12, color: "var(--status-red)", marginTop: 4 }}>
            {uploadResult.error}
          </div>
        )}
      </div>

      {/* Status Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {item.designStatus === "Queued" && (
          <button onClick={() => handleStatusClick("In Progress")} style={btnStyle("#3b82f6")}>
            Start Working
          </button>
        )}
        {item.designStatus === "In Progress" && (
          <button onClick={() => handleStatusClick("Submitted")} style={btnStyle("#f59e0b")}>
            Mark Submitted
          </button>
        )}
        {item.designStatus === "Submitted" && (
          <button onClick={() => handleStatusClick("Complete")} style={btnStyle("#22c55e")}>
            Approve Design
          </button>
        )}
      </div>
    </div>
  );
}

const btnStyle = (color) => ({
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  border: "none",
  background: color + "22",
  color: color,
  cursor: "pointer",
});

export default function DesignUploader({ queue = [], needsDesign = [] }) {
  const [items, setItems] = useState(queue);

  const handleStatusChange = (id, newStatus) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, designStatus: newStatus } : item
      )
    );
  };

  const handleUpload = (id) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, designStatus: "Submitted", hasDesign: true } : item
      )
    );
  };

  const handleQueue = async (hero) => {
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroId: hero.id, priority: "Normal" }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => [...prev, { ...hero, designStatus: "Queued", designPriority: "Normal" }]);
      }
    } catch (err) {
      console.error("Queue failed:", err);
    }
  };

  const activeItems = items.filter((i) => i.designStatus !== "Complete");
  const completedItems = items.filter((i) => i.designStatus === "Complete");

  return (
    <div>
      {/* Active Design Tasks */}
      {activeItems.length > 0 ? (
        activeItems.map((item) => (
          <DesignCard
            key={item.id}
            item={item}
            onStatusChange={handleStatusChange}
            onUpload={handleUpload}
          />
        ))
      ) : (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
          No active design tasks. Queue heroes from the "Needs Design" section below.
        </div>
      )}

      {/* Needs Design — Queue Button */}
      {needsDesign.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-bright)", marginBottom: 12 }}>
            Queue for Design ({needsDesign.length})
          </h3>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            Click "Queue" to add a hero to the design queue and assign to Ryan.
          </div>
          {needsDesign.slice(0, 20).map((hero) => (
            <div key={hero.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 12px", borderBottom: "1px solid var(--card-border)",
            }}>
              <div>
                <span style={{ fontSize: 13, color: "var(--text-bright)" }}>{hero.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>{hero.sku}</span>
              </div>
              <button onClick={() => handleQueue(hero)} style={btnStyle("#c9a84c")}>
                Queue
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
