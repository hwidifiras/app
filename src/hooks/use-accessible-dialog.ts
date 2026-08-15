"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function isActuallyFocusable(element: HTMLElement): boolean {
  return (
    !element.closest('[inert], [aria-hidden="true"]') &&
    (element.getClientRects().length > 0 || element === document.activeElement)
  );
}

type AccessibleDialogOptions = {
  open: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  lockScroll?: boolean;
  trapFocus?: boolean;
};

/**
 * Shared modal behavior: initial focus, focus containment, Escape handling,
 * scroll locking, and focus restoration for dialogs and drawers.
 */
export function useAccessibleDialog<T extends HTMLElement>({
  open,
  onClose,
  closeOnEscape = true,
  initialFocusRef,
  lockScroll = true,
  trapFocus = true,
}: AccessibleDialogOptions) {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  const trapFocusRef = useRef(trapFocus);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeOnEscapeRef.current = closeOnEscape;
  }, [closeOnEscape]);

  useEffect(() => {
    trapFocusRef.current = trapFocus;
  }, [trapFocus]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (lockScroll) document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const preferred = initialFocusRef?.current;
      const firstFocusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).find(isActuallyFocusable);
      (preferred ?? firstFocusable ?? dialogRef.current)?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && closeOnEscapeRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !trapFocusRef.current || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(isActuallyFocusable);

      if (!focusableElements.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !dialogRef.current.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialogRef.current.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      if (lockScroll) document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [initialFocusRef, lockScroll, open]);

  return dialogRef;
}
