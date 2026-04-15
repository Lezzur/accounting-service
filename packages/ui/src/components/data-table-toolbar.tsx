import * as React from "react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterChip {
  id: string;
  label: string;
}

export interface DataTableToolbarProps {
  filters: FilterChip[];
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
  className?: string;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// DataTableToolbar
// ---------------------------------------------------------------------------

function DataTableToolbar({
  filters,
  onRemoveFilter,
  onClearAll,
  className,
  children,
}: DataTableToolbarProps) {
  if (filters.length === 0 && !children) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2 px-4 py-2", className)}>
      {children}
      {filters.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
        >
          {chip.label}
          <button
            type="button"
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            onClick={() => onRemoveFilter(chip.id)}
            aria-label={`Remove ${chip.label} filter`}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <path
                d="M1 1l6 6M7 1L1 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </span>
      ))}
      {filters.length > 1 && (
        <button
          type="button"
          className="text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          onClick={onClearAll}
        >
          Clear all
        </button>
      )}
    </div>
  );
}

export { DataTableToolbar };
