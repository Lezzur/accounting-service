import React from "react";

/**
 * SkipToContent — visually hidden anchor that appears on keyboard focus,
 * allowing keyboard users to bypass repeated navigation and jump straight
 * to the page's main content region.
 *
 * Usage:
 *   1. Render <SkipToContent /> as the very first child of <body> / root layout.
 *   2. Add id="main-content" to the <main> element (or equivalent landmark).
 *
 * Styled per spec: sr-only until focused, then absolute z-50 with white
 * background and teal-600 text.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className={[
        /* Visually hidden by default (sr-only equivalent) */
        "absolute",
        "-top-full",
        "left-0",
        "z-50",
        "overflow-hidden",
        "whitespace-nowrap",
        /* Appear on focus */
        "focus:top-0",
        "focus:p-4",
        "focus:bg-white",
        "focus:text-teal-600",
        "focus:outline-none",
        /* Focus ring via custom utility */
        "focus:ring-2",
        "focus:ring-teal-600",
        "focus:ring-offset-2",
        /* Typography */
        "text-sm",
        "font-medium",
        "underline",
      ].join(" ")}
    >
      Skip to content
    </a>
  );
}
