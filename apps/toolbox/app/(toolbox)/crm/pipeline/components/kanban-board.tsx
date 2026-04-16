"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { createClient } from "@numera/db";
import type { Database, LeadStage } from "@numera/db";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastClose,
  cn,
} from "@numera/ui";
import { Plus, ChevronRight, ChevronDown } from "lucide-react";
import { LeadCard, LeadCardInner } from "./lead-card";
import { LeadDetailDrawer } from "./lead-detail-drawer";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

interface ToastData {
  id: string;
  message: string;
  variant: "success" | "error";
}

interface PendingMove {
  lead: LeadRow;
  targetStage: LeadStage;
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_ORDER: LeadStage[] = [
  "lead",
  "contacted",
  "call_booked",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
];

interface ColumnConfig {
  stage: LeadStage;
  label: string;
  headerBg: string;
  countBg: string;
  countText: string;
  isClosed: boolean;
}

const COLUMNS: ColumnConfig[] = [
  { stage: "lead",          label: "Lead",          headerBg: "",              countBg: "bg-slate-100",  countText: "text-slate-700", isClosed: false },
  { stage: "contacted",     label: "Contacted",     headerBg: "",              countBg: "bg-slate-100",  countText: "text-slate-700", isClosed: false },
  { stage: "call_booked",   label: "Call Booked",   headerBg: "",              countBg: "bg-teal-100",   countText: "text-teal-700",  isClosed: false },
  { stage: "proposal_sent", label: "Proposal Sent", headerBg: "",              countBg: "bg-slate-100",  countText: "text-slate-700", isClosed: false },
  { stage: "negotiation",   label: "Negotiation",   headerBg: "",              countBg: "bg-amber-100",  countText: "text-amber-700", isClosed: false },
  { stage: "closed_won",    label: "Closed Won",    headerBg: "",              countBg: "bg-green-50",   countText: "text-green-600", isClosed: true  },
  { stage: "closed_lost",   label: "Closed Lost",   headerBg: "",              countBg: "bg-red-50",     countText: "text-red-500",   isClosed: true  },
];

const CLOSE_REASON_SUGGESTIONS = [
  "Budget",
  "Timing",
  "Went with competitor",
  "No response",
  "Other",
];

function isBackwardMove(from: LeadStage, to: LeadStage): boolean {
  return STAGE_ORDER.indexOf(to) < STAGE_ORDER.indexOf(from);
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg p-3 min-w-[200px] border border-slate-100 shadow-xs space-y-2 animate-pulse">
      <div className="h-3 rounded bg-slate-200 w-3/4" />
      <div className="h-2.5 rounded bg-slate-200 w-1/2" />
      <div className="h-4 rounded-full bg-slate-200 w-20 mt-2" />
      <div className="h-2 rounded bg-slate-200 w-16 mt-1" />
    </div>
  );
}

// ─── Droppable column ─────────────────────────────────────────────────────────

