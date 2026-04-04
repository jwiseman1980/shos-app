"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import useVoice from "@/hooks/useVoice";

const COLOR = "#c4a237";
const NAME = "Operator";

const QUICK_ACTIONS = [
  { label: "Closeout session", text: "We're done. Update the operator context file with what we did, decisions made, and what's next. Then log the closeout record and create any follow-up tasks." },
  { label: "What's open?", text: "Query all open tasks. What needs my attention right now, sorted by urgency?" },
  { label: "Query data", text: "Pull the latest data for" },
  { label: "Log friction", text: "Something I want to flag for the build queue:" },
  { label: "Create task", text: "I need to create a task:" },
];

export default function RoleChat({ pathname, onClose, currentUser, bottomMode, onSessionChange }) {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [displayMessages, setDisplayMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const sessionIdRef = useRef(null);
  const allToolsRef = useRef([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const lastSpokenRef = useRef(null);
  const fileInputRef = useRef(null);

  // Voice interface
  const onFinalTranscript = useCallback((text) => {
    setInput("");
    sendMessage(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading]);

  const onInterimTranscript = useCallback((text) => {
    setInput(text);
  }, []);

  const voice = useVoice({ onFinalTranscript, onInterimTranscript });

  // Auto-read new assistant messages when voice mode is on
  useEffect(() => {
    if (!voice.voiceMode) return;
    const lastMsg = displayMessages[displayMessages.length - 1];
    if (
      lastMsg?.type === "assistant" &&
      !lastMsg.isStreaming &&
      lastMsg.text &&
      lastMsg.id !== lastSpokenRef.current
    ) {
      lastSpokenRef.current = lastMsg.id;
      voice.speak(lastMsg.text);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMessages, voice.voiceMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  // --- Chat persistence helpers ---
  async function startChatSession() {
    try {
      const res = await fetch("/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: currentUser?.name || "Unknown",
          userEmail: currentUser?.email || "",
          pageContext: pathname,
        }),
      });
      if (res.ok) {
        const { session } = await res.json();
        sessionIdRef.current = session.id;
        sessionStorage.setItem("shos_op_session_id", session.id);
        sessionStorage.setItem("shos_op_session_at", Date.now().toString());
      }
    } catch {}
  }

  async function saveMessage(role, content, toolCalls = null, isAuto = false) {
    if (!sessionIdRef.current || !content) return;
    try {
      await fetch("/api/chat/history/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          role,
          content,
          toolCalls,
          isAuto,
        }),
      });
    } catch {}
  }

  async function endChatSession() {
    if (!sessionIdRef.current) return;
    try {
      // Build a short summary from the last assistant message
      const lastAssistant = [...displayMessages].reverse().find(m => m.type === "assistant");
      const summaryText = lastAssistant?.text
        ? lastAssistant.text.slice(0, 200).replace(/\n/g, " ").trim()
        : "Session closed.";

      await fetch("/api/chat/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          summary: summaryText,
          toolsUsed: [...new Set(allToolsRef.current)],
        }),
      });
    } catch {}
    sessionStorage.removeItem("shos_op_session_id");
    sessionStorage.removeItem("shos_op_session_at");
  }

  // On mount: check for existing session but do NOT auto-start or auto-brief
  useEffect(() => {
    if (!sessionChecked) {
      setSessionChecked(true);
      const storedId = sessionStorage.getItem("shos_op_session_id");
      const storedAt = parseInt(sessionStorage.getItem("shos_op_session_at") || "0");
      const isRecent = storedId && (Date.now() - storedAt) < 4 * 60 * 60 * 1000;
      if (isRecent) {
        // Restore existing session — no API call, no briefing
        sessionIdRef.current = storedId;
        setSessionActive(true);
        onSessionChange?.(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start a new session (called by user clicking Start)
  async function handleStartSession() {
    await startChatSession();
    setSessionActive(true);
    onSessionChange?.(true);
    const openingPrompt = `Brief me. Read the operator context file. Check open tasks. I'm currently viewing ${pathname} — lead with what's relevant to this page, but you can cover anything that needs attention. Then ask what I want to work on.`;
    sendMessage(openingPrompt, true);
  }

  // Close the session (called by user clicking Close)
  async function handleStopSession() {
    await endChatSession();
    setSessionActive(false);
    setMessages([]);
    setDisplayMessages([]);
    setInput("");
    setError(null);
    allToolsRef.current = [];
    onSessionChange?.(false);
  }

  function updateStreamMsg(id, patch) {
    setDisplayMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        setAttachedFiles(prev => [...prev, {
          name: file.name,
          type: file.type,
          size: file.size,
          base64,
        }]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so the same file can be re-attached
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index) {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function sendMessage(text, isAuto = false) {
    if ((!text.trim() && !attachedFiles.length) || loading) return;

    // Build content blocks for the Anthropic API
    const contentBlocks = [];

    // Add file content blocks first
    for (const file of attachedFiles) {
      if (file.type.startsWith("image/")) {
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: file.type,
            data: file.base64,
          },
        });
      } else if (file.type === "application/pdf") {
        contentBlocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: file.base64,
          },
        });
      } else {
        // For other files (CSV, TXT, etc.), send as text
        try {
          const decoded = atob(file.base64);
          contentBlocks.push({
            type: "text",
            text: `[File: ${file.name}]\n${decoded}`,
          });
        } catch {
          contentBlocks.push({
            type: "text",
            text: `[File: ${file.name} — could not decode, ${(file.size / 1024).toFixed(1)}KB ${file.type}]`,
          });
        }
      }
    }

    // Add text content
    if (text.trim()) {
      contentBlocks.push({ type: "text", text: text.trim() });
    }

    // Use array content if files attached, string if text-only
    const userContent = attachedFiles.length > 0 ? contentBlocks : text.trim();
    const userMsg = { role: "user", content: userContent };
    const newMessages = [...messages, userMsg];

    // Display text for the UI
    const displayText = [
      ...attachedFiles.map(f => `[${f.name}]`),
      text.trim(),
    ].filter(Boolean).join(" ");

    setAttachedFiles([]);

    // Persist user message
    saveMessage("user", displayText || text.trim(), null, isAuto);

    setMessages(newMessages);
    if (!isAuto) {
      setDisplayMessages((prev) => [...prev, { type: "user", text: displayText || text.trim() }]);
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
                allToolsRef.current = [...allToolsRef.current, event.name];
              }
              updateStreamMsg(streamId, {
                toolsUsed: [...completedTools],
                toolsActive: [...activeTools],
              });
              break;
            case "navigate":
              if (event.path && event.path !== pathname) {
                router.push(event.path);
              }
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
              window.dispatchEvent(new CustomEvent("operator:done", {
                detail: { toolsUsed: event.toolsUsed || completedTools },
              }));
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
        // Persist assistant response
        saveMessage("assistant", fullText, completedTools.length ? completedTools : null);
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

  // Idle state — show Start Session button
  if (!sessionActive && bottomMode) {
    return (
      <div className="role-chat-bottom">
        <div className="role-chat-panel-bottom" style={{ "--chat-color": COLOR }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "12px 20px", gap: 12,
          }}>
            <div className="role-chat-dot" style={{ background: COLOR, opacity: 0.4 }} />
            <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{NAME}</span>
            <button
              onClick={handleStartSession}
              style={{
                background: COLOR, color: "#000", border: "none",
                padding: "6px 16px", borderRadius: 6, fontSize: 12,
                fontWeight: 700, cursor: "pointer", letterSpacing: "0.03em",
              }}
            >
              Start Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={bottomMode ? "role-chat-bottom" : "role-chat-overlay"}>
      <div className={bottomMode ? "role-chat-panel-bottom" : "role-chat-panel"} style={{ "--chat-color": COLOR }}>

        {/* Header */}
        <div className="role-chat-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="role-chat-dot" style={{ background: COLOR }} />
            <div>
              <div className="role-chat-title">{NAME}</div>
              {!bottomMode && <div className="role-chat-subtitle">Steel Hearts Operating System</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {voice.supported && (
              <button
                className={`voice-mode-toggle ${voice.voiceMode ? "active" : ""}`}
                onClick={voice.toggleVoiceMode}
                title={voice.voiceMode ? "Voice mode on — auto-reads responses" : "Voice mode off"}
              >
                {voice.voiceMode ? "🔊" : "🔇"}
              </button>
            )}
            {bottomMode && (
              <button
                onClick={handleStopSession}
                style={{
                  background: "none", border: "1px solid var(--card-border)",
                  color: "var(--text-dim)", cursor: "pointer",
                  padding: "3px 10px", borderRadius: 4, fontSize: 11,
                }}
                title="Close session and archive"
              >
                Close Session
              </button>
            )}
            {!bottomMode && onClose && (
              <button className="role-chat-close" onClick={() => { endChatSession(); onClose(); }}>✕</button>
            )}
          </div>
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
                  {!msg.isStreaming && voice.supported && (
                    <button
                      className="voice-speak-btn"
                      onClick={() => voice.speaking ? voice.stopSpeaking() : voice.speak(msg.text)}
                      title={voice.speaking ? "Stop reading" : "Read aloud"}
                    >
                      {voice.speaking ? "⏹" : "▶"}
                    </button>
                  )}
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
        {voice.listening && (
          <div className="voice-listening-bar">
            <span className="voice-pulse" />
            <span className="voice-listening-text">Listening{voice.transcript ? "..." : " — speak now"}</span>
            <button className="voice-stop-btn" onClick={voice.stopListening}>Done</button>
          </div>
        )}
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div style={{ padding: "6px 20px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {attachedFiles.map((f, i) => (
              <span key={i} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 11, padding: "3px 8px", borderRadius: 4,
                background: "var(--bg-3)", color: "var(--text-bright)",
                border: "1px solid var(--border)",
              }}>
                {f.type.startsWith("image/") ? "\uD83D\uDDBC" : "\uD83D\uDCC4"} {f.name}
                <button onClick={() => removeFile(i)} style={{
                  background: "none", border: "none", color: "var(--text-dim)",
                  cursor: "pointer", fontSize: 12, padding: "0 2px",
                }}>&times;</button>
              </span>
            ))}
          </div>
        )}
        <div className="role-chat-input-row">
          {/* File attach button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.csv,.txt,.json,.xlsx,.svg"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
          <button
            className="voice-mic-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="Attach file"
            style={{ fontSize: 16 }}
          >
            +
          </button>
          {voice.supported && (
            <button
              className={`voice-mic-btn ${voice.listening ? "active" : ""}`}
              onClick={() => voice.listening ? voice.stopListening() : voice.startListening()}
              disabled={loading}
              title={voice.listening ? "Stop listening" : "Voice input"}
            >
              🎙
            </button>
          )}
          <textarea
            ref={inputRef}
            className="role-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={voice.listening ? "Listening..." : "Message Operator..."}
            rows={2}
            disabled={loading}
          />
          <button
            className="role-chat-send"
            style={{ background: COLOR }}
            onClick={() => sendMessage(input)}
            disabled={loading || (!input.trim() && !attachedFiles.length)}
          >
            ↑
          </button>
        </div>
        <div className="role-chat-footer">
          {voice.supported
            ? "Enter to send · 🎙 for voice · Session auto-closes out when you're done"
            : "Enter to send · Shift+Enter for newline · Session auto-closes out when you're done"
          }
        </div>

      </div>
    </div>
  );
}
