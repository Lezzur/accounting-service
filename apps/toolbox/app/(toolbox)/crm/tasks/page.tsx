"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@numera/db";
import type { Database, TaskPriority, TaskStatus } from "@numera/db";
import {
  Button,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastAction,
  ToastClose,
  cn,
} from "@numera/ui";
import { Plus, Check, Pencil, Trash2, CircleCheck } from "lucide-react";
import { NewTaskDrawer } from "./components/new-task-drawer";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

interface ToastData {
  id: string;
  message: string;
  variant: "success" | "error";
  action?: { label: string; onClick: () => void };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function isOverdue(task: TaskRow): boolean {
  return task.status !== "done" && task.due_date < getToday();
}

function isDueToday(task: TaskRow): boolean {
  return task.due_date === getToday();
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day)
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 rounded-full flex-shrink-0", {
        "bg-slate-400": priority === "low",
        "bg-amber-500": priority === "medium",
        "bg-red-500": priority === "high",
      })}
      aria-label={`Priority: ${priority}`}
    />
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; className: string }> = {
    todo: {
      label: "To Do",
      className: "bg-slate-100 text-slate-700",
    },
    in_progress: {
      label: "In Progress",
      className: "bg-amber-100 text-amber-700",
    },
    done: {
      label: "Done",
      className: "bg-teal-100 text-teal-700",
    },
  };
  const { label, className } = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {label}
    </span>
  );
}

