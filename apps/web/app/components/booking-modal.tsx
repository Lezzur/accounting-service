"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@numera/ui";

const CAL_LINK = (process.env.NEXT_PUBLIC_CALCOM_LINK ?? "").replace(
  /^https?:\/\/(?:app\.)?cal\.com\//,
  ""
);

export const BOOKING_EVENT = "open-booking-modal";

export function openBookingModal() {
  window.dispatchEvent(new CustomEvent(BOOKING_EVENT));
}

let calInitialized = false;

function initCal(onError: () => void) {
  if (calInitialized) return;
  calInitialized = true;

  (function (C: Window & typeof globalThis, A: string, L: string) {
    type CalFn = ((...args: unknown[]) => void) & {
      loaded?: boolean;
      ns?: Record<string, unknown>;
      q?: unknown[][];
    };
    const p = (a: CalFn, ar: unknown[]) => { a.q = a.q || []; a.q.push(ar); };
    const d = C.document;
    const existing = (C as unknown as Record<string, CalFn>).Cal;
    const cal: CalFn = existing || function (...args: unknown[]) {
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = [];
        const s = d.createElement("script");
        s.src = A;
        s.onerror = onError;
        d.head.appendChild(s);
        cal.loaded = true;
      }
      if (args[0] === L) {
        const api: CalFn = (...a: unknown[]) => p(api, a);
        const ns = args[1] as string | undefined;
        api.q = [];
        if (typeof ns === "string") { cal.ns![ns] = api; p(api, args); }
        else { p(cal, args); }
        return;
      }
      p(cal, args);
    };
    (C as unknown as Record<string, CalFn>).Cal = cal;
  })(window, "https://app.cal.com/embed/embed.js", "init");

  const Cal = (window as unknown as Record<string, (...args: unknown[]) => void>).Cal;
  Cal("init", { origin: "https://cal.com" });
  Cal("inline", {
    elementOrSelector: "#calcom-modal-inline",
    calLink: CAL_LINK,
    layout: "month_view",
  });
  Cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
}

export function BookingModal() {
  const [open, setOpen] = useState(false);
  const [calReady, setCalReady] = useState(false);
  const [calError, setCalError] = useState(!CAL_LINK);
  const initialized = useRef(false);

  // Listen for the global trigger event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(BOOKING_EVENT, handler);
    return () => window.removeEventListener(BOOKING_EVENT, handler);
  }, []);

  // Init Cal.com once when modal first opens
  useEffect(() => {
    if (!open || initialized.current || !CAL_LINK) return;
    initialized.current = true;
    initCal(() => setCalError(true));

    // Show widget after resize message or 3s fallback
    const onMessage = (e: MessageEvent) => {
      if (
        typeof e.data === "object" &&
        e.data !== null &&
        "type" in e.data &&
        (e.data.type === "cal:resize" || e.data.type === "__iFrameReady")
      ) {
        setCalReady(true);
      }
    };
    window.addEventListener("message", onMessage);
    const fallback = setTimeout(() => setCalReady(true), 3000);

    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(fallback);
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[760px] w-full p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
          <DialogTitle className="text-xl font-semibold text-slate-900">
            Book a Discovery Call
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 overflow-y-auto flex-1">
          {!calReady && !calError && (
            <div
              className="h-[560px] w-full animate-pulse rounded-lg bg-slate-100"
              aria-label="Loading booking widget…"
            />
          )}

          {!calError && (
            <div
              id="calcom-modal-inline"
              className={calReady ? "w-full" : "hidden"}
            />
          )}

          {calError && (
            <div className="flex h-40 items-center justify-center rounded-lg bg-slate-50">
              <p className="text-sm text-slate-700">
                Booking is temporarily unavailable. Please{" "}
                <a
                  href="#contact"
                  onClick={() => setOpen(false)}
                  className="font-medium text-teal-600 underline"
                >
                  send us a message
                </a>{" "}
                instead.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
