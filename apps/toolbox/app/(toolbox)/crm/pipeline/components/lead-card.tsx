"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays } from "lucide-react";
import { cn } from "@numera/ui";
import type { Database, LeadStage } from "@numera/db";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

export interface LeadCardProps {
  lead: LeadRow;
  onSelect: (lead: LeadRow) => void;
  /** When true, renders the overlay-dragging variant (no useDraggable, just styling). */
  overlay?: boolean;
}

// ─── Stage badge config ───────────────────────────────────────────────────────

const STAGE_BADGE: Record<LeadStage, { bg: string; text: string; label: string }> = {
  lead:          { bg: "bg-slate-100", text: "text-slate-700", label: "Lead" },
  contacted:     { bg: "bg-slate-100", text: "text-slate-700", label: "Contacted" },
  call_booked:   { bg: "bg-teal-100",  text: "text-teal-700",  label: "Call Booked" },
  proposal_sent: { bg: "bg-slate-100", text: "text-slate-700", label: "Proposal Sent" },
  negotiation:   { bg: "bg-amber-100", text: "text-amber-700", label: "Negotiation" },
  closed_won:    { bg: "bg-green-50",  text: "text-green-500", label: "Closed Won" },
  closed_lost:   { bg: "bg-red-50",    text: "text-red-500",   label: "Closed Lost" },
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Card inner (shared between draggable and overlay) ────────────────────────

export function LeadCardInner({
  lead,
  dragging,
  onSelect,
}: {
  lead: LeadRow;
  dragging: boolean;
  onSelect: (lead: LeadRow) => void;
}) {
  const badge = STAGE_BADGE[lead.stage];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(lead)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(lead)}
      className={cn(
        "bg-white rounded-lg p-3 min-w-[200px] cursor-pointer select-none",
        "border border-slate-100",
        "transition-shadow duration-200",
        dragging
          ? "shadow-md"
          : "shadow-xs hover:shadow-sm",
      )}
      style={dragging ? { transform: "rotate(2deg)" } : undefined}
    >
      {/* Business name */}
      <p className="text-sm font-semibold text-slate-900 truncate">
        {lead.business_name}
      </p>

      {/* Contact name */}
      {lead.contact_name && (
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {lead.contact_name}
        </p>
      )}

      {/* Stage badge + calendar icon */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            badge.bg,
            badge.text,
          )}
        >
          {badge.label}
        </span>
        {lead.stage === "call_booked" && (
          <CalendarDays size={13} className="text-teal-600 shrink-0" aria-label="Call booked" />
        )}
      </div>

      {/* Date added */}
      <p className="text-xs text-slate-400 mt-1.5">
        {formatDate(lead.created_at)}
      </p>
    </div>
  );
}

// ─── Draggable lead card ──────────────────────────────────────────────────────

export function LeadCard({ lead, onSelect, overlay = false }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: overlay,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  if (isDragging) {
    // Source slot: dashed placeholder
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        style={{ minWidth: 200 }}
        className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 h-[88px]"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      <LeadCardInner lead={lead} dragging={false} onSelect={onSelect} />
    </div>
  );
}
