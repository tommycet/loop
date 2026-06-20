"use client";

import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  due_at?: string | null;
};

const columns: Task["status"][] = ["open", "in_progress", "done"];

export function TaskBoard({ refreshKey }: { refreshKey: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/tasks", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]));
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const grouped = useMemo(() => {
    return columns.map((status) => ({
      status,
      tasks: tasks.filter((task) => task.status === status),
    }));
  }, [tasks]);

  const cycleStatus = async (task: Task) => {
    const nextStatus = task.status === "open" ? "in_progress" : task.status === "in_progress" ? "done" : "open";
    setPendingId(task.id);
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status: nextStatus }),
    });
    setPendingId(null);
    load();
  };

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#0f0c16] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-fuchsia-300/70">execution surface</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Task board</h2>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {grouped.map((group) => (
          <div key={group.status} className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-center justify-between text-sm text-white/75">
              <span className="uppercase tracking-[0.2em] text-white/45">{group.status.replace("_", " ")}</span>
              <span>{group.tasks.length}</span>
            </div>
            <div className="space-y-3">
              {group.tasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/35">
                  No tasks in this column.
                </div>
              ) : (
                group.tasks.map((task) => (
                  <div key={task.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-white">{task.title}</h3>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/45">
                        {task.priority}
                      </span>
                    </div>
                    <div className="mb-4 text-xs text-white/35">
                      {task.due_at ? `Due ${new Date(task.due_at).toLocaleString()}` : "No due date"}
                    </div>
                    <button
                      className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-fuchsia-100 transition hover:bg-fuchsia-300/20 disabled:opacity-50"
                      onClick={() => cycleStatus(task)}
                      disabled={pendingId === task.id}
                    >
                      {pendingId === task.id ? "Updating..." : task.status === "open" ? "Start task" : task.status === "in_progress" ? "Mark done" : "Re-open"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
