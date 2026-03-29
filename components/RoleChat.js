"use client";

import { useState, useRef, useEffect } from "react";

const ROLE_COLORS = {
  ed:        "#c4a237",
  cos:       "#b0b8c4",
  cfo:       "#27ae60",
  coo:       "#e67e22",
  comms:     "#8e44ad",
  dev:       "#3498db",
  family:    "#e74c3c",
  architect: "#1abc9c",
};

const ROLE_NAMES = {
  ed:        "Executive Director",
  cos:       "Chief of Staff",
  cfo:       "CFO",
  coo:       "COO",
  comms:     "Communications",
  dev:       "Development",
  family:    "Family Relations",
  architect: "CTO",
};

// Role-specific opening briefs
const OPENING_PROMPTS = {
  ed: "Brief me. Read the ED context file AND the SHOS state document. Check for any cross-role flags targeting ED. Query open tasks assigned to ED. Tell me the top 5 things needing my attention right now, sorted by urgency. Include any compliance deadlines. Then ask what I want to work on.",
  cos: "Brief me. Read my context file, check for cross-role flags, and tell me what's open and what needs my attention today. Then ask what I want to work on.",
  cfo: "Brief me. Read my context file. Pull the latest financial snapshot — outstanding obligations, recent donations, upcoming disbursements. Tell me what needs attention. Then ask what I want to work on.",
  coo: "Brief me. Read my context file. Check the order queue and production pipeline status. Tell me what's open and what needs my attention today. Then ask what I want to work on.",
  comms: "Brief me. Read my context file, tell me what's open and what needs my attention today, then ask what I want to work on.",
  dev: "Brief me. Read my context file, tell me what's open and what needs my attention today, then ask what I want to work on.",
  family: "Brief me. Read my context file. Check this month's anniversary tracker status. Tell me what's open and what needs my attention today. Then ask what I want to work on.",
  architect: "Brief me. Read my context file. Check Vercel deployment status for shos-app and steel-hearts-site. Check open tasks assigned to architect. Present the build queue sorted by priority. Only surface CTO-domain items — no orders, inbox, or meeting prep. Then ask what I want to work on.",
};
const DEFAULT_OPENING = "Brief me. Read my context file, tell me what's open and what needs my attention today, then ask what I want to work on.";

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
      sendMessage(OPENING_PROMPTS[role] || DEFAULT_OPENING, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to update the in-flight streaming message by its id
  function updateStreamMsg(id, patch) {
    setDisplayMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  }

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

    // Unique id for the streaming message placeholder
    const streamId = Date.now();

    try {
      const res = await fetch("/api/chat/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, messages: newMessages }),
      });

      if (!res.ok) {
        // Non-streaming error responses (auth, missing key, etc.)
        let errMsg = `Server error (${res.status})`;
        try {
          const data = await res.json();
          errMsg = data.message || data.error || errMsg;
        } catch {}
        setError(errMsg);
        setLoading(false);
        return;
      }

      // --- Stream consumption ---
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let completedTools = [];
      let activeTools = [];

      // Insert a placeholder assistant message (replaces the system "Opening..." msg)
      setDisplayMessages((prev) => {
        const filtered = isAuto ? prev.filter((m) => m.type !== "system") : prev;
        return [
          ...filtered,
          {
            id: streamId,
            type: "assistant",
            text: "",
            toolsUsed: [],
            toolsActive: [],
            isStreaming: true,
          },
        ];
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          let event;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          switch (event.type) {
            case "tool_start":
              activeTools = [...activeTools, event.name];
              updateStreamMsg(streamId, { toolsActive: [...activeTools] });
              break;

            case "tool_executing":
              // already showing via tool_start — no-op
              break;

            case "tool_done":
              activeTools = activeTools.filter((t) => t !== event.name);
              if (!completedTools.includes(event.name)) {
                completedTools = [...completedTools, event.name];
              }
              updateStreamMsg(streamId, {
                toolsUsed: [...completedTools],
                toolsActive: [...activeTools],
              });
              break;

            case "text":
              fullText += event.delta;
              updateStreamMsg(streamId, { text: fullText });
              break;

            case "done":
              updateStreamMsg(streamId, {
                isStreaming: false,
                toolsUsed: event.toolsUsed || completedTools,
                toolsActive: [],
              });
              break;

            case "error":
              setError(event.message);
              updateStreamMsg(streamId, { isStreaming: false, toolsActive: [] });
              break;
          }
        }
      }

      // Persist full response into API history for follow-up messages
      if (fullText) {
        setMessages((prev) => [...prev, { role: "assistant", content: fullText }]);
      }
    } catch (e) {
      setError(`Connection failed: ${e.message}`);
      // Clean up the streaming placeholder if it exists
      updateStreamMsg(streamId, { isStreaming: false, toolsActive: [] });
    }

    setLoading(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const ROLE_QUICK_ACTIONS = {
    ed: [
      { label: "Closeout session", text: "We're done. Update the ED context file with what we did, decisions made, and what's next. Then log the closeout record and create any follow-up tasks." },
      { label: "Check flags", text: "What cross-role flags are open and targeting the ED? What needs my attention from other roles?" },
      { label: "Board status", text: "What's the current board governance status? Are there unsent emails, upcoming meetings, or policy adoption deadlines?" },
      { label: "Compliance check", text: "What compliance deadlines are coming up in the next 30 days? State registrations, 990, insurance, trademark?" },
      { label: "Delegate task", text: "I need to create a task and assign it to a role:" },
      { label: "What's open?", text: "Query all open tasks across all roles. What's the current workload distribution?" },
    ],
    cos: [
      { label: "Closeout session", text: "We're done. Update the context file with what we did, decisions made, and what's next. Log the closeout." },
      { label: "Log friction", text: "Something I want to flag for the build queue:" },
      { label: "Email triage", text: "Check recent emails and tell me what needs attention." },
      { label: "What's open?", text: "What are the open todos and what should I prioritize?" },
    ],
    cfo: [
      { label: "Closeout session", text: "We're done. Update the context file with what we did, decisions made, and what's next. Log the closeout." },
      { label: "Org balances", text: "Pull the current organization balances — who do we owe money to and how much?" },
      { label: "Recent donations", text: "Show me donations received in the last 30 days." },
      { label: "What's open?", text: "What are the open todos and what should I prioritize?" },
    ],
    coo: [
      { label: "Closeout session", text: "We're done. Update the context file with what we did, decisions made, and what's next. Log the closeout." },
      { label: "Order queue", text: "What's the current order pipeline? How many need design, production, or shipping?" },
      { label: "Low stock", text: "Which bracelets are running low on inventory?" },
      { label: "What's open?", text: "What are the open todos and what should I prioritize?" },
    ],
  };
  const DEFAULT_QUICK_ACTIONS = [
    { label: "Closeout session", text: "We're done. Update the context file with what we did, decisions made, and what's next. Log the closeout." },
    { label: "Log friction", text: "Something I want to flag for the build queue:" },
    { label: "What's open?", text: "What are the open todos and what should I prioritize?" },
    { label: "Query data", text: "Pull the latest data from Supabase for" },
  ];
  const quickActions = ROLE_QUICK_ACTIONS[role] || DEFAULT_QUICK_ACTIONS;

  return (
    <div className="role-chat-overlay">
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
            <div key={msg.id || i} className={`role-chat-msg role-chat-msg-${msg.type}`}>
              {msg.type === "assistant" && (
                <>
                  <div className="role-chat-msg-label" style={{ color }}>
                    {roleName}
                  </div>

                  {/* Tool pills — active (pulsing) + completed */}
                  {(msg.toolsActive?.length > 0 || msg.toolsUsed?.length > 0) && (
                    <div className="role-chat-tool-pills">
                      {msg.toolsActive?.map((t) => (
                        <span key={`active-${t}`} className="role-chat-tool-pill active" style={{ borderColor: color }}>
                          <span className="role-chat-tool-spinner" style={{ borderTopColor: color }} />
                          {t.replace(/_/g, " ")}
                        </span>
                      ))}
                      {msg.toolsUsed?.map((t) => (
                        <span key={`done-${t}`} className="role-chat-tool-pill done">
                          ✓ {t.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Assistant message text — with optional streaming cursor */}
              {msg.type === "assistant" && msg.text && (
                <div className="role-chat-msg-text">
                  {msg.text.split("\n").map((line, j) => (
                    <span key={j}>{line}{j < msg.text.split("\n").length - 1 && <br />}</span>
                  ))}
                  {msg.isStreaming && <span className="role-chat-cursor" style={{ background: color }} />}
                </div>
              )}

              {/* Waiting for first text — show thinking dots when tools are running and no text yet */}
              {msg.type === "assistant" && msg.isStreaming && !msg.text && msg.toolsActive?.length === 0 && msg.toolsUsed?.length === 0 && (
                <div className="role-chat-thinking">
                  <span /><span /><span />
                </div>
              )}

              {/* Non-assistant messages (user, system) */}
              {msg.type !== "assistant" && (
                <div className="role-chat-msg-text">
                  {msg.text.split("\n").map((line, j) => (
                    <span key={j}>{line}{j < msg.text.split("\n").length - 1 && <br />}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Show thinking dots only when loading AND no streaming message is active */}
          {loading && !displayMessages.some((m) => m.isStreaming) && (
            <div className="role-chat-msg role-chat-msg-assistant">
              <div className="role-chat-msg-label" style={{ color }}>{roleName}</div>
              <div className="role-chat-thinking">
                <span /><span /><span />
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
