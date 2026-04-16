"use client";

import { useEffect, useState, useRef } from "react";

const CALCOM_LINK = process.env.NEXT_PUBLIC_CALCOM_LINK || "";
const LOAD_TIMEOUT = 5000;

export function CalcomEmbed() {
  const [state, setState] = useState<"loading" | "ready" | "error">(
    CALCOM_LINK ? "loading" : "error"
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CALCOM_LINK) return;

    const timer = setTimeout(() => {
      setState((s) => (s === "loading" ? "error" : s));
    }, LOAD_TIMEOUT);

    let script: HTMLScriptElement | null = null;

    try {
      // Load Cal.com embed script
      script = document.createElement("script");
      script.src = "https://app.cal.com/embed/embed.js";
      script.async = true;
      script.onload = () => {
        clearTimeout(timer);
        try {
          // @ts-expect-error Cal is injected globally by the embed script
          if (typeof window.Cal === "function") {
            // @ts-expect-error Cal is injected globally
            window.Cal("init", { origin: "https://app.cal.com" });
            // @ts-expect-error Cal is injected globally
            window.Cal("inline", {
              calLink: CALCOM_LINK,
              elementOrSelector: "#calcom-inline",
              config: { layout: "month_view" },
            });
            setState("ready");
          } else {
            setState("error");
          }
        } catch {
          setState("error");
        }
      };
      script.onerror = () => {
        clearTimeout(timer);
        setState("error");
      };
      document.head.appendChild(script);
    } catch {
      clearTimeout(timer);
      setState("error");
    }

    return () => {
      clearTimeout(timer);
      if (script && document.head.contains(script)) {
        document.head.removeChild(script);
      }
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

        {/* Loading skeleton */}
        {state === "loading" && (
          <div
            className="mx-auto h-[500px] w-full max-w-[600px] animate-pulse rounded-lg bg-slate-100"
            aria-label="Loading booking widget…"
          />
        )}

        {/* Cal.com inline target */}
        <div
          id="calcom-inline"
          ref={containerRef}
          className={state === "ready" ? "min-h-[500px] w-full" : "hidden"}
        />

        {/* Error fallback */}
        {state === "error" && (
          <div className="mx-auto max-w-[600px] rounded-lg bg-slate-50 px-6 py-8 text-center">
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
