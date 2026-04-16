"use client";

import { useEffect, useRef, useState } from "react";

// Cal.com calLink expects "username/event-slug" — strip full URL prefix if present
const RAW_LINK = process.env.NEXT_PUBLIC_CALCOM_LINK ?? "";
const CAL_LINK = RAW_LINK.replace(/^https?:\/\/(?:app\.)?cal\.com\//, "");

export function CalcomEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [errored, setErrored] = useState(!CAL_LINK);

  useEffect(() => {
    if (!CAL_LINK) return;

    // Inject the official Cal.com embed snippet
    (function (C: Window & typeof globalThis, A: string, L: string) {
      type CalFn = ((...args: unknown[]) => void) & {
        loaded?: boolean;
        ns?: Record<string, unknown>;
        q?: unknown[][];
      };
      const p = (a: CalFn, ar: IArguments | unknown[]) => { a.q = a.q || []; a.q.push(ar); };
      const d = C.document;
      const cal: CalFn = (C as unknown as Record<string, CalFn>).Cal ||
        function (...args: unknown[]) {
          const ar = args;
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            const s = d.createElement("script");
            s.src = A;
            s.onerror = () => setErrored(true);
            d.head.appendChild(s);
            cal.loaded = true;
          }
          if (ar[0] === L) {
            const api: CalFn = (...a: unknown[]) => p(api, a);
            const namespace = ar[1] as string | undefined;
            api.q = [];
            if (typeof namespace === "string") {
              cal.ns![namespace] = api;
              p(api, ar);
            } else {
              p(cal, ar);
            }
            return;
          }
          p(cal, ar);
        };
      (C as unknown as Record<string, CalFn>).Cal = cal;
    })(window, "https://app.cal.com/embed/embed.js", "init");

    const Cal = (window as unknown as Record<string, (...args: unknown[]) => void>).Cal;
    Cal("init", { origin: "https://cal.com" });
    Cal("inline", {
      elementOrSelector: "#calcom-inline",
      calLink: CAL_LINK,
      layout: "month_view",
    });
    Cal("ui", { hideEventTypeDetails: false, layout: "month_view" });

    // Cal.com fires a resize message when the widget is ready
    const onMessage = (e: MessageEvent) => {
      if (
        typeof e.data === "object" &&
        e.data !== null &&
        "type" in e.data &&
        (e.data.type === "cal:resize" || e.data.type === "__iFrameReady")
      ) {
        setReady(true);
      }
    };
    window.addEventListener("message", onMessage);
    // Fallback: show after 3s even if no resize message received
    const fallback = setTimeout(() => setReady(true), 3000);

    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(fallback);
    };
  }, []);

  return (
    <section id="booking" aria-labelledby="booking-heading" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-[700px] px-4 sm:px-6">
        <h2
          id="booking-heading"
          className="mb-10 text-center text-3xl font-semibold text-slate-900"
        >
          Book a Discovery Call
        </h2>

        {!ready && !errored && (
          <div
            className="h-[500px] w-full animate-pulse rounded-lg bg-slate-100"
            aria-label="Loading booking widget…"
          />
        )}

        <div
          id="calcom-inline"
          ref={containerRef}
          className={ready && !errored ? "w-full" : "hidden"}
        />

        {errored && (
          <div className="rounded-lg bg-white px-6 py-8 text-center">
            <p className="text-base text-slate-700">
              Booking is temporarily unavailable. Please use the{" "}
              <a href="#contact" className="font-medium text-teal-600 underline">
                contact form
              </a>{" "}
              above to reach us.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
