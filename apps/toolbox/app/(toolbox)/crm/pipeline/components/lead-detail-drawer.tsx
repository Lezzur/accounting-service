"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
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
import { createClient } from "../../../../../lib/supabase/client";
import type { Database, LeadSource, LeadStage } from "@numera/db";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

interface ActivityEntry {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  performed_by: { full_name: string } | null;
}

interface FormState {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  source: LeadSource;
  stage: LeadStage;
  notes: string;
}

interface ToastData {
  id: string;
  message: string;
  variant: "success" | "error";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website_form: "Website Form",
  cal_booking:  "Cal.com Booking",
  referral:     "Referral",
  manual:       "Manual",
  google:       "Google",
  facebook:     "Facebook",
};

const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  lead:          "Lead",
  contacted:     "Contacted",
  call_booked:   "Call Booked",
  proposal_sent: "Proposal Sent",
  negotiation:   "Negotiation",
  closed_won:    "Closed Won",
  closed_lost:   "Closed Lost",
};

const LEAD_SOURCES: LeadSource[] = ["website_form", "cal_booking", "referral", "manual", "google", "facebook"];
const LEAD_STAGES: LeadStage[]   = [
  "lead", "contacted", "call_booked", "proposal_sent",
  "negotiation", "closed_won", "closed_lost",
];

const NOTES_WARN = 9000;
const NOTES_MAX  = 10000;
const ACTIVITY_INITIAL   = 50;
const ACTIVITY_PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToForm(row: LeadRow): FormState {
  return {
    businessName: row.business_name,
    contactName:  row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone ?? "",
    source:       row.source,
    stage:        row.stage,
    notes:        row.notes ?? "",
  };
}

function isDirty(a: FormState, b: FormState): boolean {
  return (
    a.businessName !== b.businessName ||
    a.contactName  !== b.contactName  ||
    a.contactEmail !== b.contactEmail ||
    a.contactPhone !== b.contactPhone ||
    a.source       !== b.source       ||
    a.stage        !== b.stage        ||
    a.notes        !== b.notes
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inputCls = cn(
  "w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900",
  "placeholder:text-slate-400",
  "focus:outline-none focus:border-2 focus:border-teal-600",
  "transition-[border-color,border-width] duration-100",
);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="px-6 py-5 space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-1/4 rounded bg-slate-200" />
          <div className="h-9 rounded bg-slate-200" />
        </div>
      ))}
      <div className="space-y-1.5">
        <div className="h-3 w-1/4 rounded bg-slate-200" />
        <div className="h-9 rounded bg-slate-200" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-1/4 rounded bg-slate-200" />
        <div className="h-9 rounded bg-slate-200" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-1/4 rounded bg-slate-200" />
        <div className="h-24 rounded bg-slate-200" />
      </div>
    </div>
  );
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const formatted = new Date(entry.created_at).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <li className="flex gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700">{entry.action}</p>
        {entry.performed_by && (
          <p className="text-xs text-slate-400 mt-0.5">{entry.performed_by.full_name}</p>
        )}
      </div>
      <time className="text-xs text-slate-400 whitespace-nowrap shrink-0 pt-0.5">{formatted}</time>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated?: (lead: LeadRow) => void;
  onLeadDeleted?: (leadId: string) => void;
}

