// src/hooks/useDialogFocus.js
//
// Perilaku fokus untuk modal buatan sendiri (WCAG 2.4.3, 2.1.2):
//  - saat dibuka, fokus pindah ke dalam modal (input pertama, atau tombol pertama)
//  - Tab / Shift+Tab berputar di dalam modal, tidak "bocor" ke halaman di belakang
//  - Esc memanggil onClose (bila diberikan)
//  - saat ditutup, fokus kembali ke elemen yang membukanya
//
// Pakai: const ref = useDialogFocus(open, onClose);
//        <div ref={ref} role="dialog" aria-modal="true" aria-label="…" tabIndex={-1}>
import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(open, onClose) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const panel = ref.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement;
    const focusables = () =>
      [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);

    const initial =
      panel.querySelector("[data-autofocus]") ??
      panel.querySelector("input:not([type=hidden]):not([type=file]), select, textarea") ??
      focusables()[0] ??
      panel;
    initial.focus({ preventScroll: true });

    function onKeyDown(e) {
      if (e.key === "Escape" && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !panel.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open]);

  return ref;
}
