import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

/**
 * Returns an onKeyDown handler that triggers onClick on Enter or Space,
 * mimicking native button behavior for custom interactive elements.
 */
export function onClickKeyDown(onClick: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };
}

/**
 * Hook for dialog accessibility: Escape-to-close and focus trap.
 * Returns a ref to attach to the dialog container element.
 */
export function useDialogA11y(
  onClose: (() => void) | undefined,
  active = true
): RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Focus the dialog on mount
    const el = dialogRef.current;
    if (el) {
      const firstFocusable = el.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }

    // Escape key handler
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        e.stopPropagation();
        onClose();
      }

      // Focus trap: Tab / Shift+Tab cycling
      if (e.key === "Tab" && el) {
        const focusable = el.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, active]);

  return dialogRef;
}
