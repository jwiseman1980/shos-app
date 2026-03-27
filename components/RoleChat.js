"use client";

import { useState, useRef, useEffect } from "react";

const ROLE_COLORS = {
  ed:     "#c4a237",
  cos:    "#b0b8c4",
  cfo:    "#27ae60",
  coo:    "#e67e22",
  comms:  "#8e44ad",
  dev:    "#3498db",
  family: "#e74c3c",
};

const ROLE_NAMES = {
  ed:     "Executive Director",
  cos:    "Chief of Staff",
  cfo:    "CFO",
  coo:    "COO",
  comms:  "Communications",
  dev:    "Development",
  family: "Family Relations",
};

// Opening brief sent automatically when session starts
const OPENING_PROMPT = "Brief me. Read my context file, tell me what's open and what needs my attention today, then ask what I want to work on.";

export default function RoleChat({ role, onClose }) {
  const [messages, setMessages] = useState([]);        // API message history
  const [displayMessages, setDisplayMessages] = useState([]); // UI messages
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolsActive, setToolsActive] = useState([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const color = ROLE_COLORS[role] || "#c4a237";
  const roleName = ROLE_NAMES[role] || role.toUpperCase();

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, loading]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  // Start session automatically with the opening brief
  useEffect(() => {
    if (!sessionStarted) {
      setSessionStarted(true);
      sendMessage(OPENING_PROMPT, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(text, isAuto = false) {
    if (!text.trim() || loading) return;

    const userMsg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    if (!isAuto) {
      setDisplayMessages((prev) => [...prev, { type: "user", text: text.trim() }]);
    } else {
      setDisplayMessages((prev) => [...prev, {
        type: "system",
        text: `Opening ${roleName} session...`,
      }]);
    }
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, messages: newMessages }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      // Add assistant response to API history
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);

      // Show in UI
      setDisplayMessages((prev) => {
        // Remove the "opening session..." system message if it was the auto opener
        const filtered = isAuto ? prev.filter((m) => m.type !== "system") : prev;
        return [...filtered, {
          type: "assistant",
          text: data.response,
          toolsUsed: data.toolsUsed || [],
        }];
      });

    } catch (e) {
      setError("Network error — check your connection");
    }

    setLoading(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const quickActions = [
    { label: "Closeout session", text: "We're done. Write the session closeout — update the context file with what we did, any decisions made, and what's next." },
    { label: "Log friction", text: "Something I want to flag for the build queue:" },
    { label: "What's open?", text: "What are the open todos and what should I prioritize?" },
    { label: "Query SF", text: "Pull the latest data from Salesforce for" },
  ];

  return (
    <div className="role-chat-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="role-chat-panel" style={{ "--chat-color": color }}>

        {/* Header */}
        <div className="role-chat-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="role-chat-dot" style={{ background: color }} />
            <div>
              <div className="role-chat-title">{roleName}</div>
              <div className="role-chat-subtitle">SHOS Role Session</div>
            </div>
          </div>
          <button className="role-chat-close" onClick={onClose}>✕</button>
        </div>

        {/* Messages */}
        <div className="role-chat-messages">
          {displayMessages.map((msg, i) => (
            <div key={i} className={`role-chat-msg role-chat-msg-${msg.type}`}>
              {msg.type === "assistant" && (
                <div className="role-chat-msg-label" style={{ color }}>
                  {roleName}
                  {msg.toolsUsed?.length > 0 && (
                    <span className="role-chat-tools-used">
                      {msg.toolsUsed.map((t) => t.replace(/_/g, " ")).join(" · ")}
                    </span>
                  )}
                </div>
              )}
              <div className="role-chat-msg-text">
                {msg.text.split("\n").map((line, j) => (
                  <span key={j}>{line}{j < msg.text.split("\n").length - 1 && <br />}</span>
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <div className="role-chat-msg role-chat-msg-assistant">
              <div className="role-chat-msg-label" style={{ color }}>{roleName}</div>
              <div className="role-chat-thinking">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {error && (
            <div className="role-chat-error">
              {error.includes("ANTHROPIC_API_KEY") ? (
                <>
                  <strong>API key not configured.</strong> Add{" "}
                  <code>ANTHROPIC_API_KEY</code> to <code>.env.local</code> to
                  enable role agents. Get a key at{" "}
                  <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">
                    console.anthropic.com
                  </a>
                </>
              ) : (
                error
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick actions */}
        {displayMessages.length > 0 && !loading && (
          <div className="role-chat-quick">
            {quickActions.map((a) => (
              <button
                key={a.label}
                className="role-chat-quick-btn"
                onClick={() => {
                  setInput(a.text);
                  inputRef.current?.focus();
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="role-chat-input-row">
          <textarea
            ref={inputRef}
            className="role-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${roleName}...`}
            rows={2}
            disabled={loading}
          />
          <button
            className="role-chat-send"
            style={{ background: color }}
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
          >
            ↑
          </button>
        </div>
        <div className="role-chat-footer">
          Enter to send · Shift+Enter for newline · Session auto-closes out when you&apos;re done
        </div>

      </div>
    </div>
  );
}
