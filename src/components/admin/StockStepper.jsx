// src/components/admin/StockStepper.jsx
// Ubah stok langsung dari daftar produk: tombol −/+ atau ketik angka, lalu Simpan.
import { useEffect, useState } from "react";
import { Check, Loader2, Minus, Plus } from "lucide-react";

export default function StockStepper({ product, onSave }) {
  const [value, setValue] = useState(String(product.stock));
  const [saving, setSaving] = useState(false);

  // Sinkron bila data produk di-refresh dari server
  useEffect(() => { setValue(String(product.stock)); }, [product.stock]);

  const num = Number(value);
  const valid = value !== "" && Number.isInteger(num) && num >= 0;
  const dirty = valid && num !== product.stock;

  async function save() {
    if (!dirty) return;
    setSaving(true);
    const ok = await onSave(product, num);
    setSaving(false);
    if (!ok) setValue(String(product.stock));
  }

  const btn = "flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-40";

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={btn}
        onClick={() => setValue(String(Math.max(0, (valid ? num : product.stock) - 1)))}
        disabled={saving || (valid && num <= 0)}
        aria-label={`Kurangi stok ${product.name}`}
      >
        <Minus size={14} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); }}
        aria-label={`Stok ${product.name}`}
        className={`h-10 w-16 rounded-lg border px-2 text-center text-sm font-semibold ${
          !valid ? "border-danger bg-red-50" : dirty ? "border-primary" : "border-neutral-200"
        }`}
      />
      <button
        type="button"
        className={btn}
        onClick={() => setValue(String((valid ? num : product.stock) + 1))}
        disabled={saving}
        aria-label={`Tambah stok ${product.name}`}
      >
        <Plus size={14} />
      </button>
      {dirty && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          aria-label={`Simpan stok ${product.name}`}
          className="flex h-10 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Simpan
        </button>
      )}
    </div>
  );
}
