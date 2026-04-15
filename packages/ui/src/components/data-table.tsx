import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type OnChangeFn,
  type Row,
  type Cell,
  type Header,
  type Table as TanStackTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../lib/utils";
import { Checkbox } from "./checkbox";
import { Button } from "./button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataTableEditEvent<TData> {
  row: TData;
  columnId: string;
  value: unknown;
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];

  /** Total row count (may exceed `data.length` when server-paginated). */
  totalRows?: number;

  /** Enable row selection checkboxes. */
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;

  /** Sorting state (controlled). */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;

  /** Inline editing. */
  enableEditing?: boolean;
  editingCell?: { rowIndex: number; columnId: string } | null;
  onEditingCellChange?: (cell: { rowIndex: number; columnId: string } | null) => void;
  onCellEdit?: (event: DataTableEditEvent<TData>) => void;

  /** Pagination (controlled). */
  pageIndex?: number;
  pageSize?: number;
  pageCount?: number;
  onPageChange?: (pageIndex: number) => void;

  /** States. */
  loading?: boolean;
  error?: React.ReactNode;
  onRetry?: () => void;
  emptyMessage?: React.ReactNode;

  /** Row height in px. Default 48. */
  rowHeight?: number;
  /** Max visible height in px before scrolling. Default 600. */
  maxHeight?: number;

  /** Additional class on the outermost wrapper. */
  className?: string;

  /** Columns that are editable (by column id). */
  editableColumns?: Set<string>;

  /** Custom cell renderer for edit mode. */
  renderEditCell?: (props: {
    row: TData;
    columnId: string;
    value: unknown;
    onCommit: (value: unknown) => void;
    onCancel: () => void;
  }) => React.ReactNode;

  /** Unique row id accessor. Falls back to row index. */
  getRowId?: (row: TData, index: number) => string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 40;
const PAGE_SIZE_DEFAULT = 50;

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  if (!direction) return null;
  return (
    <span className="ml-1 inline-block" aria-hidden="true">
      {direction === "asc" ? "↑" : "↓"}
    </span>
  );
}

// Debounce helper for keyboard events
function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
): T {
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();
  const callbackRef = React.useRef(callback);
  callbackRef.current = callback;

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return React.useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay);
    },
    [delay],
  ) as T;
}

// ---------------------------------------------------------------------------
// Selection column factory
// ---------------------------------------------------------------------------

