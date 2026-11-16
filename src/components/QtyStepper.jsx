// src/components/QtyStepper.jsx
//
// Pengubah jumlah untuk layar sentuh: tombol −/+ dan hapus berukuran 44×44px
// (area ketuk minimum), dengan jarak cukup agar tidak salah tekan. Ikonnya tetap kecil.
import { Minus, Plus, Trash2 } from "lucide-react";

const BTN =
  "flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-800 " +
  "transition-colors hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-40 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function QtyStepper({ item, onChange, onRemove }) {
  const atMax = item.qty >= item.stock;
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onChange(item.cart_key, item.qty - 1)} className={BTN} aria-label={`Kurangi ${item.name}`}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <span
        aria-live="polite"
        aria-label={`Jumlah ${item.name}: ${item.qty}`}
        className="w-8 text-center font-body text-sm font-semibold tabular-nums text-neutral-900"
      >
        {item.qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(item.cart_key, item.qty + 1)}
        disabled={atMax}
        className={BTN}
        aria-label={`Tambah ${item.name}`}
        title={atMax ? "Sudah mencapai stok tersedia" : undefined}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onRemove(item.cart_key)}
        className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-danger hover:bg-red-50 active:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Hapus ${item.name} dari keranjang`}
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