function EntityTypeBadge({ type }: { type: "lead" | "client" }) {
  return (
    <Badge
      status={type === "client" ? "approved" : "in-review"}
      className="capitalize"
    >
      {type}
    </Badge>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-200">
      {[40, 200, 140, 100, 80, 80].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-3 rounded bg-slate-200 animate-pulse"
            style={{ width: w }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Mobile task card ─────────────────────────────────────────────────────────

interface TaskCardProps {
  task: TaskRow;
  confirmDeleteId: string | null;
  onComplete: (task: TaskRow) => void;
  onEdit: (task: TaskRow) => void;
  onDeleteRequest: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}

function TaskCard({
  task,
  confirmDeleteId,
  onComplete,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: TaskCardProps) {
  const overdue = isOverdue(task);
  const today = isDueToday(task);
  const done = task.status === "done";

  return (
    <div
      className={cn("rounded-lg border border-slate-200 p-4 space-y-2", {
        "bg-red-50": overdue,
        "bg-amber-100": today && !overdue,
        "bg-white": !overdue && !today,
      })}
    >
      <div className="flex items-start gap-2">
        <PriorityDot priority={task.priority} />
        <p
          className={cn("flex-1 text-sm font-medium text-slate-900", {
            "line-through text-slate-400": done,
          })}
        >
          {task.title}
        </p>
        <StatusBadge status={task.status} />
      </div>
      <p
        className={cn("text-xs", {
          "text-red-500": overdue,
          "text-amber-700": today && !overdue,
          "text-slate-500": !overdue && !today,
        })}
      >
        Due {formatDate(task.due_date)}
      </p>

      {confirmDeleteId === task.id ? (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-700">Delete this task?</span>
          <button
            onClick={() => onDeleteConfirm(task.id)}
            className="text-xs text-red-500 font-medium hover:underline"
          >
            Yes
          </button>
          <button
            onClick={onDeleteCancel}
            className="text-xs text-slate-500 font-medium hover:underline"
          >
            No
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 pt-1">
          {!done && (
            <button
              onClick={() => onComplete(task)}
              className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
            >
              <Check className="h-3.5 w-3.5" />
              Complete
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 font-medium"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => onDeleteRequest(task.id)}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  // Data state
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);

  // Inline delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const undoneTasksRef = useRef<Set<string>>(new Set());
  const undoTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  // Filters
  const [filterStatus, setFilterStatus] = useState<"all" | TaskStatus>("all");
  const [filterDueDateFrom, setFilterDueDateFrom] = useState("");
  const [filterDueDateTo, setFilterDueDateTo] = useState("");
  const [filterEntityType, setFilterEntityType] = useState<
    "all" | "lead" | "client"
  >("all");
  const [filterPriority, setFilterPriority] = useState<"all" | TaskPriority>(
    "all"
  );
  const [showCompleted, setShowCompleted] = useState(false);

  // ── Toast helpers ──────────────────────────────────────────────────────────

  const addToast = useCallback((toast: ToastData) => {
    setToasts((prev) => [...prev.filter((t) => t.id !== toast.id), toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadTasks = useCallback(async () => {
    if (!supabase) {
      setLoadError("Failed to load tasks.");
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      setTasks(data ?? []);
    } catch {
      setLoadError("Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ── Filtered tasks ─────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!showCompleted && task.status === "done") return false;
      if (filterStatus !== "all" && task.status !== filterStatus) return false;
      if (filterDueDateFrom && task.due_date < filterDueDateFrom) return false;
      if (filterDueDateTo && task.due_date > filterDueDateTo) return false;
      if (
        filterEntityType !== "all" &&
        task.linked_entity_type !== filterEntityType
      )
        return false;
      if (filterPriority !== "all" && task.priority !== filterPriority)
        return false;
      return true;
    });
  }, [
    tasks,
    filterStatus,
    filterDueDateFrom,
    filterDueDateTo,
    filterEntityType,
    filterPriority,
    showCompleted,
  ]);

  // ── Complete (optimistic + undo) ───────────────────────────────────────────

  const handleComplete = useCallback(
    async (task: TaskRow) => {
      if (task.status === "done") return;
      const prevStatus = task.status;
      const toastId = `complete-${task.id}`;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: "done" } : t))
      );

      addToast({
        id: toastId,
        message: "Task completed.",
        variant: "success",
        action: {
          label: "Undo",
          onClick: () => {
            undoneTasksRef.current.add(task.id);
            clearTimeout(undoTimersRef.current[toastId]);
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id ? { ...t, status: prevStatus } : t
              )
            );
            removeToast(toastId);
            supabase
              ?.from("tasks")
              .update({ status: prevStatus })
              .eq("id", task.id);
          },
        },
      });

      undoTimersRef.current[toastId] = setTimeout(async () => {
        removeToast(toastId);
        if (undoneTasksRef.current.has(task.id)) {
          undoneTasksRef.current.delete(task.id);
          return;
        }
        if (!supabase) return;
        try {
          const { error } = await supabase
            .from("tasks")
            .update({ status: "done" })
            .eq("id", task.id);
          if (error) throw error;
        } catch {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, status: prevStatus } : t
            )
          );
          addToast({
            id: `err-${task.id}`,
            message: "Failed to complete task.",
            variant: "error",
          });
        }
      }, 5000);
    },
    [supabase, addToast, removeToast]
  );

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDeleteConfirm = useCallback(
    async (taskId: string) => {
      setConfirmDeleteId(null);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (!supabase) return;
      try {
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId);
        if (error) throw error;
        addToast({
          id: `del-${taskId}`,
          message: "Task deleted.",
          variant: "success",
        });
      } catch {
        loadTasks();
        addToast({
          id: `del-err-${taskId}`,
          message: "Failed to delete task.",
          variant: "error",
        });
      }
    },
    [supabase, addToast, loadTasks]
  );

  // ── Saved from drawer ──────────────────────────────────────────────────────

  const handleSaved = useCallback(
    (saved: TaskRow) => {
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === saved.id);
        const updated = exists
          ? prev.map((t) => (t.id === saved.id ? saved : t))
          : [...prev, saved];
        return updated.sort((a, b) => a.due_date.localeCompare(b.due_date));
      });
      addToast({
        id: `saved-${saved.id}`,
        message: editTask ? "Task updated." : "Task created.",
        variant: "success",
      });
      setEditTask(null);
    },
    [addToast, editTask]
  );

  const openNewTask = () => {
    setEditTask(null);
    setDrawerOpen(true);
  };

  const openEdit = (task: TaskRow) => {
    setEditTask(task);
    setDrawerOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ToastProvider swipeDirection="right">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
          <Button onClick={openNewTask} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Status */}
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>

          {/* Due date from */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 whitespace-nowrap">
              From
            </label>
            <input
              type="date"
              value={filterDueDateFrom}
              onChange={(e) => setFilterDueDateFrom(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-2 focus:border-teal-600 transition-[border-color,border-width] duration-[100ms]"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 whitespace-nowrap">
              To
            </label>
            <input
              type="date"
              value={filterDueDateTo}
              onChange={(e) => setFilterDueDateTo(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-2 focus:border-teal-600 transition-[border-color,border-width] duration-[100ms]"
            />
          </div>

          {/* Linked entity type */}
          <Select
            value={filterEntityType}
            onValueChange={(v) =>
              setFilterEntityType(v as typeof filterEntityType)
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="client">Clients</SelectItem>
            </SelectContent>
          </Select>

          {/* Priority */}
          <Select
            value={filterPriority}
            onValueChange={(v) =>
              setFilterPriority(v as typeof filterPriority)
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>

          {/* Show completed toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none ml-auto">
            <span className="text-sm text-slate-600">Show Completed</span>
            <button
              role="switch"
              aria-checked={showCompleted}
              onClick={() => setShowCompleted((p) => !p)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150",
                showCompleted ? "bg-teal-600" : "bg-slate-200"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150",
                  showCompleted ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </label>
        </div>

        {/* ── Desktop table ─────────────────────────────────────────────── */}
        <div className="hidden sm:block">
          {loading ? (
            <table className="w-full border-collapse">
              <thead>
                <TableHead />
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={loadTasks} />
          ) : filteredTasks.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <TableHead />
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <TaskTableRow
                      key={task.id}
                      task={task}
                      confirmDeleteId={confirmDeleteId}
                      onComplete={handleComplete}
                      onEdit={openEdit}
                      onDeleteRequest={setConfirmDeleteId}
                      onDeleteConfirm={handleDeleteConfirm}
                      onDeleteCancel={() => setConfirmDeleteId(null)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Mobile card list ───────────────────────────────────────────── */}
        <div className="sm:hidden space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 p-4 space-y-2"
              >
                <div className="h-3 rounded bg-slate-200 animate-pulse w-48" />
                <div className="h-3 rounded bg-slate-200 animate-pulse w-24" />
              </div>
            ))
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={loadTasks} />
          ) : filteredTasks.length === 0 ? (
            <EmptyState />
          ) : (
            filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                confirmDeleteId={confirmDeleteId}
                onComplete={handleComplete}
                onEdit={openEdit}
                onDeleteRequest={setConfirmDeleteId}
                onDeleteConfirm={handleDeleteConfirm}
                onDeleteCancel={() => setConfirmDeleteId(null)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── New / Edit drawer ────────────────────────────────────────────────── */}
      <NewTaskDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditTask(null);
        }}
        onSaved={handleSaved}
        editTask={editTask}
      />

      {/* ── Toasts ──────────────────────────────────────────────────────────── */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          onOpenChange={(open) => {
            if (!open) removeToast(toast.id);
          }}
        >
          <ToastTitle>{toast.message}</ToastTitle>
          {toast.action && (
            <ToastAction
              altText={toast.action.label}
              onClick={toast.action.onClick}
            >
              {toast.action.label}
            </ToastAction>
          )}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

// ─── Table header ─────────────────────────────────────────────────────────────

function TableHead() {
  return (
    <tr className="border-b border-slate-200">
      {["", "Title", "Linked Entity", "Due Date", "Status", "Actions"].map(
        (col) => (
          <th
            key={col}
            className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
          >
            {col}
          </th>
        )
      )}
    </tr>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

interface TaskTableRowProps {
  task: TaskRow;
  confirmDeleteId: string | null;
  onComplete: (task: TaskRow) => void;
  onEdit: (task: TaskRow) => void;
  onDeleteRequest: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}

function TaskTableRow({
  task,
  confirmDeleteId,
  onComplete,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: TaskTableRowProps) {
  const overdue = isOverdue(task);
  const today = isDueToday(task);
  const done = task.status === "done";
  const isConfirming = confirmDeleteId === task.id;

  return (
    <tr
      className={cn(
        "border-b border-slate-200 group transition-colors",
        overdue && "bg-red-50",
        today && !overdue && "bg-amber-100",
        !overdue && !today && "bg-white hover:bg-slate-50"
      )}
      style={{ height: 48 }}
    >
      {/* Priority dot */}
      <td className="px-4 py-3 w-8">
        <PriorityDot priority={task.priority} />
      </td>

      {/* Title */}
      <td className="px-4 py-3 max-w-[240px]">
        <span
          className={cn("text-sm text-slate-900 line-clamp-1", {
            "line-through text-slate-400": done,
          })}
        >
          {task.title}
        </span>
      </td>

      {/* Linked Entity */}
      <td className="px-4 py-3">
        {task.linked_entity_type ? (
          <EntityTypeBadge type={task.linked_entity_type} />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>

      {/* Due Date */}
      <td className="px-4 py-3">
        <span
          className={cn("text-sm", {
            "text-red-500 font-medium": overdue,
            "text-amber-700 font-medium": today && !overdue,
            "text-slate-600": !overdue && !today,
          })}
        >
          {formatDate(task.due_date)}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={task.status} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {isConfirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-700 whitespace-nowrap">
              Delete this task?
            </span>
            <button
              onClick={() => onDeleteConfirm(task.id)}
              className="text-xs text-red-500 font-medium hover:underline"
            >
              Yes
            </button>
            <button
              onClick={onDeleteCancel}
              className="text-xs text-slate-500 font-medium hover:underline"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {!done && (
              <button
                onClick={() => onComplete(task)}
                title="Mark complete"
                className="p-1.5 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onEdit(task)}
              title="Edit"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDeleteRequest(task.id)}
              title="Delete"
              className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CircleCheck className="h-12 w-12 text-teal-300 mb-4" strokeWidth={1.5} />
      <p className="text-sm text-slate-500">
        No tasks. You&rsquo;re all caught up.
      </p>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <p className="text-sm text-slate-500">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
