"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, Mail, Loader2 } from "lucide-react";
import { cn } from "@numera/ui";
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastClose,
} from "@numera/ui";
import { createClient } from "../../../../lib/supabase/client";
import type { DocumentTypeGuess } from "@numera/db";
import { useNotificationCount } from "../../components/notification-count-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationRow = {
  id: string;
  client_id: string | null;
  sender_email: string;
  subject: string;
  received_at: string;
  document_type_guess: DocumentTypeGuess | null;
  status: string;
  client: { business_name: string } | null;
  attachments: { id: string; original_filename: string; mime_type: string }[];
};

type ToastItem = {
  id: string;
  message: string;
  variant: "error" | "success";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<DocumentTypeGuess, string> = {
  receipt: "Receipt",
  bank_statement: "Bank Statement",
  invoice: "Invoice",
  credit_card_statement: "CC Statement",
  expense_report: "Expense Report",
  payroll_data: "Payroll",
  other: "Other",
};

function formatDocType(type: DocumentTypeGuess | null): string {
  if (!type) return "Document";
  return DOC_TYPE_LABELS[type] ?? "Document";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0)
    return d.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function truncateSubject(str: string): string {
  return str.length <= 60 ? str : str.slice(0, 60) + "…";
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="p-3 border-b border-slate-100 animate-pulse"
    >
      <div className="h-3.5 w-28 bg-slate-200 rounded mb-1.5" />
      <div className="h-3 w-44 bg-slate-100 rounded mb-1" />
      <div className="h-3 w-16 bg-slate-100 rounded mb-3" />
      <div className="h-5 w-20 bg-teal-50 rounded-full mb-2" />
      <div className="h-8 w-full bg-slate-100 rounded-md" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-10 text-center">
      <Mail
        size={32}
        className="text-slate-300 mb-3"
        aria-hidden="true"
        strokeWidth={1.5}
      />
      <p className="text-sm text-slate-500">
        No new documents.
        <br />
        You&rsquo;re up to date.
      </p>
    </div>
  );
}

// ─── Notification card ────────────────────────────────────────────────────────

function NotificationCard({
  notification,
  isProcessing,
  onProcess,
}: {
  notification: NotificationRow;
  isProcessing: boolean;
  onProcess: (id: string) => void;
}) {
  const clientName = notification.client?.business_name ?? null;
  const isUnknownSender = !clientName;

  return (
    <article className="p-3 border-b border-slate-100">
      {/* Client name */}
      <div className="flex items-center gap-1 mb-0.5 min-w-0">
        {isUnknownSender && (
          <AlertTriangle
            size={12}
            className="shrink-0 text-amber-500"
            aria-label="Unknown sender"
          />
        )}
        <span
          className={cn(
            "text-sm font-semibold truncate",
            isUnknownSender ? "text-slate-500" : "text-slate-900",
          )}
        >
          {clientName ?? "Unknown sender"}
        </span>
      </div>

      {/* Subject with tooltip for full text */}
      <p
        className="text-xs text-slate-500 truncate mb-0.5 leading-snug"
        title={notification.subject}
      >
        {truncateSubject(notification.subject)}
      </p>

      {/* Date received */}
      <p className="text-xs text-slate-400 mb-2">
        {formatDate(notification.received_at)}
      </p>

      {/* Document type badge */}
      {notification.document_type_guess && (
        <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-teal-100 text-teal-700 mb-2">
          {formatDocType(notification.document_type_guess)}
        </span>
      )}

      {/* Process button */}
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => onProcess(notification.id)}
        className={cn(
          "w-full flex items-center justify-center gap-1.5",
          "rounded-md px-3 py-1.5 text-sm font-medium",
          "bg-teal-600 text-white",
          "hover:bg-teal-700 active:bg-teal-800",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "transition-colors duration-[150ms]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1",
        )}
      >
        {isProcessing ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            <span>Processing…</span>
          </>
        ) : (
          "Process"
        )}
      </button>
    </article>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotificationPanel() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const { setUnprocessedCount } = useNotificationCount();

  // Stable supabase client ref — created once, never recreated
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(
    null,
  );
  if (supabaseRef.current === null) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;

  // ── Toast helpers ───────────────────────────────────────────────────────────

  const pushToast = useCallback(
    (message: string, variant: ToastItem["variant"]) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Fetch unprocessed notifications ────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from("email_notifications")
      .select(
        "*, client:clients(business_name), attachments:document_attachments(id, original_filename, mime_type)",
      )
      .eq("status", "unprocessed")
      .order("received_at", { ascending: false });

    if (error) {
      console.error("[NotificationPanel] fetch error:", error);
      return;
    }

    const rows = (data ?? []) as NotificationRow[];
    setNotifications(rows);
    setUnprocessedCount(rows.length);
  }, [supabase, setUnprocessedCount]);

  // ── Initial fetch ───────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
  }, [fetchNotifications]);

  // ── Realtime subscription ───────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel("email-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "email_notifications",
          filter: "status=eq.unprocessed",
        },
        () => {
          // Refetch to get the full row with joins
          fetchNotifications();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "email_notifications",
        },
        (payload) => {
          const updated = payload.new as { id: string; status: string };
          // Remove from panel when no longer unprocessed
          if (updated.status !== "unprocessed") {
            setNotifications((prev) => {
              const next = prev.filter((n) => n.id !== updated.id);
              setUnprocessedCount(next.length);
              return next;
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchNotifications, setUnprocessedCount]);

  // ── Process handler ─────────────────────────────────────────────────────────

  const handleProcess = useCallback(
    async (notificationId: string) => {
      // Already-processing guard
      if (processingIds.has(notificationId)) return;

      setProcessingIds((prev) => new Set(prev).add(notificationId));

      try {
        const { error } = await supabase.functions.invoke("process-document", {
          body: { notificationId },
        });

        if (error) {
          throw error;
        }

        // Optimistically remove from panel on success
        setNotifications((prev) => {
          const next = prev.filter((n) => n.id !== notificationId);
          setUnprocessedCount(next.length);
          return next;
        });
      } catch (err) {
        console.error("[NotificationPanel] process error:", err);
        pushToast("Failed to process document.", "error");
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(notificationId);
          return next;
        });
      }
    },
    [supabase, processingIds, setUnprocessedCount, pushToast],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ToastProvider swipeDirection="right">
      <aside
        aria-label="Email notifications"
        className={cn(
          // Fixed 280px, full height, white bg, right border
          "hidden md:flex flex-col",
          "w-[280px] shrink-0 h-full",
          "bg-white border-r border-slate-200",
        )}
      >
        {/* Header */}
        <div className="px-3 py-3 border-b border-slate-200 shrink-0">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Notifications
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : notifications.length === 0 ? (
            <EmptyState />
          ) : (
            notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                isProcessing={processingIds.has(notification.id)}
                onProcess={handleProcess}
              />
            ))
          )}
        </div>
      </aside>

      {/* Toast items — rendered inside ToastProvider, viewport is fixed bottom-right */}
      {toasts.map((toast) => (
        <Toast key={toast.id} variant={toast.variant} open>
          <ToastTitle>{toast.message}</ToastTitle>
          <ToastClose onClick={() => dismissToast(toast.id)} />
        </Toast>
      ))}
      <ToastViewport aria-live="polite" />
    </ToastProvider>
  );
}