function KanbanColumn({
  config,
  leads,
  loading,
  onSelect,
  activeId,
  onAddLead,
}: {
  config: ColumnConfig;
  leads: LeadRow[];
  loading: boolean;
  onSelect: (lead: LeadRow) => void;
  activeId: string | null;
  onAddLead?: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: config.stage,
    data: { stage: config.stage },
  });

  return (
    <div
      className="flex flex-col gap-0 min-w-[220px] w-[220px] shrink-0"
      aria-label={`${config.label} column`}
    >
      {/* Column header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 rounded-t-lg border border-b-0 border-slate-200 bg-slate-50",
          "transition-colors duration-150",
          isOver && "bg-teal-50",
        )}
      >
        <span className="text-sm font-semibold text-slate-700">{config.label}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium",
              config.countBg,
              config.countText,
            )}
          >
            {loading ? "–" : leads.length}
          </span>
          {config.stage === "lead" && onAddLead && (
            <button
              onClick={onAddLead}
              className="rounded-full p-0.5 text-teal-600 hover:bg-teal-50 transition-colors"
              aria-label="Add lead"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Column body */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[300px] rounded-b-lg border border-slate-200 bg-slate-50/50 p-2 space-y-2 overflow-y-auto",
          isOver && "bg-teal-50/30",
        )}
      >
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            {Math.random() > 0.4 && <SkeletonCard />}
          </>
        ) : leads.length === 0 ? (
          <p className="text-sm text-slate-500 text-center pt-6">No leads</p>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Mobile stage row ─────────────────────────────────────────────────────────

function MobileStageSection({
  config,
  leads,
  loading,
  onSelect,
  onStageChange,
}: {
  config: ColumnConfig;
  leads: LeadRow[];
  loading: boolean;
  onSelect: (lead: LeadRow) => void;
  onStageChange: (lead: LeadRow, newStage: LeadStage) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-white text-sm font-semibold text-slate-700"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
      >
        <span>{config.label}</span>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium", config.countText)}>
            {loading ? "–" : leads.length}
          </span>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="px-4 py-3 space-y-2">
              <div className="h-3 rounded bg-slate-200 animate-pulse w-2/3" />
              <div className="h-3 rounded bg-slate-200 animate-pulse w-1/2" />
            </div>
          ) : leads.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">No leads</p>
          ) : (
            leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between px-4 py-3 gap-3"
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => onSelect(lead)}
                >
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {lead.business_name}
                  </p>
                  {lead.contact_name && (
                    <p className="text-xs text-slate-500 truncate">{lead.contact_name}</p>
                  )}
                </button>
                <Select
                  value={lead.stage}
                  onValueChange={(v) => onStageChange(lead, v as LeadStage)}
                >
                  <SelectTrigger className="w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_ORDER.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {COLUMNS.find((c) => c.stage === s)?.label ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Close reason dialog ──────────────────────────────────────────────────────

function CloseReasonDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState(false);

  const handleConfirm = () => {
    const value = reason.trim();
    if (!value) {
      setError(true);
      return;
    }
    onConfirm(value);
    setReason("");
    setSuggestion("");
    setError(false);
  };

  const handleCancel = () => {
    setReason("");
    setSuggestion("");
    setError(false);
    onCancel();
  };

  const handleSuggestionChange = (v: string) => {
    setSuggestion(v);
    if (v !== "Other") setReason(v);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Why was this lead lost?</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Select value={suggestion} onValueChange={handleSuggestionChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a reason…" />
            </SelectTrigger>
            <SelectContent>
              {CLOSE_REASON_SUGGESTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value.slice(0, 500));
              setError(false);
            }}
            placeholder="Describe the reason…"
            maxLength={500}
            rows={3}
            className={cn(
              "w-full rounded-md border px-3 py-2 text-sm text-slate-900",
              "placeholder:text-slate-400 resize-none",
              "focus:outline-none focus:border-2 focus:border-teal-600",
              "transition-[border-color,border-width] duration-100",
              error ? "border-red-500" : "border-slate-200",
            )}
          />
          {error && (
            <p className="text-xs text-red-500">A reason is required.</p>
          )}
          <p className="text-xs text-slate-400 text-right">{reason.length}/500</p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleConfirm}>Confirm Lost</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Kanban board ─────────────────────────────────────────────────────────────

