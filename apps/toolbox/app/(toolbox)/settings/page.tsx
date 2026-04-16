"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastClose,
  cn,
} from "@numera/ui";
import { createClient } from "../../../lib/supabase/client";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GmailConnection {
  id: string;
  gmail_email: string;
  status: "active" | "token_expired" | "revoked" | "error";
  last_error: string | null;
  watch_expiration: string | null;
}

interface SettingsValues {
  category_confidence_threshold: string;
  email_classification_confidence_threshold: string;
  ai_cost_alert_threshold: string;
  ai_cost_ceiling: string;
}

const DEFAULT_SETTINGS: SettingsValues = {
  category_confidence_threshold: "0.85",
  email_classification_confidence_threshold: "0.70",
  ai_cost_alert_threshold: "25.00",
  ai_cost_ceiling: "30.00",
};

interface ToastData {
  id: string;
  message: string;
  variant: "success" | "error";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="p-6 max-w-2xl space-y-8">
      {/* Title skeleton */}
      <div className="h-7 w-24 rounded bg-slate-200 animate-pulse" />

      {/* Gmail section skeleton */}
      <section className="space-y-4">
        <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-slate-200 animate-pulse" />
            <div className="h-4 w-48 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="h-4 w-36 rounded bg-slate-200 animate-pulse" />
          <div className="h-9 w-28 rounded bg-slate-200 animate-pulse" />
        </div>
      </section>

      {/* System settings section skeleton */}
      <section className="space-y-4">
        <div className="h-5 w-36 rounded bg-slate-200 animate-pulse" />
        <div className="rounded-lg border border-slate-200 p-4 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 w-52 rounded bg-slate-200 animate-pulse" />
              <div className="h-9 w-40 rounded bg-slate-200 animate-pulse" />
            </div>
          ))}
          <div className="h-9 w-16 rounded bg-slate-200 animate-pulse" />
        </div>
      </section>
    </div>
  );
}

// ─── Gmail status indicator ───────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full flex-shrink-0",
        ok ? "bg-emerald-500" : "bg-red-500",
      )}
      aria-hidden="true"
    />
  );
}

// ─── Number field ─────────────────────────────────────────────────────────────

function NumberField({
  id,
  label,
  value,
  onChange,
  step,
  min,
  max,
  prefix,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: string;
  min?: string;
  max?: string;
  prefix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <div className="flex items-center gap-1">
        {prefix && (
          <span className="text-sm text-slate-500 select-none">{prefix}</span>
        )}
        <input
          id={id}
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-36 h-9 rounded-md border border-slate-200 bg-white px-3",
            "text-sm text-slate-900",
            "focus:outline-none focus:border-2 focus:border-teal-600",
            "transition-[border-color,border-width] duration-[100ms]",
          )}
        />
      </div>
    </div>
  );
}

// ─── Inner page (uses useSearchParams) ───────────────────────────────────────

function SettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase = useMemo(() => createClient(), []);

  // Auth / load state
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">(
    "loading",
  );

  // Gmail
  const [gmailConn, setGmailConn] = useState<GmailConnection | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // System settings
  const [settings, setSettings] = useState<SettingsValues>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // ── Toast helpers ──────────────────────────────────────────────────────────

  const addToast = useCallback((toast: ToastData) => {
    setToasts((prev) => [...prev.filter((t) => t.id !== toast.id), toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoadState("loading");
    try {
      // Check auth + admin role
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: userRow } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (userRow?.role !== "admin") {
        router.replace("/workdesk");
        return;
      }

      // Fetch gmail_connections and system_settings in parallel
      const db = supabase as any;

      const [gmailResult, settingsResult] = await Promise.all([
        db.from("gmail_connections").select("id, gmail_email, status, last_error, watch_expiration").maybeSingle(),
        db.from("system_settings").select("key, value"),
      ]);

      if (gmailResult.error || settingsResult.error) {
        throw new Error("Failed to load settings.");
      }

      setGmailConn(gmailResult.data ?? null);

      if (settingsResult.data?.length) {
        const merged: SettingsValues = { ...DEFAULT_SETTINGS };
        for (const row of settingsResult.data as Array<{
          key: string;
          value: number | string;
        }>) {
          if (row.key in merged) {
            merged[row.key as keyof SettingsValues] = String(row.value);
          }
        }
        setSettings(merged);
      }

      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [supabase, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Handle OAuth callback query params ────────────────────────────────────

  useEffect(() => {
    const gmailParam = searchParams.get("gmail");
    if (!gmailParam) return;

    // Clear the query param from the URL
    router.replace("/settings", { scroll: false });

    if (gmailParam === "connected") {
      addToast({
        id: "gmail-connected",
        message: "Gmail connected successfully.",
        variant: "success",
      });
      // Reload to refresh gmail connection
      loadData();
    } else if (gmailParam === "error") {
      const msg = searchParams.get("message") ?? "Failed to connect Gmail.";
      addToast({ id: "gmail-error", message: msg, variant: "error" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Disconnect Gmail ───────────────────────────────────────────────────────

  const handleDisconnect = useCallback(async () => {
    if (!gmailConn) return;
    setDisconnecting(true);
    try {
      const { error } = await (supabase as any)
        .from("gmail_connections")
        .delete()
        .eq("id", gmailConn.id);
      if (error) throw error;
      setGmailConn(null);
      addToast({ id: "gmail-disconnected", message: "Gmail disconnected.", variant: "success" });
    } catch {
      addToast({ id: "gmail-disconnect-error", message: "Failed to disconnect Gmail.", variant: "error" });
    } finally {
      setDisconnecting(false);
    }
  }, [gmailConn, supabase, addToast]);

  // ── Save system settings ───────────────────────────────────────────────────

  const handleSaveSettings = useCallback(async () => {
    setSaving(true);
    try {
      const db = supabase as any;
      const updates = (
        Object.entries(settings) as Array<[keyof SettingsValues, string]>
      ).map(([key, val]) => ({
        key,
        value: parseFloat(val),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await db
        .from("system_settings")
        .upsert(updates, { onConflict: "key" });

      if (error) throw error;

      addToast({ id: "settings-saved", message: "Settings saved.", variant: "success" });
    } catch {
      addToast({ id: "settings-error", message: "Failed to save. Please try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }, [supabase, settings, addToast]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadState === "loading") {
    return <SettingsSkeleton />;
  }

  if (loadState === "error") {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[320px] gap-3">
        <p className="text-sm text-slate-500">Failed to load settings.</p>
        <Button variant="outline" onClick={loadData}>
          Retry
        </Button>
      </div>
    );
  }

  const isConnected = gmailConn?.status === "active";
  const hasError =
    gmailConn !== null &&
    (gmailConn.status === "error" || gmailConn.status === "token_expired");

  return (
    <div className="p-6 max-w-2xl space-y-8">
      {/* Page title */}
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>

      {/* ── Gmail Connection ──────────────────────────────────────────────── */}
      <section aria-labelledby="gmail-section-heading" className="space-y-3">
        <h2
          id="gmail-section-heading"
          className="text-base font-semibold text-slate-800"
        >
          Gmail Connection
        </h2>

        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          {isConnected && (
            <>
              <div className="flex items-center gap-2">
                <StatusDot ok={true} />
                <span className="text-sm text-slate-700">
                  Connected as{" "}
                  <span className="font-medium">{gmailConn!.gmail_email}</span>
                </span>
              </div>
              {gmailConn!.watch_expiration && (
                <p className="text-xs text-slate-500">
                  Watch expires{" "}
                  {new Date(gmailConn!.watch_expiration).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" },
                  )}
                </p>
              )}
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 hover:border-red-400"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Disconnecting…
                  </>
                ) : (
                  "Disconnect"
                )}
              </Button>
            </>
          )}

          {hasError && (
            <>
              <div className="flex items-center gap-2">
                <StatusDot ok={false} />
                <span className="text-sm text-slate-700">
                  Gmail connection error
                  {gmailConn!.last_error ? `: ${gmailConn!.last_error}` : "."}
                </span>
              </div>
              <div className="flex gap-2">
                <a href="/api/auth/gmail/connect">
                  <Button className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white">
                    <RefreshCw className="h-4 w-4" />
                    Reconnect
                  </Button>
                </a>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </Button>
              </div>
            </>
          )}

          {!gmailConn && (
            <>
              <div className="flex items-center gap-2">
                <StatusDot ok={false} />
                <span className="text-sm text-slate-500">Not connected</span>
              </div>
              <a href="/api/auth/gmail/connect">
                <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                  Connect Gmail
                </Button>
              </a>
            </>
          )}
        </div>
      </section>

      {/* ── System Settings ───────────────────────────────────────────────── */}
      <section aria-labelledby="system-settings-heading" className="space-y-3">
        <h2
          id="system-settings-heading"
          className="text-base font-semibold text-slate-800"
        >
          System Settings
        </h2>

        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-5">
          <NumberField
            id="category_confidence_threshold"
            label="Category Confidence Threshold"
            value={settings.category_confidence_threshold}
            onChange={(v) =>
              setSettings((s) => ({ ...s, category_confidence_threshold: v }))
            }
            step="0.01"
            min="0"
            max="1"
          />

          <NumberField
            id="email_classification_confidence_threshold"
            label="Email Classification Confidence Threshold"
            value={settings.email_classification_confidence_threshold}
            onChange={(v) =>
              setSettings((s) => ({
                ...s,
                email_classification_confidence_threshold: v,
              }))
            }
            step="0.01"
            min="0"
            max="1"
          />

          <NumberField
            id="ai_cost_alert_threshold"
            label="AI Cost Alert Threshold"
            value={settings.ai_cost_alert_threshold}
            onChange={(v) =>
              setSettings((s) => ({ ...s, ai_cost_alert_threshold: v }))
            }
            step="0.01"
            min="0"
            prefix="$"
          />

          <NumberField
            id="ai_cost_ceiling"
            label="AI Cost Ceiling"
            value={settings.ai_cost_ceiling}
            onChange={(v) =>
              setSettings((s) => ({ ...s, ai_cost_ceiling: v }))
            }
            step="0.01"
            min="0"
            prefix="$"
          />

          <Button
            onClick={handleSaveSettings}
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </section>

      {/* ── Toasts ──────────────────────────────────────────────────────────── */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          onOpenChange={(open) => {
            if (!open) removeToast(toast.id);
          }}
        >
          <div className="flex items-center gap-2">
            {toast.variant === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            )}
            <ToastTitle>{toast.message}</ToastTitle>
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <ToastProvider swipeDirection="right">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsInner />
      </Suspense>
    </ToastProvider>
  );
}
