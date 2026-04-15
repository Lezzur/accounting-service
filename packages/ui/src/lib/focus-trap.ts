import { type RefObject, useEffect, useRef } from "react";

/** All standard HTML element types that can receive focus. */
const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  "details > summary",
].join(", ");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
    (el) => !el.closest("[hidden]") && !el.closest("[aria-hidden='true']"),
  );
}

interface UseFocusTrapOptions {
  /** Called when the user presses Escape inside the trap. */
  onClose?: () => void;
  /** When false, the trap is inactive (e.g. while the overlay is closing). */
  enabled?: boolean;
}

/**
 * useFocusTrap — traps keyboard focus within a container element.
 *
 * Behaviour:
 * - On mount (when enabled), moves focus to the first focusable child.
 * - Tab / Shift+Tab cycle only within the container.
 * - Escape fires `onClose`.
 * - On unmount, returns focus to the element that was active before the
 *   trap was activated (the "trigger" element).
 *
 * @param ref     React ref attached to the container element (modal, drawer…)
 * @param options Configuration options
 *
 * @example
 * function Modal({ onClose }: { onClose: () => void }) {
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, { onClose });
 *   return <div ref={ref}>…</div>;
 * }
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  { onClose, enabled = true }: UseFocusTrapOptions = {},
): void {
  /** Remember the element that had focus before the trap opened. */
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const container = ref.current;
    if (!container) return;

    /* Save the current active element so we can restore it on unmount. */
    triggerRef.current = document.activeElement;

    /* Move focus into the trap immediately. */
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      /* If nothing focusable exists, make the container itself focusable. */
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!container) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        /* Shift+Tab: wrap from first → last */
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        /* Tab: wrap from last → first */
        if (active === last || !container.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      /* Restore focus to the trigger element. */
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [enabled, onClose, ref]);
}