export function KanbanBoard({
  showClosed,
  onAddLead,
}: {
  showClosed: boolean;
  onAddLead: () => void;
}) {
  const supabase = useMemo(() => {
    try { return createClient(); } catch { return null; }
  }, []);

  // Data
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // DnD
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeLead = leads.find((l) => l.id === activeId) ?? null;

  // Reduced motion
  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      prefersReducedMotion.current = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    }
  }, []);

  // Close reason dialog
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  // Lead detail drawer
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((t: ToastData) => {
    setToasts((prev) => [...prev.filter((x) => x.id !== t.id), t]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Load leads ─────────────────────────────────────────────────────────────

  const loadLeads = useCallback(async () => {
    if (!supabase) {
      setLoadError("Failed to load leads.");
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setLeads(data ?? []);
    } catch {
      setLoadError("Failed to load leads. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // ── Move lead ──────────────────────────────────────────────────────────────

  const moveLead = useCallback(async (
    lead: LeadRow,
    targetStage: LeadStage,
    closeReason?: string,
  ) => {
    const prevStage = lead.stage;

    // Optimistic
    setLeads((prev) =>
      prev.map((l) =>
        l.id === lead.id
          ? { ...l, stage: targetStage, close_reason: closeReason ?? l.close_reason }
          : l
      )
    );

    if (!supabase) return;

    try {
      const update: Database["public"]["Tables"]["leads"]["Update"] = {
        stage: targetStage,
        ...(closeReason ? { close_reason: closeReason } : {}),
      };
      const { error } = await supabase
        .from("leads")
        .update(update)
        .eq("id", lead.id);
      if (error) throw error;
    } catch {
      // Snap back
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id ? { ...l, stage: prevStage } : l
        )
      );
      addToast({
        id: `move-err-${lead.id}-${Date.now()}`,
        message: "Failed to update lead stage. Please try again.",
        variant: "error",
      });
    }
  }, [supabase, addToast]);

  // ── DnD handlers ───────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const lead = active.data.current?.lead as LeadRow | undefined;
    if (!lead) return;

    const targetStage = over.id as LeadStage;
    if (targetStage === lead.stage) return;

    if (isBackwardMove(lead.stage, targetStage)) {
      // Snap back — no state change
      return;
    }

    if (targetStage === "closed_lost") {
      setPendingMove({ lead, targetStage });
      return;
    }

    moveLead(lead, targetStage);
  }, [moveLead]);

  // ── Mobile stage change ────────────────────────────────────────────────────

  const handleMobileStageChange = useCallback((lead: LeadRow, newStage: LeadStage) => {
    if (isBackwardMove(lead.stage, newStage)) return;
    if (newStage === "closed_lost") {
      setPendingMove({ lead, targetStage: newStage });
      return;
    }
    moveLead(lead, newStage);
  }, [moveLead]);

  // ── Grouped leads ──────────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const map: Record<LeadStage, LeadRow[]> = {
      lead: [], contacted: [], call_booked: [],
      proposal_sent: [], negotiation: [],
      closed_won: [], closed_lost: [],
    };
    for (const lead of leads) {
      map[lead.stage].push(lead);
    }
    return map;
  }, [leads]);

  const visibleColumns = COLUMNS.filter(
    (c) => !c.isClosed || showClosed
  );

  const totalLeads = leads.length;

  // ── Error / empty board ────────────────────────────────────────────────────

  if (!loading && loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-slate-500">{loadError}</p>
        <Button variant="outline" onClick={loadLeads}>Retry</Button>
      </div>
    );
  }

  if (!loading && totalLeads === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-slate-500">
          No leads yet. Add your first lead to get started.
        </p>
        <Button onClick={onAddLead} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </div>
    );
  }

  return (
    <ToastProvider swipeDirection="right">
      {/* ── Desktop Kanban board ──────────────────────────────────────── */}
      <div className="hidden md:block">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4 pt-1">
            {visibleColumns.map((col) => (
              <KanbanColumn
                key={col.stage}
                config={col}
                leads={grouped[col.stage]}
                loading={loading}
                onSelect={(lead) => setSelectedLeadId(lead.id)}
                activeId={activeId}
                onAddLead={col.stage === "lead" ? onAddLead : undefined}
              />
            ))}
          </div>

          {/* Drag overlay */}
          <DragOverlay
            dropAnimation={
              prefersReducedMotion.current
                ? null
                : { duration: 200, easing: "ease" }
            }
          >
            {activeLead && (
              <LeadCardInner
                lead={activeLead}
                dragging={true}
                onSelect={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── Mobile accordion list ─────────────────────────────────────── */}
      <div className="md:hidden space-y-2">
        {visibleColumns.map((col) => (
          <MobileStageSection
            key={col.stage}
            config={col}
            leads={grouped[col.stage]}
            loading={loading}
            onSelect={(lead) => setSelectedLeadId(lead.id)}
            onStageChange={handleMobileStageChange}
          />
        ))}
      </div>

      {/* ── Close reason dialog ──────────────────────────────────────── */}
      <CloseReasonDialog
        open={pendingMove !== null}
        onConfirm={(reason) => {
          if (!pendingMove) return;
          moveLead(pendingMove.lead, pendingMove.targetStage, reason);
          setPendingMove(null);
        }}
        onCancel={() => setPendingMove(null)}
      />

      {/* ── Lead detail drawer ───────────────────────────────────────── */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={(updated) =>
          setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
        }
        onLeadDeleted={(id) =>
          setLeads((prev) => prev.filter((l) => l.id !== id))
        }
      />

      {/* ── Toasts ──────────────────────────────────────────────────── */}
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          onOpenChange={(open) => { if (!open) removeToast(t.id); }}
        >
          <ToastTitle>{t.message}</ToastTitle>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
