"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import TaskSidebar from "@/components/TaskSidebar";
import MainPanel from "@/components/MainPanel";
import OperatorStrip from "@/components/OperatorStrip";

/**
 * Console Layout — the single-surface operating view.
 *
 * Left: Task sidebar (collapsible, unified calendar + queue)
 * Right top: Main content panel (resizable — drag the divider)
 * Right bottom: Operator chat strip (resizable)
 */
export default function ConsoleLayout({ tasks, emails, currentUser, greeting }) {
  const [activeView, setActiveView] = useState("dashboard");
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskList, setTaskList] = useState(tasks || []);
  const [emailList, setEmailList] = useState(emails || []);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [operatorHeight, setOperatorHeight] = useState(280);

  // Drag state (refs to avoid stale closures in event listeners)
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // --- Resize handle ---
  const handleResizerMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      isDragging.current = true;
      dragStartY.current = e.clientY;
      dragStartHeight.current = operatorHeight;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [operatorHeight]
  );

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      // Dragging up → bigger operator, dragging down → smaller
      const delta = dragStartY.current - e.clientY;
      const next = Math.max(140, Math.min(700, dragStartHeight.current + delta));
      setOperatorHeight(next);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // --- Live email refresh ---
  const refreshEmails = useCallback(async () => {
    try {
      const res = await fetch("/api/email?query=is:unread&maxResults=30");
      if (res.ok) {
        const data = await res.json();
        setEmailList(data.messages || []);
      }
    } catch {}
  }, []);

  // --- Live task refresh ---
  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/queue");
      if (res.ok) {
        const data = await res.json();
        if (data.tasks) setTaskList(data.tasks);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const emailTools = ["archive_email", "query_email", "read_email", "mark_email_read"];
    const taskTools = ["update_task", "create_task"];
    const handler = (e) => {
      const tools = e.detail?.toolsUsed || [];
      if (tools.some((t) => emailTools.includes(t))) refreshEmails();
      if (tools.some((t) => taskTools.includes(t))) refreshTasks();
    };
    window.addEventListener("operator:done", handler);
    return () => window.removeEventListener("operator:done", handler);
  }, [refreshEmails, refreshTasks]);

  // --- Task handlers ---
  const handleTaskClick = useCallback((task) => {
    setActiveTaskId(task.id);
    setActiveView("task-detail");
  }, []);

  const handleTaskComplete = useCallback((taskId) => {
    setTaskList((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: "done", completedAt: new Date().toISOString() } : t
      )
    );
  }, []);

  const handleTaskStart = useCallback((taskId) => {
    setTaskList((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: "active", startedAt: new Date().toISOString() } : t
      )
    );
  }, []);

  const handleEmailTriaged = useCallback(() => {}, []);

  const handleEmailToTask = useCallback((newTask) => {
    setTaskList((prev) => [...prev, newTask]);
  }, []);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
    if (view !== "task-detail") setActiveTaskId(null);
  }, []);

  const activeTask = taskList.find((t) => t.id === activeTaskId);

  return (
    <div className="console-layout">
      {/* Task Sidebar (collapsible) */}
      <TaskSidebar
        tasks={taskList}
        activeTaskId={activeTaskId}
        onTaskClick={handleTaskClick}
        onViewChange={handleViewChange}
        activeView={activeView}
        emailCount={emailList.length}
        greeting={greeting}
        collapsed={!sidebarOpen}
        onToggleCollapse={() => setSidebarOpen((v) => !v)}
      />

      {/* Main Area (content + resizer + operator) */}
      <div className="console-main">
        {/* Content panel — takes all remaining space above operator */}
        <div className="console-content">
          <MainPanel
            view={activeView}
            activeTask={activeTask}
            tasks={taskList}
            emails={emailList}
            emailCount={emailList.length}
            currentUser={currentUser}
            onTaskComplete={handleTaskComplete}
            onTaskStart={handleTaskStart}
            onTaskClick={handleTaskClick}
            onEmailTriaged={handleEmailTriaged}
            onEmailToTask={handleEmailToTask}
            onViewChange={handleViewChange}
            greeting={greeting}
          />
        </div>

        {/* Drag handle */}
        <div className="console-resizer" onMouseDown={handleResizerMouseDown} />

        {/* Operator — fixed height, set by drag */}
        <div className="console-operator" style={{ height: operatorHeight }}>
          <OperatorStrip currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
}