export function getSelectionColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: "_select",
    size: 48,
    enableSorting: false,
    header: ({ table }: { table: TanStackTable<TData> }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all rows"
      />
    ),
    cell: ({ row }: { row: Row<TData> }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={`Select row ${row.index + 1}`}
      />
    ),
  };
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRows({
  columnCount,
  rowCount = 8,
  rowHeight,
}: {
  columnCount: number;
  rowCount?: number;
  rowHeight: number;
}) {
  return (
    <>
      {Array.from({ length: rowCount }, (_, i) => (
        <div
          key={i}
          role="row"
          className="flex items-center border-b border-slate-200"
          style={{ height: rowHeight }}
        >
          {Array.from({ length: columnCount }, (_, j) => (
            <div key={j} role="gridcell" className="flex-1 px-3">
              <div className="h-4 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

function DataTableInner<TData>(
  props: DataTableProps<TData>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    columns,
    data,
    totalRows,
    enableRowSelection = false,
    rowSelection: controlledRowSelection,
    onRowSelectionChange,
    sorting: controlledSorting,
    onSortingChange,
    enableEditing = false,
    editingCell,
    onEditingCellChange,
    onCellEdit,
    pageIndex: controlledPageIndex,
    pageSize = PAGE_SIZE_DEFAULT,
    pageCount: controlledPageCount,
    onPageChange,
    loading = false,
    error,
    onRetry,
    emptyMessage = "No data available.",
    rowHeight = ROW_HEIGHT,
    maxHeight = 600,
    className,
    editableColumns,
    renderEditCell,
    getRowId,
  } = props;

  // Uncontrolled fallbacks
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([]);
  const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({});

  const sorting = controlledSorting ?? internalSorting;
  const rowSelectionState = controlledRowSelection ?? internalRowSelection;

  // Pre-edit snapshot for Escape revert
  const preEditValueRef = React.useRef<unknown>(undefined);

  // Active editing cell (internal if uncontrolled)
  const [internalEditingCell, setInternalEditingCell] = React.useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);
  const activeEditingCell = editingCell !== undefined ? editingCell : internalEditingCell;
  const setActiveEditingCell = onEditingCellChange ?? setInternalEditingCell;

  // Build column defs with optional selection column prepended
  const allColumns = React.useMemo(() => {
    if (!enableRowSelection) return columns;
    return [getSelectionColumn<TData>(), ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      rowSelection: rowSelectionState,
      ...(controlledPageIndex !== undefined && { pagination: { pageIndex: controlledPageIndex, pageSize } }),
    },
    getRowId,
    onSortingChange: onSortingChange ?? setInternalSorting,
    onRowSelectionChange: onRowSelectionChange ?? setInternalRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: controlledPageIndex !== undefined ? undefined : getPaginationRowModel(),
    manualPagination: controlledPageIndex !== undefined,
    pageCount: controlledPageCount,
    enableRowSelection,
  });

  const { rows } = table.getRowModel();
  const headerGroups = table.getHeaderGroups();

  // Virtualizer
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  // Focused cell tracking for keyboard navigation
  const [focusedCell, setFocusedCell] = React.useState<{
    rowIndex: number;
    columnIndex: number;
  }>({ rowIndex: 0, columnIndex: 0 });

  // Get ordered list of editable column ids
  const editableColumnIds = React.useMemo(() => {
    if (!editableColumns) return [] as string[];
    return allColumns
      .map((col) => ("accessorKey" in col ? String(col.accessorKey) : col.id) ?? "")
      .filter((id) => editableColumns.has(id));
  }, [allColumns, editableColumns]);

  // Commit edit value
  const commitEdit = React.useCallback(
    (rowIndex: number, columnId: string, value: unknown) => {
      const row = rows[rowIndex];
      if (!row) return;
      onCellEdit?.({ row: row.original, columnId, value });
      preEditValueRef.current = undefined;
    },
    [rows, onCellEdit],
  );

  // Enter edit mode on a cell
  const enterEditMode = React.useCallback(
    (rowIndex: number, columnId: string) => {
      if (!enableEditing) return;
      if (editableColumns && !editableColumns.has(columnId)) return;
      const row = rows[rowIndex];
      if (!row) return;
      preEditValueRef.current = row.getValue(columnId);
      setActiveEditingCell({ rowIndex, columnId });
    },
    [enableEditing, editableColumns, rows, setActiveEditingCell],
  );

  // Cancel edit — always reverts
  const cancelEdit = React.useCallback(() => {
    preEditValueRef.current = undefined;
    setActiveEditingCell(null);
  }, [setActiveEditingCell]);

  // Advance to next editable cell (Tab)
  const advanceEdit = React.useCallback(
    (rowIndex: number, columnId: string, direction: 1 | -1) => {
      if (editableColumnIds.length === 0) {
        setActiveEditingCell(null);
        return;
      }

      const currentIdx = editableColumnIds.indexOf(columnId);
      let nextIdx = currentIdx + direction;
      let nextRow = rowIndex;

      if (nextIdx >= editableColumnIds.length) {
        nextIdx = 0;
        nextRow = rowIndex + 1;
      } else if (nextIdx < 0) {
        nextIdx = editableColumnIds.length - 1;
        nextRow = rowIndex - 1;
      }

      if (nextRow < 0 || nextRow >= rows.length) {
        setActiveEditingCell(null);
        return;
      }

      const nextColumnId = editableColumnIds[nextIdx];
      preEditValueRef.current = rows[nextRow]?.getValue(nextColumnId);
      setActiveEditingCell({ rowIndex: nextRow, columnId: nextColumnId });
      setFocusedCell({
        rowIndex: nextRow,
        columnIndex: allColumns.findIndex(
          (col) => (("accessorKey" in col ? String(col.accessorKey) : col.id) ?? "") === nextColumnId,
        ),
      });
    },
    [editableColumnIds, rows, allColumns, setActiveEditingCell],
  );

  // Debounced keyboard handler to prevent double-commits
  const handleKeyDown = useDebouncedCallback((e: React.KeyboardEvent) => {
    const isEditing = activeEditingCell !== null;
    const { rowIndex, columnIndex } = focusedCell;

    if (isEditing) {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
        return;
      }
      // Tab / Shift+Tab handled by edit cell itself via onCommit
      return;
    }

    // Grid navigation (not editing)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = Math.min(rowIndex + 1, rows.length - 1);
        setFocusedCell({ rowIndex: next, columnIndex });
        virtualizer.scrollToIndex(next);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = Math.max(rowIndex - 1, 0);
        setFocusedCell({ rowIndex: prev, columnIndex });
        virtualizer.scrollToIndex(prev);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        setFocusedCell({
          rowIndex,
          columnIndex: Math.min(columnIndex + 1, allColumns.length - 1),
        });
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        setFocusedCell({
          rowIndex,
          columnIndex: Math.max(columnIndex - 1, 0),
        });
        break;
      }
      case "Enter":
      case "F2": {
        e.preventDefault();
        const col = allColumns[columnIndex];
        const colId = ("accessorKey" in col ? String(col.accessorKey) : col.id) ?? "";
        if (enableEditing && editableColumns?.has(colId)) {
          enterEditMode(rowIndex, colId);
        }
        break;
      }
      case " ": {
        const col = allColumns[columnIndex];
        const colId = ("accessorKey" in col ? String(col.accessorKey) : col.id) ?? "";
        if (colId === "_select") {
          e.preventDefault();
          const row = rows[rowIndex];
          if (row) row.toggleSelected();
        }
        break;
      }
    }
  }, 50);

  // Pagination
  const actualPageIndex = controlledPageIndex ?? table.getState().pagination.pageIndex;
  const actualPageCount = controlledPageCount ?? table.getPageCount();
  const displayTotal = totalRows ?? data.length;
  const showFrom = actualPageIndex * pageSize + 1;
  const showTo = Math.min((actualPageIndex + 1) * pageSize, displayTotal);

  const goToPage = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      table.setPageIndex(page);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Error state
  if (error) {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col items-center justify-center rounded-md border border-slate-200 bg-white p-12", className)}
        role="grid"
      >
        <div className="text-sm text-slate-700">{error}</div>
        {onRetry && (
          <Button variant="outline" size="default" className="mt-4" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("flex flex-col rounded-md border border-slate-200 bg-white", className)}>
      {/* Scrollable grid area */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto"
        style={{ maxHeight }}
        role="grid"
        aria-rowcount={displayTotal}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-slate-50" role="rowgroup">
          {headerGroups.map((headerGroup) => (
            <div
              key={headerGroup.id}
              className="flex"
              role="row"
              style={{ height: HEADER_HEIGHT }}
            >
              {headerGroup.headers.map((header: Header<TData, unknown>) => {
                const canSort = header.column.getCanSort();
                return (
                  <div
                    key={header.id}
                    role="columnheader"
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                    }
                    className={cn(
                      "flex items-center px-3 text-xs font-medium uppercase tracking-wide text-slate-500",
                      canSort && "cursor-pointer select-none hover:text-slate-700",
                      header.id === "_select" && "sticky left-0 z-20 bg-slate-50",
                    )}
                    style={{
                      width: header.getSize(),
                      minWidth: header.getSize(),
                      flexShrink: 0,
                    }}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {canSort && <SortIndicator direction={header.column.getIsSorted()} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Body */}
        <div role="rowgroup">
          {loading ? (
            <SkeletonRows columnCount={allColumns.length} rowHeight={rowHeight} />
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              {emptyMessage}
            </div>
          ) : (
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                const isEditingRow = activeEditingCell?.rowIndex === virtualRow.index;
                const isFocusedRow = focusedCell.rowIndex === virtualRow.index;

                return (
                  <div
                    key={row.id}
                    data-index={virtualRow.index}
                    role="row"
                    aria-rowindex={virtualRow.index + 2} // +2: 1-indexed, +1 for header
                    aria-selected={row.getIsSelected() || undefined}
                    className={cn(
                      "absolute left-0 flex w-full items-center border-b border-slate-200",
                      isEditingRow
                        ? "border-l-2 border-l-teal-600 bg-teal-50"
                        : "hover:bg-slate-50",
                      row.getIsSelected() && !isEditingRow && "bg-teal-50",
                      isFocusedRow && !isEditingRow && "ring-1 ring-inset ring-teal-300",
                    )}
                    style={{
                      height: rowHeight,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.getVisibleCells().map((cell: Cell<TData, unknown>, cellIdx: number) => {
                      const colId = cell.column.id;
                      const isCellEditing =
                        isEditingRow && activeEditingCell?.columnId === colId;
                      const isCellFocused =
                        isFocusedRow && focusedCell.columnIndex === cellIdx;

                      return (
                        <div
                          key={cell.id}
                          role="gridcell"
                          aria-colindex={cellIdx + 1}
                          tabIndex={isCellFocused ? 0 : -1}
                          className={cn(
                            "flex items-center px-3 text-sm",
                            colId === "_select" && "sticky left-0 z-10 bg-inherit",
                            isCellFocused && "outline-none",
                          )}
                          style={{
                            width: cell.column.getSize(),
                            minWidth: cell.column.getSize(),
                            flexShrink: 0,
                            height: rowHeight,
                          }}
                          onClick={() => {
                            setFocusedCell({ rowIndex: virtualRow.index, columnIndex: cellIdx });
                            if (
                              enableEditing &&
                              editableColumns?.has(colId) &&
                              !isCellEditing
                            ) {
                              enterEditMode(virtualRow.index, colId);
                            }
                          }}
                        >
                          {isCellEditing && renderEditCell ? (
                            <EditCellWrapper
                              row={row.original}
                              columnId={colId}
                              value={cell.getValue()}
                              renderEditCell={renderEditCell}
                              onCommit={(value) => {
                                commitEdit(virtualRow.index, colId, value);
                                setActiveEditingCell(null);
                              }}
                              onCancel={cancelEdit}
                              onTab={(direction) => {
                                commitEdit(virtualRow.index, colId, cell.getValue());
                                advanceEdit(virtualRow.index, colId, direction);
                              }}
                            />
                          ) : (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pagination footer */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2">
          <span className="text-xs text-slate-500">
            Showing {showFrom}–{showTo} of {displayTotal}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="default"
              className="min-w-0 px-2 text-xs"
              disabled={actualPageIndex === 0}
              onClick={() => goToPage(actualPageIndex - 1)}
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(actualPageCount, 5) }, (_, i) => {
              let page: number;
              if (actualPageCount <= 5) {
                page = i;
              } else if (actualPageIndex < 3) {
                page = i;
              } else if (actualPageIndex > actualPageCount - 4) {
                page = actualPageCount - 5 + i;
              } else {
                page = actualPageIndex - 2 + i;
              }
              return (
                <Button
                  key={page}
                  variant={page === actualPageIndex ? "primary" : "ghost"}
                  size="default"
                  className="min-w-0 px-2.5 text-xs"
                  onClick={() => goToPage(page)}
                >
                  {page + 1}
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="default"
              className="min-w-0 px-2 text-xs"
              disabled={actualPageIndex >= actualPageCount - 1}
              onClick={() => goToPage(actualPageIndex + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditCellWrapper — handles Tab/Shift+Tab/Escape inside the editing input
// ---------------------------------------------------------------------------

function EditCellWrapper<TData>({
  row,
  columnId,
  value,
  renderEditCell,
  onCommit,
  onCancel,
  onTab,
}: {
  row: TData;
  columnId: string;
  value: unknown;
  renderEditCell: NonNullable<DataTableProps<TData>["renderEditCell"]>;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
  onTab: (direction: 1 | -1) => void;
}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        onTab(e.shiftKey ? -1 : 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        // onCommit is called by the rendered cell with its current value
      }
    },
    [onCancel, onTab],
  );

  React.useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const input = el.querySelector<HTMLElement>("input, select, textarea, [tabindex]");
    input?.focus();
  }, []);

  return (
    <div ref={wrapperRef} className="w-full" onKeyDown={handleKeyDown}>
      {renderEditCell({ row, columnId, value, onCommit, onCancel })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export with generic support via type assertion
// ---------------------------------------------------------------------------

export const DataTable = React.forwardRef(DataTableInner) as <TData>(
  props: DataTableProps<TData> & { ref?: React.ForwardedRef<HTMLDivElement> },
) => React.ReactElement | null;

export type { ColumnDef, SortingState, RowSelectionState } from "@tanstack/react-table";
