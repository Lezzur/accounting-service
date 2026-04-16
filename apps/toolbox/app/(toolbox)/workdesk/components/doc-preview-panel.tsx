"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, Download } from "lucide-react";
import { cn } from "@numera/ui";
import { createBrowserClient } from "@numera/db";

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelState = "loading" | "loaded" | "error" | "unsupported";

type AttachmentData = {
  id: string;
  storage_path: string;
  mime_type: string;
  original_filename: string;
};

type EmailMeta = {
  sender_email: string;
  subject: string;
  received_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function isPdf(mimeType: string) {
  return mimeType === "application/pdf";
}

function isImage(mimeType: string) {
  return SUPPORTED_IMAGE_TYPES.has(mimeType);
}

function formatReceivedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PreviewSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex-1 mx-4 mb-4 mt-2 animate-pulse rounded-md bg-slate-100"
    />
  );
}

// ─── Email metadata block ─────────────────────────────────────────────────────

function EmailMetaBlock({ meta }: { meta: EmailMeta }) {
  return (
    <div className="shrink-0 border-b border-slate-100 px-4 py-3 space-y-1">
      <p className="text-sm text-slate-700 truncate" title={meta.sender_email}>
        <span className="mr-1.5 text-slate-400">From</span>
        {meta.sender_email}
      </p>
      <p className="text-sm text-slate-700 truncate" title={meta.subject}>
        <span className="mr-1.5 text-slate-400">Subject</span>
        {meta.subject}
      </p>
      <p className="text-sm text-slate-700">
        <span className="mr-1.5 text-slate-400">Received</span>
        {formatReceivedDate(meta.received_at)}
      </p>
    </div>
  );
}

// ─── PDF page navigation ──────────────────────────────────────────────────────

