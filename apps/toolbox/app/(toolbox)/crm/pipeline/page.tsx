"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@numera/ui";
import { KanbanBoard } from "./components/kanban-board";

export default function PipelinePage() {
  const [showClosed, setShowClosed] = useState(false);

  // Placeholder for Add Lead — wire up to a drawer/modal when built
  const handleAddLead = () => {
    // TODO: open Add Lead drawer
  };

  return (
    <div className="flex flex-col h-full p-6 gap-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-semibold text-slate-900 flex-1 min-w-0">
          Lead Pipeline
        </h1>

        {/* Show Closed toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm text-slate-600 whitespace-nowrap">Show Closed</span>
          <button
            role="switch"
            aria-checked={showClosed}
            onClick={() => setShowClosed((p) => !p)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150",
              showClosed ? "bg-teal-600" : "bg-slate-200",
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150",
                showClosed ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </button>
        </label>

        {/* Add Lead button */}
        <button
          onClick={handleAddLead}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md",
            "border border-teal-600 text-teal-600 text-sm font-medium",
            "hover:bg-teal-50 transition-colors duration-150",
          )}
        >
          <Plus size={16} />
          Add Lead
        </button>
      </div>

      {/* ── Board ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <KanbanBoard showClosed={showClosed} onAddLead={handleAddLead} />
      </div>
    </div>
  );
}
