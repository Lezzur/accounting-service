"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  Search,
  FileText,
  Check,
  X,
  Download,
  Plus,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  DataTable,
  DataTableToolbar,
  Badge,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastAction,
  ToastClose,
  cn,
} from "@numera/ui";
import type {
  ColumnDef,
  SortingState,
  RowSelectionState,
  FilterChip,
  DataTableEditEvent,
} from "@numera/ui";
import { createClient } from "../../../../lib/supabase/client";
import type {
  TransactionStatus,
  TransactionType,
  AccountType,
} from "@numera/db";

// ─── Types ──────────────────────────────────────────────────────────────────

type TransactionRow = {
  id: string;
  client_id: string;
  date: string;
  description: string;
  amount: string;
  currency: string;
  type: TransactionType;
  category_code: string;
  category_confidence: number | null;
  source_email_notification_id: string | null;
  status: TransactionStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  category: { code: string; name: string; type: AccountType } | null;
  source_email: { subject: string; sender_email: string } | null;
  approved_by_user: { full_name: string } | null;
  client: { business_name: string } | null;
};

type ClientOption = { id: string; business_name: string };
type CategoryOption = {
  code: string;
  name: string;
  type: AccountType;
};

type ToastItem = {
  id: string;
  message: string;
  variant: "success" | "error" | "default";
  action?: { label: string; onClick: () => void };
  duration?: number;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const CATEGORY_CONFIDENCE_THRESHOLD = 0.85;

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Pending",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  manual_entry_required: "Manual Entry",
};

const STATUS_BADGE_MAP: Record<
  TransactionStatus,
  "pending" | "approved" | "rejected" | "in-review"
> = {
  pending: "pending",
  in_review: "in-review",
  approved: "approved",
  rejected: "rejected",
  manual_entry_required: "pending",
};

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatAmount(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return "₱0.00";
  return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split("T")[0]!,
    end: end.toISOString().split("T")[0]!,
  };
}

function toDateInputValue(iso: string): string {
  return iso.split("T")[0] ?? iso;
}

// Group categories by account type for the dropdown
function groupCategories(categories: CategoryOption[]) {
  const groups: Record<string, CategoryOption[]> = {};
  for (const cat of categories) {
    const key = cat.type;
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(cat);
  }
  return groups;
}

// ─── Component ──────────────────────────────────────────────────────────────

type TransactionGridProps = {
  onDocPreview?: (notificationId: string) => void;
};