function PageNav({
  page,
  onPrev,
  onNext,
}: {
  page: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-slate-100 px-4 py-2.5">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="text-sm text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
        aria-label="Previous page"
      >
        Previous
      </button>
      <span className="text-sm text-slate-500">Page {page}</span>
      <button
        type="button"
        onClick={onNext}
        className="text-sm text-slate-600 transition-colors hover:text-slate-900"
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
}

// ─── Panel inner content ──────────────────────────────────────────────────────

function PanelInner({
  panelState,
  emailMeta,
  attachment,
  signedUrl,
  page,
  onPageChange,
  onClose,
  isMobile,
}: {
  panelState: PanelState;
  emailMeta: EmailMeta | null;
  attachment: AttachmentData | null;
  signedUrl: string | null;
  page: number;
  onPageChange: (page: number) => void;
  onClose: () => void;
  isMobile: boolean;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
        {isMobile ? (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Back
          </button>
        ) : (
          <>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Document Preview
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close document preview"
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>

      {/* Email metadata */}
      {emailMeta && <EmailMetaBlock meta={emailMeta} />}

      {/* Document area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {panelState === "loading" && (
          <>
            {/* Metadata skeleton when email hasn't loaded yet */}
            {!emailMeta && (
              <div
                aria-hidden="true"
                className="shrink-0 space-y-2 border-b border-slate-100 px-4 py-3 animate-pulse"
              >
                <div className="h-3.5 w-48 rounded bg-slate-200" />
                <div className="h-3.5 w-64 rounded bg-slate-200" />
                <div className="h-3.5 w-32 rounded bg-slate-200" />
              </div>
            )}
            <PreviewSkeleton />
          </>
        )}

        {panelState === "error" && (
          <div className="flex flex-1 items-center justify-center px-6 py-8 text-center">
            <p className="text-sm text-slate-500">
              Document preview unavailable. The original file may no longer be
              accessible.
            </p>
          </div>
        )}

        {panelState === "unsupported" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <p className="text-sm text-slate-500">
              Preview not available for this file type.
            </p>
            {signedUrl && attachment && (
              <a
                href={signedUrl}
                download={attachment.original_filename}
                className="inline-flex items-center gap-1.5 text-sm text-teal-600 underline underline-offset-2 hover:text-teal-700"
              >
                <Download size={14} aria-hidden="true" />
                Download file
              </a>
            )}
          </div>
        )}

        {panelState === "loaded" && signedUrl && attachment && (
          <>
            {isImage(attachment.mime_type) ? (
              <div className="flex-1 overflow-auto p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signedUrl}
                  alt={attachment.original_filename}
                  className="h-auto w-full object-contain"
                />
              </div>
            ) : (
              <>
                <iframe
                  src={`${signedUrl}#page=${page}`}
                  title={attachment.original_filename}
                  className="min-h-0 w-full flex-1 border-0"
                  aria-label={`PDF: ${attachment.original_filename}`}
                />
                <PageNav
                  page={page}
                  onPrev={() => onPageChange(Math.max(1, page - 1))}
                  onNext={() => onPageChange(page + 1)}
                />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type DocPreviewPanelProps = {
  open: boolean;
  notificationId: string | null;
  onClose: () => void;
};

export function DocPreviewPanel({
  open,
  notificationId,
  onClose,
}: DocPreviewPanelProps) {
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(
    null,
  );
  if (supabaseRef.current === null) {
    supabaseRef.current = createBrowserClient();
  }
  const supabase = supabaseRef.current;

  // ── Animation state ──
  const [rendered, setRendered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Document state ──
  const [panelState, setPanelState] = useState<PanelState>("loading");
  const [emailMeta, setEmailMeta] = useState<EmailMeta | null>(null);
  const [attachment, setAttachment] = useState<AttachmentData | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // ── Open/close animation ──
  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setIsClosing(false);
      setRendered(true);
      // Two rAFs: first lets React commit rendered=true, second triggers the CSS transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
    } else {
      setIsClosing(true);
      setIsOpen(false);
      closeTimerRef.current = setTimeout(() => {
        setRendered(false);
        setIsClosing(false);
        setPanelState("loading");
        setEmailMeta(null);
        setAttachment(null);
        setSignedUrl(null);
        setPage(1);
      }, 310);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [open]);

  // ── Fetch document data ──
  useEffect(() => {
    if (!open || !notificationId) return;

    setPanelState("loading");
    setEmailMeta(null);
    setAttachment(null);
    setSignedUrl(null);
    setPage(1);

    let cancelled = false;

    async function fetchData() {
      // Fetch email notification metadata
      const { data: notif, error: notifError } = await supabase
        .from("email_notifications")
        .select("sender_email, subject, received_at")
        .eq("id", notificationId)
        .single();

      if (cancelled) return;

      if (notifError || !notif) {
        setPanelState("error");
        return;
      }

      setEmailMeta(notif as EmailMeta);

      // Fetch first attachment for this notification
      const { data: attachments, error: attachError } = await supabase
        .from("document_attachments")
        .select("id, original_filename, storage_path, mime_type")
        .eq("email_notification_id", notificationId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (cancelled) return;

      if (attachError || !attachments || attachments.length === 0) {
        setPanelState("error");
        return;
      }

      const att = attachments[0] as AttachmentData;
      setAttachment(att);

      if (!isPdf(att.mime_type) && !isImage(att.mime_type)) {
        setPanelState("unsupported");
        return;
      }

      // Get signed URL from storage
      const { data: urlData, error: urlError } = await supabase.storage
        .from("documents")
        .createSignedUrl(att.storage_path, 3600);

      if (cancelled) return;

      if (urlError || !urlData?.signedUrl) {
        setPanelState("error");
        return;
      }

      setSignedUrl(urlData.signedUrl);
      setPanelState("loaded");
    }

    fetchData().catch(() => {
      if (!cancelled) setPanelState("error");
    });

    return () => {
      cancelled = true;
    };
  }, [open, notificationId, supabase]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!rendered) return null;

  const transitionClass = cn(
    "transition-transform duration-300",
    isClosing ? "ease-in" : "ease-out",
    isOpen ? "translate-x-0" : "translate-x-full",
  );

  const innerProps = {
    panelState,
    emailMeta,
    attachment,
    signedUrl,
    page,
    onPageChange: setPage,
    onClose: handleClose,
  };

  return (
    <>
      {/* Mobile/tablet backdrop (<1280px) */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 xl:hidden",
          "transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Mobile/tablet: full-screen overlay (<1280px) */}
      <aside
        aria-label="Document preview"
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-white xl:hidden",
          transitionClass,
        )}
      >
        <PanelInner {...innerProps} isMobile={true} />
      </aside>

      {/* Desktop: 400px right-side panel (≥1280px) */}
      {/*
        Width-based animation: the container shrinks to 0 when closed so the
        grid expands smoothly. The inner aside is always 400px wide; the
        container clips it with overflow-hidden.
      */}
      <div
        className={cn(
          "hidden xl:flex xl:shrink-0 xl:h-full xl:overflow-hidden",
          "xl:transition-[width] xl:duration-300",
          isClosing ? "xl:ease-in" : "xl:ease-out",
          isOpen ? "xl:w-[400px]" : "xl:w-0",
        )}
        aria-hidden={!isOpen}
      >
        <aside
          aria-label="Document preview"
          className="flex h-full w-[400px] shrink-0 flex-col border-l border-slate-200 bg-white shadow-lg"
        >
          <PanelInner {...innerProps} isMobile={false} />
        </aside>
      </div>
    </>
  );
}
