"use client";

import { useState, useRef, useEffect } from "react";

const COLOR = "#c4a237";
const NAME = "Operator";

const QUICK_ACTIONS = [
  { label: "Closeout session", text: "We're done. Update the operator context file with what we did, decisions made, and what's next. Then log the closeout record and create any follow-up tasks." },
  { label: "What's open?", text: "Query all open tasks. What needs my attention right now, sorted by urgency?" },
  { label: "Query data", text: "Pull the latest data for" },
  { label: "Log friction", text: "Something I want to flag for the build queue:" },
  { label: "Create task", text: "I need to create a task:" },
];

export default function RoleChat({ pathname, onClose }) {
  const [messages, setMessages] = useState([]);
  const [displayMessages, setDisplayMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  // Auto-start session
  useEffect(() => {
    if (!sessionStarted) {
      setSessionStarted(true);
      const openingPrompt = `Brief me. Read the operator context file. Check open tasks. I'm currently viewing ${pathname} — lead with what's relevant to this page, but you can cover anything that needs attention. Then ask what I want to work on.`;
      sendMessage(openingPrompt, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        text: "Opening session...",
      }]);
    }
    setInput("");
    setLoading(true);
    setError(null);

    const streamId = Date.now();

    try {
      const res = await fetch("/api/chat/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "operator", pathname, messages: newMessages }),
      });

      if (!res.ok) {
        let errMsg = `Server error (${res.status})`;
        try {
          const data = await res.json();
          errMsg = data.message || data.error || errMsg;
        } catch {}
        setError(errMsg);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let completedTools = [];
      let activeTools = [];

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
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          let event;
          try { event = JSON.parse(line); } catch { continue; }

          switch (event.type) {
            case "tool_start":
              activeTools = [...activeTools, event.name];
              updateStreamMsg(streamId, { toolsActive: [...activeTools] });
              break;
            case "tool_executing":
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

      if (fullText) {
        setMessages((prev) => [...prev, { role: "assistant", content: fullText }]);
      }
    } catch (e) {
      setError(`Connection failed: ${e.message}`);
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

  return (
    <div className="role-chat-overlay">
      <div className="role-chat-panel" style={{ "--chat-color": COLOR }}>

        {/* Header */}
        <div className="role-chat-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="role-chat-dot" style={{ background: COLOR }} />
            <div>
              <div className="role-chat-title">{NAME}</div>
              <div className="role-chat-subtitle">Steel Hearts Operating System</div>
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
                  <div className="role-chat-msg-label" style={{ color: COLOR }}>
                    {NAME}
                  </div>
                  {(msg.toolsActive?.length > 0 || msg.toolsUsed?.length > 0) && (
                    <div className="role-chat-tool-pills">
                      {msg.toolsActive?.map((t) => (
                        <span key={`active-${t}`} className="role-chat-tool-pill active" style={{ borderColor: COLOR }}>
                          <span className="role-chat-tool-spinner" style={{ borderTopColor: COLOR }} />
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

              {msg.type === "assistant" && msg.text && (
                <div className="role-chat-msg-text">
                  {msg.text.split("\n").map((line, j) => (
                    <span key={j}>{line}{j < msg.text.split("\n").length - 1 && <br />}</span>
                  ))}
                  {msg.isStreaming && <span className="role-chat-cursor" style={{ background: COLOR }} />}
                </div>
              )}

              {msg.type === "assistant" && msg.isStreaming && !msg.text && msg.toolsActive?.length === 0 && msg.toolsUsed?.length === 0 && (
                <div className="role-chat-thinking">
                  <span /><span /><span />
                </div>
              )}

              {msg.type !== "assistant" && (
                <div className="role-chat-msg-text">
                  {msg.text.split("\n").map((line, j) => (
                    <span key={j}>{line}{j < msg.text.split("\n").length - 1 && <br />}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && !displayMessages.some((m) => m.isStreaming) && (
            <div className="role-chat-msg role-chat-msg-assistant">
              <div className="role-chat-msg-label" style={{ color: COLOR }}>{NAME}</div>
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
                  enable the operator. Get a key at{" "}
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
            {QUICK_ACTIONS.map((a) => (
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
            placeholder="Message Operator..."
            rows={2}
            disabled={loading}
          />
          <button
            className="role-chat-send"
            style={{ background: COLOR }}
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
