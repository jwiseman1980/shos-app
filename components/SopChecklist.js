"use client";

import { useState, useEffect, useRef } from "react";

const WHO_COLORS = {
  joseph: { bg: "var(--gold)", text: "#000", label: "Joseph" },
  chris: { bg: "var(--status-blue)", text: "#fff", label: "Chris" },
  sara: { bg: "var(--status-purple)", text: "#fff", label: "Sara" },
  volunteer: { bg: "var(--status-green)", text: "#fff", label: "Volunteer" },
  operator: { bg: "var(--status-orange)", text: "#fff", label: "Operator" },
  automated: { bg: "var(--text-dim)", text: "#fff", label: "Automated" },
};

const HISTORY_KEY = "shos-sop-run-history";

function getRunHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRunToHistory(run) {
  const history = getRunHistory();
  history.unshift(run);
  if (history.length > 100) history.length = 100;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export default function SopChecklist({ sopId, sopTitle, steps }) {
  const storageKey = `shos-sop-run-${sopId}`;
  const [checked, setChecked] = useState({});
  const [hydrated, setHydrated] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [slackResult, setSlackResult] = useState(null);
  const [runHistory, setRunHistory] = useState([]);
  const hasLoggedRef = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setChecked(parsed.checked || {});
      }
      const allHistory = getRunHistory();
      setRunHistory(allHistory.filter((r) => r.sopId === sopId).slice(0, 5));
    } catch (e) {
      // ignore
    }
    setHydrated(true);
  }, [storageKey, sopId]);

  // Save checked state
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ checked }));
    } catch (e) {
      // ignore
    }
  }, [checked, hydrated, storageKey]);

  const completedCount = Object.values(checked).filter(Boolean).length;
  const totalSteps = steps.length;
  const progress =
    totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const allDone = completedCount === totalSteps && totalSteps > 0;

  // Auto-log when all steps are checked
  useEffect(() => {
    if (!hydrated || !allDone || hasLoggedRef.current) return;
    hasLoggedRef.current = true;
    setJustCompleted(true);

    const runData = {
      sopId,
      sopTitle,
      completedSteps: totalSteps,
      totalSteps,
      completedAt: new Date().toISOString(),
      runner: "Joseph Wiseman",
    };

    // Save locally
    saveRunToHistory(runData);
    const allHistory = getRunHistory();
    setRunHistory(allHistory.filter((r) => r.sopId === sopId).slice(0, 5));

    // Post to API (Slack)
    fetch("/api/sop-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runData),
    })
      .then((res) => res.json())
      .then((result) => {
        setSlackResult(result.slack ? "posted" : "not-configured");
      })
      .catch(() => {
        setSlackResult("error");
      });
  }, [hydrated, allDone, sopId, sopTitle, totalSteps]);

  // Reset the logged flag when unchecking
  useEffect(() => {
    if (!allDone) {
      hasLoggedRef.current = false;
      setJustCompleted(false);
      setSlackResult(null);
    }
  }, [allDone]);

  function handleToggle(stepNum) {
    setChecked((prev) => ({ ...prev, [stepNum]: !prev[stepNum] }));
  }

  function handleClear() {
    setChecked({});
    hasLoggedRef.current = false;
    setJustCompleted(false);
    setSlackResult(null);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      // ignore
    }
  }

  if (!hydrated) {
    return (
      <div style={{ padding: 24, color: "var(--text-dim)", fontSize: 13 }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      {/* Completion Banner */}
      {justCompleted && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid var(--status-green)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--status-green)",
              }}
            >
              Done — logged.
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
              {slackResult === "posted"
                ? "Posted to Slack"
                : slackResult === "not-configured"
                ? "Slack webhook not configured yet"
                : slackResult === "error"
                ? "Slack post failed — logged locally"
                : "Logging..."}
            </div>
          </div>
          <button
            onClick={handleClear}
            style={{
              padding: "6px 14px",
              background: "transparent",
              color: "var(--text-dim)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Progress - only show when partially done */}
      {completedCount > 0 && !allDone && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              marginBottom: 6,
            }}
          >
            <span style={{ color: "var(--text-dim)" }}>
              {completedCount} of {totalSteps}
            </span>
            <button
              onClick={handleClear}
              style={{
                background: "none",
                border: "none",
                fontSize: 11,
                color: "var(--text-dim)",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              clear
            </button>
          </div>
          <div
            style={{
              height: 4,
              background: "var(--card-border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "var(--gold)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((step) => {
          const isChecked = !!checked[step.step];
          const whoConfig = WHO_COLORS[step.who] || WHO_COLORS.operator;

          return (
            <div
              key={step.step}
              onClick={() => handleToggle(step.step)}
              style={{
                display: "flex",
                gap: 12,
                padding: "14px 16px",
                background: isChecked
                  ? "rgba(34, 197, 94, 0.06)"
                  : "var(--card-bg)",
                border: isChecked
                  ? "1px solid rgba(34, 197, 94, 0.3)"
                  : "1px solid var(--card-border)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {/* Checkbox */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border: isChecked
                    ? "2px solid var(--status-green)"
                    : "2px solid var(--card-border)",
                  background: isChecked
                    ? "var(--status-green)"
                    : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 1,
                  transition: "all 0.15s ease",
                }}
              >
                {isChecked && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                  >
                    <path
                      d="M3 7L6 10L11 4"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              {/* Step Content */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-dim)",
                      minWidth: 20,
                    }}
                  >
                    {step.step}.
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: isChecked
                        ? "var(--text-dim)"
                        : "var(--text-bright)",
                      textDecoration: isChecked
                        ? "line-through"
                        : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {step.title}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      background: whoConfig.bg,
                      color: whoConfig.text,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {whoConfig.label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-dim)",
                    lineHeight: 1.5,
                    paddingLeft: 28,
                  }}
                >
                  {step.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Run History */}
      {runHistory.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            History
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {runHistory.map((run, i) => {
              const date = new Date(run.completedAt || run.timestamp);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 12px",
                    background: "var(--bg)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 12,
                    color: "var(--text-dim)",
                  }}
                >
                  <span>
                    {date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    at{" "}
                    {date.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--status-green)",
                      }}
                    />
                    {run.slackPosted && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          background: "var(--status-blue)",
                          color: "#fff",
                          borderRadius: "var(--radius-sm)",
                          fontWeight: 600,
                        }}
                      >
                        SLACK
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
