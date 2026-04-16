"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createClient } from "../../../../lib/supabase/client";
import type { Database, DeadlineType, DeadlineStatus } from "@numera/db";
import {
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Toast,
  ToastTitle,
  ToastAction,
  ToastClose,
  ToastProvider,
  ToastViewport,
  cn,
} from "@numera/ui";
import {
  Check,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeadlineRow = Database["public"]["Tables"]["deadlines"]["Row"];

interface DeadlineWithClient extends DeadlineRow {
  clientName: string;
  clientStatus: "active" | "inactive";
}

interface ToastData {
  id: string;
  message: string;
  variant: "success" | "error";
  action?: { label: string; onClick: () => void };
}

type DisplayStatus =
  | "overdue"
  | "approaching"
  | "in_progress"
  | "upcoming"
  | "completed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getDaysUntil(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return Math.floor(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function isWeekend(dueDate: string): boolean {
  const d = new Date(dueDate + "T00:00:00");
  const day = d.getDay();
  return day === 0 || day === 6;
}

const BIR_DEADLINE_TYPES: DeadlineType[] = [
  "monthly_vat",
  "quarterly_bir",
  "annual_itr",
];

function isBIRDeadline(type: DeadlineType): boolean {
  return BIR_DEADLINE_TYPES.includes(type);
}

function getDisplayStatus(d: DeadlineRow): DisplayStatus {
  if (d.status === "completed") return "completed";
  const days = getDaysUntil(d.due_date);
  if (days < 0) return "overdue";
  if (days <= 7) return "approaching";
  if (d.status === "in_progress") return "in_progress";
  return "upcoming";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  monthly_bookkeeping: "Monthly Bookkeeping",
  monthly_vat: "Monthly VAT (2550M)",
  quarterly_bir: "Quarterly BIR Filing",
  quarterly_financials: "Quarterly Financial Statements",
  annual_itr: "Annual ITR + Financials",
  annual_financials: "Annual Financials",
};

const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  overdue: "Overdue",
  approaching: "Approaching",
  in_progress: "In Progress",
  upcoming: "Upcoming",
  completed: "Completed",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: DisplayStatus }) {
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 rounded-full flex-shrink-0", {
        "bg-red-500": status === "overdue",
        "bg-amber-500": status === "approaching" || status === "in_progress",
        "bg-green-500": status === "completed",
        "bg-slate-500": status === "upcoming",
      })}
      aria-label={`Status: ${DISPLAY_STATUS_LABELS[status]}`}
    />
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
      <div className="h-2.5 w-2.5 rounded-full bg-slate-200 animate-pulse flex-shrink-0" />
      <div
        className="h-3 bg-slate-200 rounded animate-pulse"
        style={{ width: 140 }}
      />
      <div className="h-3 bg-slate-200 rounded animate-pulse flex-1 min-w-0" />
      <div
        className="h-3 bg-slate-200 rounded animate-pulse"
        style={{ width: 80 }}
      />
      <div className="h-7 w-24 bg-slate-200 rounded animate-pulse flex-shrink-0" />
    </div>
  );
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

interface CalendarPopoverEntry {
  date: string;
  deadlines: DeadlineWithClient[];
}

