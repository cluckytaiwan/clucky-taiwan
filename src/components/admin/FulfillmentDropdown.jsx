// src/components/admin/FulfillmentDropdown.jsx
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Check } from "lucide-react";

const FULFILLMENT = [
  { key: "diproses", label: "Diproses" },
  { key: "dikirim",  label: "Siap Diambil"  },
  { key: "selesai",  label: "Selesai"  },
];

export default function FulfillmentDropdown({ order, onUpdate, loadingId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isLoading = loadingId === order.id;
  const current = FULFILLMENT.find((f) => f.key === order.status_pesanan);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      {/* Pill trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isLoading}
        className="flex items-center gap-2 w-full px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm transition-all text-sm font-medium text-neutral-800 disabled:opacity-60"
      >
        {isLoading
          ? <Loader2 size={13} className="animate-spin text-neutral-400" />
          : <span className="flex-1 text-left">{current?.label ?? "—"}</span>
        }
        <ChevronDown size={14} className={`text-neutral-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown popup */}
      {open && (
        <div className="absolute z-30 top-full mt-1.5 left-0 min-w-[140px] bg-white border border-neutral-200 rounded-xl shadow-lg py-1 overflow-hidden">
          {FULFILLMENT.map(({ key, label }) => {
            const isSelected = order.status_pesanan === key;
            return (
              <button
                key={key}
                onClick={() => {
                  onUpdate(order.id, key);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                  isSelected
                    ? "bg-neutral-900 text-white font-semibold"
                    : "text-neutral-700 hover:bg-neutral-50 font-medium"
                }`}
              >
                {label}
                {isSelected && <Check size={13} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
