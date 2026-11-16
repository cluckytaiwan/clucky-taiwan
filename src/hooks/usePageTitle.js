// src/hooks/usePageTitle.js
// Judul tab per halaman (WCAG 2.4.2) — membantu pembaca layar & riwayat browser.
import { useEffect } from "react";

const SITE = "Clucky Taiwan";

export function usePageTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} – ${SITE}` : `${SITE} – Ayam Goreng Taiwan`;
    return () => { document.title = previous; };
  }, [title]);
}