function MiniCalendar({
  deadlines,
  loading,
}: {
  deadlines: DeadlineWithClient[];
  loading: boolean;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<CalendarPopoverEntry | null>(null);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = getToday();

  const deadlineMap = useMemo(() => {
    const map: Record<string, DeadlineWithClient[]> = {};
    for (const d of deadlines) {
      const [y, m] = d.due_date.split("-").map(Number);
      if (y === viewYear && m - 1 === viewMonth) {
        (map[d.due_date] ??= []).push(d);
      }
    }
    return map;
  }, [deadlines, viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelected(null);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelected(null);
  }

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function handleDayClick(day: number) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayDeadlines = deadlineMap[dateStr];
    if (!dayDeadlines?.length) return;
    if (selected?.date === dateStr) {
      setSelected(null);
    } else {
      setSelected({ date: dateStr, deadlines: dayDeadlines });
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1 rounded hover:bg-slate-100 text-slate-500"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800">
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 rounded hover:bg-slate-100 text-slate-500"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div
            key={d}
            className="text-center text-xs text-slate-400 font-medium py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="h-8 bg-slate-100 rounded animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayDeadlines = deadlineMap[dateStr] ?? [];
            const isToday = dateStr === todayStr;
            const isSelected = selected?.date === dateStr;

            const uniqueStatuses = Array.from(
              new Set(dayDeadlines.map(getDisplayStatus))
            ).slice(0, 3);

            return (
              <button
                key={i}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "flex flex-col items-center rounded px-0.5 py-1 text-xs transition-colors",
                  isSelected && "ring-1 ring-teal-500 bg-teal-50",
                  !isSelected && isToday && "bg-teal-50 text-teal-700 font-semibold",
                  !isSelected && !isToday && "text-slate-700",
                  dayDeadlines.length > 0
                    ? "hover:bg-slate-50 cursor-pointer"
                    : "cursor-default"
                )}
                tabIndex={dayDeadlines.length > 0 ? 0 : -1}
                aria-label={
                  dayDeadlines.length > 0
                    ? `${formatDate(dateStr)}: ${dayDeadlines.length} deadline(s)`
                    : undefined
                }
              >
                <span>{day}</span>
                {uniqueStatuses.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {uniqueStatuses.map((s, si) => (
                      <span
                        key={si}
                        className={cn("inline-block h-1.5 w-1.5 rounded-full", {
                          "bg-red-500": s === "overdue",
                          "bg-amber-500":
                            s === "approaching" || s === "in_progress",
                          "bg-green-500": s === "completed",
                          "bg-slate-400": s === "upcoming",
                        })}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Date popover */}
      {selected && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">
              {formatDate(selected.date)}
            </span>
            <button
              onClick={() => setSelected(null)}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-400"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {selected.deadlines.map((d) => {
              const ds = getDisplayStatus(d);
              return (
                <div key={d.id} className="flex items-start gap-2">
                  <StatusDot status={ds} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {d.clientName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {DEADLINE_TYPE_LABELS[d.deadline_type]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 border-t border-slate-100 pt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {(
          [
            { color: "bg-slate-400", label: "Upcoming" },
            { color: "bg-amber-500", label: "Approaching / In Progress" },
            { color: "bg-green-500", label: "Completed" },
            { color: "bg-red-500", label: "Overdue" },
          ] as const
        ).map(({ color, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 text-xs text-slate-500"
          >
            <span className={cn("inline-block h-2 w-2 rounded-full", color)} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeadlinesPage() {
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  // Data
  const [deadlines, setDeadlines] = useState<DeadlineWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [filterClientId, setFilterClientId] = useState("all");
  const [filterType, setFilterType] = useState<"all" | DeadlineType>("all");
  const [filterDisplayStatus, setFilterDisplayStatus] = useState<
    "all" | DisplayStatus
  >("all");

  // Mobile view toggle
  const [activeView, setActiveView] = useState<"list" | "calendar">("list");

  // Toasts
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const undoTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );
  const pendingCompleteRef = useRef<
    Record<string, { prevStatus: DeadlineStatus }>
  >({});

  // ── Toast helpers ────────────────────────────────────────────────────────────

  const addToast = useCallback((toast: ToastData) => {
    setToasts((prev) => [...prev.filter((t) => t.id !== toast.id), toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadDeadlines = useCallback(async () => {
    if (!supabase) {
      setLoadError("Failed to load deadlines.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);

    const [deadlinesResult, clientsResult] = await Promise.all([
      supabase
        .from("deadlines")
        .select("*")
        .order("due_date", { ascending: true }),
      supabase
        .from("clients")
        .select("id, business_name, status"),
    ]);

    if (deadlinesResult.error || clientsResult.error) {
      setLoadError("Failed to load deadlines.");
      setLoading(false);
      return;
    }

    const clientMap: Record<string, { name: string; status: "active" | "inactive" }> = {};
    for (const c of clientsResult.data ?? []) {
      clientMap[c.id] = {
        name: c.business_name,
        status: c.status as "active" | "inactive",
      };
    }

    const merged: DeadlineWithClient[] = (deadlinesResult.data ?? []).map(
      (d) => ({
        ...d,
        clientName: clientMap[d.client_id]?.name ?? "Unknown Client",
        clientStatus: clientMap[d.client_id]?.status ?? "inactive",
      })
    );

    setDeadlines(merged);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadDeadlines();
  }, [loadDeadlines]);

  // ── Mark complete ─────────────────────────────────────────────────────────────

  const handleMarkComplete = useCallback(
    (deadline: DeadlineWithClient) => {
      const id = deadline.id;
      const prevStatus = deadline.status;

      // Cancel any pending undo for this deadline
      if (undoTimersRef.current[id]) {
        clearTimeout(undoTimersRef.current[id]);
        delete undoTimersRef.current[id];
      }

      // Optimistic update
      setDeadlines((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, status: "completed", completed_at: new Date().toISOString() }
            : d
        )
      );

      // Store prev state for undo
      pendingCompleteRef.current[id] = { prevStatus };

      // Undo action
      const undo = () => {
        clearTimeout(undoTimersRef.current[id]);
        delete undoTimersRef.current[id];
        delete pendingCompleteRef.current[id];
        setDeadlines((prev) =>
          prev.map((d) =>
            d.id === id
              ? { ...d, status: prevStatus, completed_at: deadline.completed_at ?? null }
              : d
          )
        );
        removeToast(id);
      };

      addToast({
        id,
        message: "Marked as completed.",
        variant: "success",
        action: { label: "Undo", onClick: undo },
      });

      // Commit after 5s
      undoTimersRef.current[id] = setTimeout(async () => {
        delete undoTimersRef.current[id];
        delete pendingCompleteRef.current[id];
        removeToast(id);

        if (!supabase) return;
        const { error } = await supabase
          .from("deadlines")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) {
          // Revert
          setDeadlines((prev) =>
            prev.map((d) =>
              d.id === id
                ? { ...d, status: prevStatus, completed_at: deadline.completed_at ?? null }
                : d
            )
          );
          addToast({
            id: `${id}-error`,
            message: "Failed to update status.",
            variant: "error",
          });
        }
      }, 5000);
    },
    [supabase, addToast, removeToast]
  );

  // ── Derived data ──────────────────────────────────────────────────────────────

  const clientOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { id: string; name: string }[] = [];
    for (const d of deadlines) {
      if (!seen.has(d.client_id)) {
        seen.add(d.client_id);
        opts.push({ id: d.client_id, name: d.clientName });
      }
    }
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [deadlines]);

  const filteredDeadlines = useMemo(() => {
    return deadlines.filter((d) => {
      if (filterClientId !== "all" && d.client_id !== filterClientId)
        return false;
      if (filterType !== "all" && d.deadline_type !== filterType) return false;
      if (filterDisplayStatus !== "all") {
        const ds = getDisplayStatus(d);
        if (ds !== filterDisplayStatus) return false;
      }
      return true;
    });
  }, [deadlines, filterClientId, filterType, filterDisplayStatus]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <ToastProvider>
      <div className="flex flex-col h-full">
        {/* ── Header area ── */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-slate-900">
              Deadline Tracker
            </h1>
            {/* Mobile view toggle */}
            <div className="flex items-center gap-1 md:hidden">
              <button
                onClick={() => setActiveView("list")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors",
                  activeView === "list"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
              <button
                onClick={() => setActiveView("calendar")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors",
                  activeView === "calendar"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Calendar
              </button>
            </div>
          </div>

          {/* ── Filter bar ── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Client filter */}
            <Select value={filterClientId} onValueChange={setFilterClientId}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clientOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Deadline type filter */}
            <Select
              value={filterType}
              onValueChange={(v) =>
                setFilterType(v as "all" | DeadlineType)
              }
            >
              <SelectTrigger className="h-8 text-xs w-[190px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {(
                  Object.entries(DEADLINE_TYPE_LABELS) as [
                    DeadlineType,
                    string,
                  ][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select
              value={filterDisplayStatus}
              onValueChange={(v) =>
                setFilterDisplayStatus(v as "all" | DisplayStatus)
              }
            >
              <SelectTrigger className="h-8 text-xs w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {(
                  Object.entries(DISPLAY_STATUS_LABELS) as [
                    DisplayStatus,
                    string,
                  ][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ── List view (left 65%, or full on mobile) ── */}
          <div
            className={cn(
              "flex flex-col overflow-y-auto bg-white border-r border-slate-200",
              "w-full md:w-[65%]",
              activeView === "calendar" && "hidden md:flex"
            )}
          >
            {/* Error state */}
            {loadError && (
              <div className="m-4 flex items-center justify-between rounded-md bg-red-50 px-4 py-3">
                <span className="text-sm text-red-700">{loadError}</span>
                <button
                  onClick={loadDeadlines}
                  className="flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-900"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            )}

            {/* Loading skeletons */}
            {loading && (
              <div className="flex flex-col">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && !loadError && filteredDeadlines.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center py-20 text-center px-6">
                <CalendarDays className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">
                  {deadlines.length === 0
                    ? "No deadlines scheduled. Onboard a client to generate their deadline calendar."
                    : "No deadlines match the current filters."}
                </p>
              </div>
            )}

            {/* Deadline rows */}
            {!loading && !loadError && filteredDeadlines.length > 0 && (
              <div className="flex flex-col divide-y divide-slate-100">
                {filteredDeadlines.map((deadline) => {
                  const ds = getDisplayStatus(deadline);
                  const isOverdue = ds === "overdue";
                  const isInactive = deadline.clientStatus === "inactive";
                  const showBIRWeekendFlag =
                    isBIRDeadline(deadline.deadline_type) &&
                    isWeekend(deadline.due_date) &&
                    deadline.status !== "completed";

                  return (
                    <div
                      key={deadline.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors",
                        isOverdue && !isInactive && "bg-red-50",
                        isInactive && "opacity-60"
                      )}
                    >
                      {/* Status dot */}
                      <StatusDot status={ds} />

                      {/* Client name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "text-sm font-semibold text-slate-900 truncate",
                              ds === "completed" && "text-slate-400"
                            )}
                          >
                            {deadline.clientName}
                          </span>
                          {isInactive && (
                            <span className="text-xs text-slate-400 italic">
                              Inactive client
                            </span>
                          )}
                        </div>

                        {/* Deadline type */}
                        <p
                          className={cn(
                            "text-sm font-normal text-slate-700 truncate",
                            ds === "completed" && "text-slate-400"
                          )}
                        >
                          {DEADLINE_TYPE_LABELS[deadline.deadline_type]}
                          {deadline.period ? ` — ${deadline.period}` : ""}
                        </p>

                        {/* BIR weekend flag */}
                        {showBIRWeekendFlag && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            Note: This deadline falls on a weekend. Verify the
                            official extended deadline with BIR.
                          </p>
                        )}
                      </div>

                      {/* Due date */}
                      <div className="text-sm text-slate-600 text-right flex-shrink-0 hidden sm:block">
                        {formatDate(deadline.due_date)}
                      </div>

                      {/* Mark Complete button */}
                      {deadline.status !== "completed" && (
                        <Button
                          variant="outline"
                          onClick={() => handleMarkComplete(deadline)}
                          className="flex-shrink-0 text-teal-600 border-teal-600 hover:bg-teal-50 hover:text-teal-700 text-xs h-7 min-w-0 px-2.5"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Mark Complete
                        </Button>
                      )}
                      {deadline.status === "completed" && (
                        <span className="text-xs text-green-600 font-medium flex-shrink-0 flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" />
                          Done
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Calendar view (right 35%, or full on mobile when toggled) ── */}
          <div
            className={cn(
              "overflow-y-auto bg-slate-50 p-4",
              "hidden md:block md:w-[35%]",
              activeView === "calendar" && "!block w-full"
            )}
          >
            <MiniCalendar deadlines={deadlines} loading={loading} />
          </div>
        </div>
      </div>

      {/* ── Toast stack ── */}
      <ToastViewport />
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant === "error" ? "error" : "success"}
          onOpenChange={(open) => {
            if (!open) removeToast(t.id);
          }}
        >
          <ToastTitle>{t.message}</ToastTitle>
          {t.action && (
            <ToastAction
              altText={t.action.label}
              onClick={t.action.onClick}
            >
              {t.action.label}
            </ToastAction>
          )}
          <ToastClose />
        </Toast>
      ))}
    </ToastProvider>
  );
}
