"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import TaskSidebar from "@/components/TaskSidebar";
import MainPanel from "@/components/MainPanel";
import OperatorStrip from "@/components/OperatorStrip";
import DayPanel from "@/components/DayPanel";

/**
 * ConsoleShell — the persistent app-wide operating surface.
 *
 * Wraps every authenticated page. Mounts once and never remounts
 * during navigation, keeping the Operator and task sidebar alive.
 *
 * Dashboard (/): shows MainPanel (email triage / task detail)
 * All other pages: shows nav Sidebar + {children}
 */
export default function ConsoleShell({ user, tasks, calendarEvents, emails, greeting, children }) {
  const pathname = usePathname();
  const isDashboard = pathname === "/" || pathname === "";

  // Trimmed user for Operator and MainPanel
  const currentUser = user ? { name: user.name, email: user.email } : null;

  const [activeView, setActiveView] = useState("welcome");
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskList, setTaskList] = useState(tasks || []);
  const [emailList, setEmailList] = useState(emails || []);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [operatorHeight, setOperatorHeight] = useState(280);

  // Drag state for resizable operator
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleResizerMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = operatorHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [operatorHeight]);

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
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

  // Live email refresh — triggered by Operator completing email-related tool calls
  const refreshEmails = useCallback(async () => {
    try {
      const res = await fetch("/api/email?query=in:inbox&maxResults=30");
      if (res.ok) {
        const data = await res.json();
        setEmailList(data.messages || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const emailTools = ["archive_email", "query_email", "read_email", "mark_email_read"];
    const handler = (e) => {
      const tools = e.detail?.toolsUsed || [];
      if (tools.some((t) => emailTools.includes(t))) {
        refreshEmails();
      }
    };
    window.addEventListener("operator:done", handler);
    return () => window.removeEventListener("operator:done", handler);
  }, [refreshEmails]);

  // Task handlers — send task to Operator instead of switching dashboard views
  const handleTaskClick = useCallback((task) => {
    setActiveTaskId(task.id);
    window.dispatchEvent(new CustomEvent("shos:task", { detail: task }));
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
      {/* Task Sidebar — persistent left panel */}
      <TaskSidebar
        tasks={taskList}
        activeTaskId={activeTaskId}
        onTaskClick={handleTaskClick}
        onViewChange={handleViewChange}
        activeView={isDashboard ? activeView : null}
        emailCount={emailList.filter((e) => e.isUnread).length}
        greeting={greeting}
        collapsed={!sidebarOpen}
        onToggleCollapse={() => setSidebarOpen((v) => !v)}
        isFounder={user?.isFounder || false}
      />

      {/* Main area — content + resizer + operator */}
      <div className="console-main">
        <div className="console-content">
          {isDashboard ? (
            // Dashboard: email triage / task detail / welcome
            <MainPanel
              view={activeView}
              activeTask={activeTask}
              emails={emailList}
              calendarEvents={calendarEvents}
              tasks={taskList}
              currentUser={currentUser}
              greeting={greeting}
              onTaskComplete={handleTaskComplete}
              onTaskStart={handleTaskStart}
              onTaskClick={handleTaskClick}
              onEmailTriaged={handleEmailTriaged}
              onEmailToTask={handleEmailToTask}
              onViewChange={handleViewChange}
            />
          ) : (
            // All other pages: just page content (nav is in TaskSidebar)
            <main className="app-content-inner">{children}</main>
          )}
        </div>

        {/* Drag handle */}
        <div className="console-resizer" onMouseDown={handleResizerMouseDown} />

        {/* Operator — persistent bottom strip */}
        <div className="console-operator" style={{ height: operatorHeight }}>
          <OperatorStrip currentUser={currentUser} />
        </div>
      </div>

      {/* Day Panel — persistent right-side calendar */}
      <DayPanel
        events={calendarEvents || []}
        tasks={taskList}
        collapsed={!rightPanelOpen}
        onToggle={() => setRightPanelOpen((v) => !v)}
      />
    </div>
  );
}