export function LeadDetailDrawer({
  leadId,
  onClose,
  onLeadUpdated,
  onLeadDeleted,
}: LeadDetailDrawerProps) {
  const router = useRouter();
  const supabase = useMemo(() => {
    try { return createClient(); } catch { return null; }
  }, []);

  const open = leadId !== null;

  // ── Data ────────────────────────────────────────────────────────────────────
  const [lead, setLead]           = useState<LeadRow | null>(null);
  const [loading, setLoading]     = useState(false);
  const [loadError, setLoadError] = useState(false);

  // ── Form ────────────────────────────────────────────────────────────────────
  const emptyForm: FormState = {
    businessName: "", contactName: "", contactEmail: "",
    contactPhone: "", source: "manual", stage: "lead", notes: "",
  };
  const [form, setForm]   = useState<FormState>(emptyForm);
  const originalRef       = useRef<FormState>(emptyForm);
  const dirty             = isDirty(form, originalRef.current);

  // ── Save ────────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  // ── Activity ────────────────────────────────────────────────────────────────
  const [activity, setActivity]             = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [visibleCount, setVisibleCount]     = useState(ACTIVITY_INITIAL);

  // ── Dialogs ─────────────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false);
  const [deleting, setDeleting]                     = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [converting, setConverting]                 = useState(false);

  // ── Toasts ──────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((t: ToastData) => {
    setToasts((prev) => [...prev.filter((x) => x.id !== t.id), t]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Fetch activity ──────────────────────────────────────────────────────────
  const fetchActivity = useCallback(async (id: string) => {
    if (!supabase) return;
    setActivityLoading(true);
    try {
      // lead_activity_log is not yet in generated types — cast to bypass
      const { data, error } = await (supabase as ReturnType<typeof createClient>)
        .from("lead_activity_log" as any)
        .select("*, performed_by:users(full_name)")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setActivity((data as ActivityEntry[]) ?? []);
    } catch {
      // Silently fail — activity is non-critical
    } finally {
      setActivityLoading(false);
    }
  }, [supabase]);

  // ── Fetch lead ──────────────────────────────────────────────────────────────
  const fetchLead = useCallback(async (id: string) => {
    if (!supabase) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      setLead(data);
      const initial = rowToForm(data);
      setForm(initial);
      originalRef.current = initial;
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setForm(emptyForm);
      originalRef.current = emptyForm;
      setActivity([]);
      setLoadError(false);
      return;
    }
    setVisibleCount(ACTIVITY_INITIAL);
    fetchLead(leadId);
    fetchActivity(leadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, fetchLead, fetchActivity]);

  // ── Before unload ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dirty || !open) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, open]);

  // ── Handle close ─────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (dirty) {
      if (!window.confirm("Leave page? Unsaved changes will be lost.")) return;
    }
    onClose();
  }, [dirty, onClose]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!supabase || !lead) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .update({
          business_name: form.businessName,
          contact_name:  form.contactName,
          contact_email: form.contactEmail,
          contact_phone: form.contactPhone || null,
          source:        form.source,
          stage:         form.stage,
          notes:         form.notes || null,
        })
        .eq("id", lead.id)
        .select()
        .single();
      if (error) throw error;
      setLead(data);
      const updated = rowToForm(data);
      setForm(updated);
      originalRef.current = updated;
      fetchActivity(lead.id);
      onLeadUpdated?.(data);
      addToast({ id: `save-${Date.now()}`, message: "Lead saved.", variant: "success" });
    } catch {
      addToast({ id: `save-err-${Date.now()}`, message: "Failed to save. Please try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!supabase || !lead) return;
    setDeleting(true);
    const id = lead.id;
    try {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
      setShowDeleteConfirm(false);
      // Show toast before closing so it has a chance to render
      addToast({ id: `del-${Date.now()}`, message: "Lead deleted.", variant: "success" });
      onLeadDeleted?.(id);
      onClose();
    } catch {
      setShowDeleteConfirm(false);
      addToast({ id: `del-err-${Date.now()}`, message: "Failed to delete. Please try again.", variant: "error" });
    } finally {
      setDeleting(false);
    }
  };

  // ── Convert to Client ──────────────────────────────────────────────────────
  const handleConvert = async () => {
    if (!supabase || !lead) return;
    setConverting(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          business_name:           lead.business_name,
          business_type:           "sole_prop",
          tin:                     "",
          registered_address:      "",
          industry:                "",
          bir_registration_type:   "non_vat",
          fiscal_year_start_month: 1,
          gmail_address:           lead.contact_email,
          monthly_revenue_bracket: "below_250k",
          status:                  "active",
          converted_from_lead_id:  lead.id,
        })
        .select()
        .single();
      if (error) throw error;
      setShowConvertConfirm(false);
      onClose();
      router.push(`/crm/clients/${data.id}`);
    } catch {
      setShowConvertConfirm(false);
      addToast({ id: `conv-err-${Date.now()}`, message: "Failed to convert. Please try again.", variant: "error" });
    } finally {
      setConverting(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const notesLen       = form.notes.length;
  const visibleActivity = activity.slice(0, visibleCount);
  const hasMore        = activity.length > visibleCount;

  // ── Render ─────────────────────────────────────────────────────────────────
  //
  // The ToastProvider is always mounted (even when open=false) so toasts
  // triggered just before close (e.g. "Lead deleted.") can still render.

  return (
    <ToastProvider swipeDirection="right">
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <aside
            className={cn(
              // Mobile: full-screen bottom sheet
              "fixed inset-x-0 bottom-0 z-40 bg-white rounded-t-2xl shadow-xl",
              "h-[90dvh] flex flex-col",
              // Desktop: right side
              "lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[480px] lg:h-full",
              "lg:rounded-none lg:rounded-l-xl",
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Lead detail"
          >
            {/* Mobile drag handle */}
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-slate-200 shrink-0 lg:hidden" />

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {loading ? (
                  <div className="h-5 w-44 rounded bg-slate-200 animate-pulse" />
                ) : (
                  <h2 className="text-base font-semibold text-slate-900 truncate">
                    {lead?.business_name ?? "Lead Detail"}
                  </h2>
                )}
                {dirty && !loading && (
                  <span className="text-xs text-amber-600 font-medium shrink-0 ml-1">
                    Unsaved changes
                  </span>
                )}
              </div>
              <button
                onClick={handleClose}
                className="ml-3 rounded-md p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close drawer"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Body ────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <DrawerSkeleton />
              ) : loadError ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 px-6">
                  <p className="text-sm text-slate-500">Failed to load lead.</p>
                  <Button variant="outline" onClick={() => leadId && fetchLead(leadId)}>
                    Retry
                  </Button>
                </div>
              ) : lead ? (
                <div className="px-6 py-5 space-y-4">
                  {/* Business Name */}
                  <Field label="Business Name">
                    <input
                      type="text"
                      value={form.businessName}
                      onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))}
                      className={inputCls}
                      placeholder="Business name"
                    />
                  </Field>

                  {/* Contact Name */}
                  <Field label="Contact Name">
                    <input
                      type="text"
                      value={form.contactName}
                      onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
                      className={inputCls}
                      placeholder="Contact name"
                    />
                  </Field>

                  {/* Contact Email */}
                  <Field label="Contact Email">
                    <input
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
                      className={inputCls}
                      placeholder="email@example.com"
                    />
                  </Field>

                  {/* Phone */}
                  <Field label="Phone">
                    <input
                      type="tel"
                      value={form.contactPhone}
                      onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))}
                      className={inputCls}
                      placeholder="Optional"
                    />
                  </Field>

                  {/* Lead Source */}
                  <Field label="Lead Source">
                    <Select
                      value={form.source}
                      onValueChange={(v) => setForm((p) => ({ ...p, source: v as LeadSource }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {LEAD_SOURCE_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* Pipeline Stage */}
                  <Field label="Pipeline Stage">
                    <Select
                      value={form.stage}
                      onValueChange={(v) => setForm((p) => ({ ...p, stage: v as LeadStage }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {LEAD_STAGE_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* Notes */}
                  <Field label="Notes">
                    <textarea
                      value={form.notes}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, notes: e.target.value.slice(0, NOTES_MAX) }))
                      }
                      placeholder="Add notes…"
                      rows={5}
                      className={cn(
                        inputCls,
                        "resize-none",
                        notesLen >= NOTES_WARN && notesLen < NOTES_MAX &&
                          "border-amber-400 focus:border-amber-500",
                        notesLen >= NOTES_MAX &&
                          "border-red-400 focus:border-red-500",
                      )}
                    />
                    <div className="flex items-center justify-between mt-1">
                      {notesLen >= NOTES_WARN && (
                        <p className={cn(
                          "text-xs",
                          notesLen >= NOTES_MAX ? "text-red-500" : "text-amber-600",
                        )}>
                          {notesLen >= NOTES_MAX
                            ? "Character limit reached."
                            : `${(NOTES_MAX - notesLen).toLocaleString()} characters remaining.`}
                        </p>
                      )}
                      <p className={cn(
                        "text-xs ml-auto",
                        notesLen >= NOTES_MAX
                          ? "text-red-500"
                          : notesLen >= NOTES_WARN
                            ? "text-amber-600"
                            : "text-slate-400",
                      )}>
                        {notesLen.toLocaleString()}&nbsp;/&nbsp;{NOTES_MAX.toLocaleString()}
                      </p>
                    </div>
                  </Field>

                  {/* Read-only timestamps */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Created</p>
                      <p className="text-sm text-slate-700">
                        {new Date(lead.created_at).toLocaleDateString("en-PH", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Updated</p>
                      <p className="text-sm text-slate-700">
                        {new Date(lead.updated_at).toLocaleDateString("en-PH", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Activity log */}
                  <div className="pt-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                      Activity
                    </p>
                    {activityLoading ? (
                      <div className="space-y-2 animate-pulse">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-8 rounded bg-slate-100" />
                        ))}
                      </div>
                    ) : activity.length === 0 ? (
                      <p className="text-sm text-slate-500">No activity yet.</p>
                    ) : (
                      <>
                        <ul>
                          {visibleActivity.map((entry) => (
                            <ActivityItem key={entry.id} entry={entry} />
                          ))}
                        </ul>
                        {hasMore && (
                          <button
                            onClick={() => setVisibleCount((n) => n + ACTIVITY_PAGE_SIZE)}
                            className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium"
                          >
                            Load more
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* ── Footer ──────────────────────────────────────────────────── */}
            {!loading && !loadError && lead && (
              <div className="shrink-0 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="gap-1.5"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Saving…" : "Save"}
                </Button>

                {form.stage === "closed_won" && (
                  <Button
                    variant="outline"
                    onClick={() => setShowConvertConfirm(true)}
                  >
                    Convert to Client
                  </Button>
                )}

                <div className="flex-1" />

                <Button
                  variant="destructive-outline"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete Lead
                </Button>
              </div>
            )}
          </aside>
        </>
      )}

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <Dialog open={showDeleteConfirm} onOpenChange={(o) => !o && setShowDeleteConfirm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this lead?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 -mt-2">This cannot be undone.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={deleting}>Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Convert to Client confirmation ──────────────────────────────── */}
      <Dialog open={showConvertConfirm} onOpenChange={(o) => !o && setShowConvertConfirm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convert to Client?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 -mt-2">
            This will create a new client profile for{" "}
            <span className="font-medium text-slate-700">{lead?.business_name}</span>.
            You can complete the client details after conversion.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={converting}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleConvert} disabled={converting} className="gap-1.5">
              {converting && <Loader2 size={14} className="animate-spin" />}
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toasts ──────────────────────────────────────────────────────── */}
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          onOpenChange={(o) => { if (!o) removeToast(t.id); }}
        >
          <ToastTitle>{t.message}</ToastTitle>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
