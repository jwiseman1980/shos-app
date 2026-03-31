"use client";

import { useState, useCallback } from "react";
import TaskSidebar from "@/components/TaskSidebar";
import MainPanel from "@/components/MainPanel";
import OperatorStrip from "@/components/OperatorStrip";

/**
 * Console Layout — the single-surface operating view.
 *
 * Left: Task sidebar (unified calendar + queue, priority-ordered)
 * Right top: Main content panel (email triage, task detail, etc.)
 * Right bottom: Operator chat strip (always visible)
 */
export default function ConsoleLayout({ tasks, emails, currentUser, greeting }) {
  const [activeView, setActiveView] = useState(
    emails?.length > 0 ? "email-triage" : "welcome"
  );
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskList, setTaskList] = useState(tasks || []);

  const handleTaskClick = useCallback((task) => {
    setActiveTaskId(task.id);
    setActiveView("task-detail");
  }, []);

  const handleTaskComplete = useCallback((taskId) => {
    setTaskList((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "done", completedAt: new Date().toISOString() } : t))
    );
  }, []);

  const handleTaskStart = useCallback((taskId) => {
    setTaskList((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "active", startedAt: new Date().toISOString() } : t))
    );
  }, []);

  const handleEmailTriaged = useCallback((messageId) => {
    // Email was handled — could trigger a re-check of remaining emails
  }, []);

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
      {/* Task Sidebar */}
      <TaskSidebar
        tasks={taskList}
        activeTaskId={activeTaskId}
        onTaskClick={handleTaskClick}
        onViewChange={handleViewChange}
        activeView={activeView}
        emailCount={emails?.length || 0}
        greeting={greeting}
      />

      {/* Main Area (content + operator) */}
      <div className="console-main">
        <div className="console-content">
          <MainPanel
            view={activeView}
            activeTask={activeTask}
            emails={emails}
            currentUser={currentUser}
            onTaskComplete={handleTaskComplete}
            onTaskStart={handleTaskStart}
            onEmailTriaged={handleEmailTriaged}
            onEmailToTask={handleEmailToTask}
            onViewChange={handleViewChange}
          />
        </div>
        <div className="console-operator">
          <OperatorStrip currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
}