export function TransactionGrid({ onDocPreview }: TransactionGridProps) {
  // ── Supabase client ──
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (supabaseRef.current === null) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;

  // ── Data state ──
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Reference data ──
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateStart, setDateStart] = useState(getCurrentMonthRange().start);
  const [dateEnd, setDateEnd] = useState(getCurrentMonthRange().end);
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  // ── Table state ──
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);

  // ── UI state ──
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingTxnId, setRejectingTxnId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [failedRowIds, _setFailedRowIds] = useState<Set<string>>(new Set());
  const [suggestingCategoryFor, setSuggestingCategoryFor] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast helpers ──
  const pushToast = useCallback(
    (
      message: string,
      variant: ToastItem["variant"],
      action?: ToastItem["action"],
      duration?: number,
    ) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant, action, duration }]);
      const timeout = duration ?? 4000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, timeout);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Debounced search ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPageIndex(0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // ── Reset page on filter change ──
  useEffect(() => {
    setPageIndex(0);
  }, [dateStart, dateEnd, statusFilter, categoryFilter, clientFilter]);

  // ── Fetch reference data ──
  useEffect(() => {
    async function loadRefData() {
      const [clientRes, catRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, business_name")
          .eq("status", "active")
          .order("business_name"),
        supabase
          .from("chart_of_accounts")
          .select("code, name, type:account_type")
          .eq("is_active", true)
          .order("code"),
      ]);
      if (clientRes.data) setClients(clientRes.data);
      if (catRes.data) setCategories(catRes.data as CategoryOption[]);
    }
    loadRefData();
  }, [supabase]);

  // ── Fetch transactions ──
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("transactions")
        .select(
          `
          *,
          category:chart_of_accounts(code, name, type:account_type),
          source_email:email_notifications(subject, sender_email),
          approved_by_user:users!approved_by(full_name),
          client:clients(business_name)
        `,
          { count: "exact" },
        )
        .gte("date", dateStart)
        .lte("date", dateEnd)
        .order("date", { ascending: sorting[0]?.desc === false });

      if (clientFilter) {
        query = query.eq("client_id", clientFilter);
      }
      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }
      if (categoryFilter) {
        query = query.eq("category_code", categoryFilter);
      }
      if (debouncedSearch) {
        query = query.ilike("description", `%${debouncedSearch}%`);
      }

      const offset = pageIndex * PAGE_SIZE;
      query = query.range(offset, offset + PAGE_SIZE - 1);

      const { data, count, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setTransactions((data ?? []) as TransactionRow[]);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error("[TransactionGrid] fetch error:", err);
      setError("Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [
    supabase,
    dateStart,
    dateEnd,
    clientFilter,
    statusFilter,
    categoryFilter,
    debouncedSearch,
    pageIndex,
    sorting,
  ]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // ── Realtime subscription ──
  useEffect(() => {
    const channel = supabase
      .channel("transactions-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        () => fetchTransactions(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions" },
        (payload) => {
          const updated = payload.new as TransactionRow;
          setTransactions((prev) =>
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchTransactions]);

  // ── Approve transaction ──
  const approveTransaction = useCallback(
    async (txnId: string) => {
      // Optimistic update
      const original = transactions.find((t) => t.id === txnId);
      if (!original) return;

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txnId
            ? {
                ...t,
                status: "approved" as TransactionStatus,
                approved_at: new Date().toISOString(),
              }
            : t,
        ),
      );

      pushToast("Transaction approved.", "success", {
        label: "Undo",
        onClick: async () => {
          // Revert optimistic update
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === txnId
                ? { ...t, status: original.status, approved_at: original.approved_at }
                : t,
            ),
          );
          // Revert in DB
          await supabase
            .from("transactions")
            .update({
              status: original.status,
              approved_by: original.approved_by,
              approved_at: original.approved_at,
            })
            .eq("id", txnId);
        },
      }, 5000);

      const { error: approveError } = await supabase
        .from("transactions")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", txnId);

      if (approveError) {
        // Revert on error
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === txnId
              ? { ...t, status: original.status, approved_at: original.approved_at }
              : t,
          ),
        );
        pushToast("Failed to approve transaction.", "error");
      }
    },
    [supabase, transactions, pushToast],
  );

  // ── Reject transaction ──
  const openRejectDialog = useCallback((txnId: string) => {
    setRejectingTxnId(txnId);
    setRejectReason("");
    setRejectDialogOpen(true);
  }, []);

  const confirmReject = useCallback(async () => {
    if (!rejectingTxnId) return;
    setRejectLoading(true);

    const { error: rejectError } = await supabase
      .from("transactions")
      .update({
        status: "rejected",
        rejection_reason: rejectReason || null,
      })
      .eq("id", rejectingTxnId);

    setRejectLoading(false);

    if (rejectError) {
      pushToast("Failed to reject transaction.", "error");
    } else {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === rejectingTxnId
            ? {
                ...t,
                status: "rejected" as TransactionStatus,
                rejection_reason: rejectReason || null,
              }
            : t,
        ),
      );
      pushToast("Transaction rejected.", "success");
    }

    setRejectDialogOpen(false);
    setRejectingTxnId(null);
  }, [supabase, rejectingTxnId, rejectReason, pushToast]);

  // ── Bulk approve ──
  const bulkApprove = useCallback(async () => {
    const selectedIds = Object.keys(rowSelection).filter(
      (k) => rowSelection[k],
    );
    if (selectedIds.length === 0) return;

    // Optimistic update all selected
    const originals = new Map<string, TransactionRow>();
    setTransactions((prev) =>
      prev.map((t) => {
        if (selectedIds.includes(t.id)) {
          originals.set(t.id, t);
          return { ...t, status: "approved" as TransactionStatus };
        }
        return t;
      }),
    );

    const { error: bulkError } = await supabase
      .from("transactions")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .in("id", selectedIds);

    if (bulkError) {
      // Revert all
      setTransactions((prev) =>
        prev.map((t) => {
          const orig = originals.get(t.id);
          return orig ? orig : t;
        }),
      );
      pushToast(
        `Failed to approve ${selectedIds.length} transactions.`,
        "error",
      );
    } else {
      pushToast(`${selectedIds.length} transactions approved.`, "success");
      setRowSelection({});
    }
  }, [supabase, rowSelection, pushToast]);

  // ── Bulk reject ──
  const bulkReject = useCallback(async () => {
    const selectedIds = Object.keys(rowSelection).filter(
      (k) => rowSelection[k],
    );
    if (selectedIds.length === 0) return;

    const { error: bulkError } = await supabase
      .from("transactions")
      .update({ status: "rejected" })
      .in("id", selectedIds);

    if (bulkError) {
      pushToast(
        `Failed to reject ${selectedIds.length} transactions.`,
        "error",
      );
    } else {
      setTransactions((prev) =>
        prev.map((t) =>
          selectedIds.includes(t.id)
            ? { ...t, status: "rejected" as TransactionStatus }
            : t,
        ),
      );
      pushToast(`${selectedIds.length} transactions rejected.`, "success");
      setRowSelection({});
    }
  }, [supabase, rowSelection, pushToast]);

  // ── Cell edit handler with AI correction tracking ──
  const handleCellEdit = useCallback(
    async (event: DataTableEditEvent<TransactionRow>) => {
      const { row, columnId, value } = event;
      const txnId = row.id;

      // If category changed on an approved transaction, revert to in_review
      const wasApproved = row.status === "approved";
      const isCategoryChange = columnId === "category_code";

      // Track AI correction for category edits
      if (isCategoryChange && row.category_code !== value) {
        // Get current user for corrected_by
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          const { error: correctionError } = await supabase
            .from("ai_corrections")
            .insert({
              transaction_id: txnId,
              field_name: "category_code",
              original_value: row.category_code,
              corrected_value: String(value),
              corrected_by: currentUser.id,
            });

          if (correctionError) {
            console.error("[TransactionGrid] correction insert error:", correctionError);
          }
        }
      }

      const updatePayload: Record<string, unknown> = {
        [columnId]: value,
      };

      // Revert approved status on category change
      if (isCategoryChange && wasApproved) {
        updatePayload.status = "in_review";
      }
      // `.update()` expects the specific Update type, but we only know the
      // shape at runtime (dynamic key). Cast — narrowing here would require
      // per-column overloads we don't have.
      const typedPayload = updatePayload as never;

      // Optimistic update
      setTransactions((prev) =>
        prev.map((t) => {
          if (t.id !== txnId) return t;
          const updated = { ...t, [columnId]: value };
          if (isCategoryChange && wasApproved) {
            updated.status = "in_review";
          }
          // Update the nested category object if category_code changed
          if (isCategoryChange) {
            const cat = categories.find((c) => c.code === value);
            updated.category = cat
              ? { code: cat.code, name: cat.name, type: cat.type }
              : updated.category;
          }
          return updated;
        }),
      );

      const { error: updateError } = await supabase
        .from("transactions")
        .update(typedPayload)
        .eq("id", txnId);

      if (updateError) {
        // Revert on error
        setTransactions((prev) =>
          prev.map((t) => (t.id === txnId ? row : t)),
        );
        pushToast("Failed to save. Please try again.", "error");
      } else {
        pushToast("Transaction updated.", "success");
        if (isCategoryChange && wasApproved) {
          pushToast(
            "Edited after approval — requires re-approval.",
            "default",
          );
        }
      }
    },
    [supabase, categories, pushToast],
  );

  // ── Category suggestion ──
  const suggestCategory = useCallback(
    async (txnId: string) => {
      setSuggestingCategoryFor(txnId);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "suggest-category",
          { body: { transactionId: txnId } },
        );

        if (fnError) throw fnError;

        if (data?.suggestedCode) {
          const cat = categories.find((c) => c.code === data.suggestedCode);
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === txnId
                ? {
                    ...t,
                    category_code: data.suggestedCode,
                    category_confidence: data.confidence ?? 0.9,
                    category: cat
                      ? { code: cat.code, name: cat.name, type: cat.type }
                      : t.category,
                  }
                : t,
            ),
          );
          pushToast(`Category suggested: ${cat?.name ?? data.suggestedCode}`, "success");
        }
      } catch (err) {
        console.error("[TransactionGrid] suggest-category error:", err);
        pushToast("Category suggestion failed.", "error");
      } finally {
        setSuggestingCategoryFor(null);
      }
    },
    [supabase, categories, pushToast],
  );

  // ── Filter chips ──
  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    const defaultRange = getCurrentMonthRange();
    if (dateStart !== defaultRange.start || dateEnd !== defaultRange.end) {
      chips.push({
        id: "date",
        label: `Date: ${formatDate(dateStart)} – ${formatDate(dateEnd)}`,
      });
    }
    if (statusFilter) {
      chips.push({
        id: "status",
        label: `Status: ${STATUS_LABELS[statusFilter]}`,
      });
    }
    if (categoryFilter) {
      const cat = categories.find((c) => c.code === categoryFilter);
      chips.push({
        id: "category",
        label: `Category: ${cat?.name ?? categoryFilter}`,
      });
    }
    if (clientFilter) {
      const client = clients.find((c) => c.id === clientFilter);
      chips.push({
        id: "client",
        label: `Client: ${client?.business_name ?? "Unknown"}`,
      });
    }
    if (debouncedSearch) {
      chips.push({ id: "search", label: `Search: "${debouncedSearch}"` });
    }
    return chips;
  }, [
    dateStart,
    dateEnd,
    statusFilter,
    categoryFilter,
    clientFilter,
    debouncedSearch,
    categories,
    clients,
  ]);

  const removeFilter = useCallback(
    (id: string) => {
      switch (id) {
        case "date": {
          const range = getCurrentMonthRange();
          setDateStart(range.start);
          setDateEnd(range.end);
          break;
        }
        case "status":
          setStatusFilter("");
          break;
        case "category":
          setCategoryFilter("");
          break;
        case "client":
          setClientFilter("");
          break;
        case "search":
          setSearch("");
          setDebouncedSearch("");
          break;
      }
    },
    [],
  );

  const clearAllFilters = useCallback(() => {
    const range = getCurrentMonthRange();
    setDateStart(range.start);
    setDateEnd(range.end);
    setStatusFilter("");
    setCategoryFilter("");
    setClientFilter("");
    setSearch("");
    setDebouncedSearch("");
  }, []);

  // ── Grouped categories for edit dropdown ──
  const groupedCategories = useMemo(
    () => groupCategories(categories),
    [categories],
  );

  // ── Editable columns ──
  const editableColumns = useMemo(
    () => new Set(["date", "description", "amount", "category_code"]),
    [],
  );

  // ── Edit cell renderer ──
  const renderEditCell = useCallback(
    ({
      row: _row,
      columnId,
      value,
      onCommit,
      onCancel,
    }: {
      row: TransactionRow;
      columnId: string;
      value: unknown;
      onCommit: (value: unknown) => void;
      onCancel: () => void;
    }) => {
      switch (columnId) {
        case "date":
          return (
            <input
              type="date"
              defaultValue={toDateInputValue(String(value))}
              className="w-full rounded-md border border-teal-600 bg-white px-2 py-1 text-sm focus:outline-none"
              onBlur={(e) => onCommit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCommit(e.currentTarget.value);
              }}
            />
          );

        case "description":
          return (
            <input
              type="text"
              defaultValue={String(value)}
              maxLength={255}
              className="w-full rounded-md border border-teal-600 bg-white px-2 py-1 text-sm focus:outline-none"
              onBlur={(e) => {
                if (!e.target.value.trim()) {
                  onCancel();
                  return;
                }
                onCommit(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (!e.currentTarget.value.trim()) {
                    onCancel();
                    return;
                  }
                  onCommit(e.currentTarget.value);
                }
              }}
            />
          );

        case "amount":
          return (
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-500">₱</span>
              <input
                type="number"
                step="0.01"
                defaultValue={String(value)}
                className="w-full rounded-md border border-teal-600 bg-white px-2 py-1 text-sm text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                onBlur={(e) => {
                  const num = parseFloat(e.target.value);
                  if (isNaN(num)) {
                    onCancel();
                    return;
                  }
                  onCommit(num.toFixed(2));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const num = parseFloat(e.currentTarget.value);
                    if (isNaN(num)) {
                      onCancel();
                      return;
                    }
                    onCommit(num.toFixed(2));
                  }
                }}
              />
            </div>
          );

        case "category_code":
          return (
            <select
              defaultValue={String(value)}
              className="w-full rounded-md border border-teal-600 bg-white px-2 py-1 text-sm focus:outline-none"
              onChange={(e) => onCommit(e.target.value)}
              onBlur={(e) => onCommit(e.target.value)}
            >
              <option value="">Select category...</option>
              {Object.entries(groupedCategories).map(([type, cats]) => (
                <optgroup key={type} label={ACCOUNT_TYPE_LABELS[type as AccountType] ?? type}>
                  {cats.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.code} — {cat.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          );

        default:
          return null;
      }
    },
    [groupedCategories],
  );

  // ── Column definitions ──
  const columns = useMemo<ColumnDef<TransactionRow, unknown>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        size: 110,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {formatDate(row.original.date)}
          </span>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 220,
        cell: ({ row }) => (
          <span
            className="text-sm truncate block max-w-[200px]"
            title={row.original.description}
          >
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "amount",
        header: () => <span className="w-full text-right block">Amount (PHP)</span>,
        size: 140,
        cell: ({ row }) => (
          <span
            className="text-sm text-right block w-full"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatAmount(row.original.amount)}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 80,
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={cn(
              "text-sm font-medium",
              row.original.type === "debit" ? "text-red-500" : "text-green-500",
            )}
          >
            {row.original.type === "debit" ? "Debit" : "Credit"}
          </span>
        ),
      },
      {
        accessorKey: "category_code",
        header: "Category",
        size: 160,
        cell: ({ row }) => {
          const txn = row.original;
          const lowConfidence =
            txn.category_confidence === null ||
            txn.category_confidence < CATEGORY_CONFIDENCE_THRESHOLD;

          if (lowConfidence && !txn.category?.name) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  suggestCategory(txn.id);
                }}
                disabled={suggestingCategoryFor === txn.id}
                className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 text-sm"
                title="Low confidence — click to get AI suggestion"
              >
                {suggestingCategoryFor === txn.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <AlertCircle size={14} className="text-amber-500" />
                )}
                <span>?</span>
              </button>
            );
          }

          return (
            <span className="text-sm flex items-center gap-1">
              {lowConfidence && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    suggestCategory(txn.id);
                  }}
                  disabled={suggestingCategoryFor === txn.id}
                  className="text-amber-500 hover:text-amber-600"
                  title="Low confidence — click to get AI suggestion"
                >
                  {suggestingCategoryFor === txn.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <AlertCircle size={12} />
                  )}
                </button>
              )}
              <span className="truncate" title={txn.category?.name ?? txn.category_code}>
                {txn.category?.name ?? txn.category_code}
              </span>
            </span>
          );
        },
      },
      {
        id: "client_name",
        header: "Client",
        size: 150,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm truncate block max-w-[140px]" title={row.original.client?.business_name ?? ""}>
            {row.original.client?.business_name ?? "—"}
          </span>
        ),
      },
      {
        id: "source",
        header: "Source",
        size: 60,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.source_email_notification_id ? (
            <button
              type="button"
              className="text-slate-500 hover:text-teal-600"
              title={row.original.source_email?.subject ?? "View source document"}
              onClick={(e) => {
                e.stopPropagation();
                if (onDocPreview && row.original.source_email_notification_id) {
                  onDocPreview(row.original.source_email_notification_id);
                }
              }}
            >
              <FileText size={16} />
            </button>
          ) : (
            <span className="text-slate-300">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        cell: ({ row }) => (
          <Badge status={STATUS_BADGE_MAP[row.original.status]}>
            {STATUS_LABELS[row.original.status]}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => {
          const txn = row.original;
          if (txn.status === "approved" || txn.status === "rejected") return null;

          return (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  approveTransaction(txn.id);
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-teal-600 hover:bg-teal-50 transition-colors"
                title="Approve"
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openRejectDialog(txn.id);
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 transition-colors"
                title="Reject"
              >
                <X size={16} />
              </button>
            </div>
          );
        },
      },
    ],
    [approveTransaction, openRejectDialog, suggestCategory, suggestingCategoryFor, onDocPreview],
  );

  // ── Derived ──
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  return (
    <ToastProvider swipeDirection="right">
      <div className="flex flex-col h-full">
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h1 className="text-xl font-semibold text-slate-900">Workdesk</h1>
          <div className="relative w-full max-w-sm ml-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type="search"
              placeholder="Search transactions, receipts, or clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50/60 shrink-0">
          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:border-teal-600 focus:border-2 transition-[border-color,border-width] duration-[100ms]"
              aria-label="Start date"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:border-teal-600 focus:border-2 transition-[border-color,border-width] duration-[100ms]"
              aria-label="End date"
            />
          </div>

          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-teal-600 focus:border-2 transition-[border-color,border-width] duration-[100ms]"
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {Object.entries(groupedCategories).map(([type, cats]) => (
              <optgroup key={type} label={ACCOUNT_TYPE_LABELS[type as AccountType] ?? type}>
                {cats.map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as TransactionStatus | "")
            }
            className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-teal-600 focus:border-2 transition-[border-color,border-width] duration-[100ms]"
            aria-label="Filter by status"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="manual_entry_required">Manual Entry</option>
          </select>

          {/* Client */}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-teal-600 focus:border-2 transition-[border-color,border-width] duration-[100ms]"
            aria-label="Filter by client"
          >
            <option value="">Client: All</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name}
              </option>
            ))}
          </select>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons */}
          <Button
            variant="ghost"
            className="h-8 min-w-0 gap-1.5 px-3 text-xs text-slate-700"
          >
            <Download size={14} />
            Export
          </Button>
          <Button className="h-8 min-w-0 gap-1.5 px-3 text-xs">
            <Plus size={14} />
            New Entry
          </Button>
        </div>

        {/* ── Filter chips ────────────────────────────────────────────────── */}
        {filterChips.length > 0 && (
          <DataTableToolbar
            filters={filterChips}
            onRemoveFilter={removeFilter}
            onClearAll={clearAllFilters}
            className="border-b border-slate-100"
          />
        )}

        {/* ── Data table ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto min-h-0 px-6 py-4">
          <DataTable<TransactionRow>
            columns={columns}
            data={transactions}
            totalRows={totalCount}
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            sorting={sorting}
            onSortingChange={setSorting}
            enableEditing
            editableColumns={editableColumns}
            editingCell={editingCell}
            onEditingCellChange={setEditingCell}
            onCellEdit={handleCellEdit}
            renderEditCell={renderEditCell}
            pageIndex={pageIndex}
            pageSize={PAGE_SIZE}
            pageCount={pageCount}
            onPageChange={setPageIndex}
            loading={loading}
            error={error ? "Failed to load transactions." : undefined}
            onRetry={fetchTransactions}
            emptyMessage={
              <div className="flex flex-col items-center gap-2 py-8">
                <p className="text-sm text-slate-500">
                  No transactions for this period.
                </p>
                <a
                  href="#"
                  className="text-sm text-teal-600 hover:text-teal-700 underline underline-offset-2"
                  onClick={(e) => {
                    e.preventDefault();
                    // Scroll to notification panel or navigate to inbox
                  }}
                >
                  Process documents from the inbox.
                </a>
              </div>
            }
            getRowId={(row) => row.id}
            rowHeight={48}
            maxHeight={9999}
            className={cn(
              "border-0",
              failedRowIds.size > 0 && "[&_[data-failed='true']]:bg-red-50",
            )}
          />
        </div>

        {/* ── Bulk action bar ─────────────────────────────────────────────── */}
        {selectedCount > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-white border-t border-slate-200 px-6 py-3 shadow-lg md:left-[64px]">
            <span className="text-sm text-slate-700">
              {selectedCount} transaction{selectedCount !== 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                className="h-8 min-w-0 gap-1.5 px-3 text-xs"
                onClick={bulkApprove}
              >
                <Check size={14} />
                Approve Selected
              </Button>
              <Button
                variant="destructive-outline"
                className="h-8 min-w-0 gap-1.5 px-3 text-xs"
                onClick={bulkReject}
              >
                <X size={14} />
                Reject Selected
              </Button>
              <Button
                variant="ghost"
                className="h-8 min-w-0 px-3 text-xs"
                onClick={() => setRowSelection({})}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Reject reason dialog ──────────────────────────────────────────── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Transaction</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejecting this transaction.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (optional)"
            rows={3}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-teal-600 focus:border-2 transition-[border-color,border-width] duration-[100ms] resize-none"
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRejectDialogOpen(false)}
              disabled={rejectLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectLoading}
              className="gap-1.5"
            >
              {rejectLoading && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toasts ────────────────────────────────────────────────────────── */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          open
          duration={toast.duration}
        >
          <ToastTitle>{toast.message}</ToastTitle>
          {toast.action && (
            <ToastAction altText={toast.action.label} onClick={toast.action.onClick}>
              {toast.action.label}
            </ToastAction>
          )}
          <ToastClose onClick={() => dismissToast(toast.id)} />
        </Toast>
      ))}
      <ToastViewport aria-live="polite" />
    </ToastProvider>
  );
}
