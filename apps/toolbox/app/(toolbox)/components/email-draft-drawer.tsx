"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  Button,
  Input,
  cn,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastClose,
} from "@numera/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateType =
  | "document_request"
  | "deadline_reminder"
  | "report_delivery"
  | "custom";

type Phase = "idle" | "generating" | "generated" | "sending";

type ToastItem = {
  id: string;
  message: string;
  variant: "error" | "success";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMPLATES: { value: TemplateType; label: string }[] = [
  { value: "document_request", label: "Document Request" },
  { value: "deadline_reminder", label: "Deadline Reminder" },
  { value: "report_delivery", label: "Report Delivery" },
  { value: "custom", label: "Custom" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EmailDraftDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientId: string;
  clientEmail: string;
  gmailConnected: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmailDraftDrawer({
  open,
  onOpenChange,
  clientName,
  clientId,
  clientEmail,
  gmailConnected,
}: EmailDraftDrawerProps) {
  const [template, setTemplate] = useState<TemplateType>("document_request");
  const [customIntent, setCustomIntent] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      setTemplate("document_request");
      setCustomIntent("");
      setSubject("");
      setBody("");
      setPhase("idle");
    }
  }, [open]);

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

  const handleGenerate = async () => {
    if (!supabase) return;
    setPhase("generating");
    setSubject("");
    setBody("");

    try {
      const { data, error } = await supabase.functions.invoke("draft-email", {
        body: {
          clientId,
          clientName,
          template,
          ...(template === "custom" && { customIntent }),
        },
      });

      if (error) throw error;

      setSubject(data?.subject ?? "");
      setBody(data?.body ?? "");
      setPhase("generated");
    } catch {
      pushToast(
        "Draft generation failed. Write your email manually.",
        "error",
      );
      // Manual fallback: show blank draft area
      setPhase("generated");
    }
  };

  const handleSend = async () => {
    if (!supabase || !gmailConnected) return;
    setPhase("sending");

    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: { clientId, to: clientEmail, subject, body },
      });

      if (error) throw error;

      pushToast("Email sent.", "success");
      onOpenChange(false);
    } catch {
      pushToast("Failed to send email. Please try again.", "error");
      setPhase("generated");
    }
  };

  const canGenerate =
    template !== "custom" || customIntent.trim().length > 0;

  const hasDraft = phase === "generated" || phase === "sending";

  const textareaClass = cn(
    "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
    "placeholder:text-slate-500 resize-none",
    "focus:outline-none focus:border-2 focus:border-teal-600 transition-[border-color,border-width] duration-[100ms]",
  );

  return (
    <ToastProvider swipeDirection="right">
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          {/* Header */}
          <DrawerHeader
            className={cn(
              "flex-row items-center justify-between",
              "border-b border-slate-100 pb-4",
            )}
          >
            <DrawerTitle className="text-lg font-semibold">
              Draft Email — {clientName}
            </DrawerTitle>
            <DrawerClose asChild>
              <button
                aria-label="Close drawer"
                className="rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </DrawerHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Gmail disconnected banner */}
            {!gmailConnected && (
              <div className="rounded-md bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">
                  Gmail connection is not active. Reconnect Gmail in Settings.
                </p>
              </div>
            )}

            {/* Template selector — segmented control */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Template
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTemplate(value)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors duration-[100ms]",
                      template === value
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-teal-400 hover:text-teal-700",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom intent — only when Custom selected */}
            {template === "custom" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Intent
                </label>
                <textarea
                  value={customIntent}
                  onChange={(e) => setCustomIntent(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Describe what you want to say…"
                  className={textareaClass}
                />
                <p className="text-xs text-slate-400 text-right">
                  {customIntent.length}/500
                </p>
              </div>
            )}

            {/* Generate button — idle state */}
            {phase === "idle" && (
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full"
              >
                Generate Draft
              </Button>
            )}

            {/* Generating state */}
            {phase === "generating" && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <Spinner />
                Generating email draft…
              </div>
            )}

            {/* Draft area — shown after generation */}
            {hasDraft && (
              <div className="space-y-4">
                {/* Re-generate button above draft */}
                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate || phase === "sending"}
                  className="w-full"
                >
                  Generate Draft
                </Button>

                {/* Subject */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Subject
                  </label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject…"
                    disabled={phase === "sending"}
                  />
                </div>

                {/* Body */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Body
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    placeholder="Email body…"
                    disabled={phase === "sending"}
                    className={cn(textareaClass, "font-[ui-monospace,monospace]")}
                  />
                  <p className="text-xs text-slate-400">
                    {wordCount(body)}{" "}
                    {wordCount(body) === 1 ? "word" : "words"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action bar — only when draft exists */}
          {hasDraft && (
            <div className="border-t border-slate-100 px-6 py-4 flex items-center gap-3">
              {/* Send via Gmail */}
              <Button
                onClick={handleSend}
                disabled={
                  !gmailConnected ||
                  phase === "sending" ||
                  !subject.trim() ||
                  !body.trim()
                }
                className="flex-1"
              >
                {phase === "sending" ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Sending…
                  </span>
                ) : (
                  "Send via Gmail"
                )}
              </Button>

              {/* Copy to Clipboard */}
              <Button
                variant="outline"
                disabled={phase === "sending"}
                onClick={() => {
                  const text = `Subject: ${subject}\n\n${body}`;
                  navigator.clipboard.writeText(text).catch(() => {});
                }}
              >
                Copy
              </Button>

              {/* Regenerate */}
              <button
                type="button"
                disabled={phase === "sending" || !canGenerate}
                onClick={handleGenerate}
                className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Regenerate
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Toasts */}
      <ToastViewport aria-live="polite" />
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.variant} open>
          <ToastTitle>{t.message}</ToastTitle>
          <ToastClose />
        </Toast>
      ))}
    </ToastProvider>
  );
}
