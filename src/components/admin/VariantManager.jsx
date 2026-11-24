// src/components/admin/VariantManager.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatRupiah } from "../../utils/formatCurrency";
import { X, Plus, Trash2, Pencil, Check, GripVertical } from "lucide-react";

const TIPE_OPTIONS = [
  { value: "ukuran", label: "Ukuran" },
  { value: "rasa",   label: "Rasa"   },
];

const emptyForm = { tipe: "ukuran", nama: "", harga_tambahan: "" };

/**
 * Modal untuk CRUD varian per produk.
 * Props:
 *   product — { id, name }
 *   onClose — callback saat modal ditutup
 */
export default function VariantManager({ product, onClose }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, nama }

  useEffect(() => {
    fetchVariants();
  }, [product.id]);

  async function fetchVariants() {
    setLoading(true);
    const { data } = await supabase
      .from("opsi_varian")
      .select("id, tipe, nama, harga_tambahan, urutan, aktif")
      .eq("produk_id", product.id)
      .order("tipe", { ascending: true })
      .order("urutan", { ascending: true });
    setVariants(data || []);
    setLoading(false);
  }

  // Grouped berdasarkan tipe untuk tampilan
  const grouped = variants.reduce((acc, v) => {
    if (!acc[v.tipe]) acc[v.tipe] = [];
    acc[v.tipe].push(v);
    return acc;
  }, {});
  const tipeOrder = ["ukuran", "rasa"];
  const tipesSorted = [...new Set([...tipeOrder, ...Object.keys(grouped)])].filter((t) => grouped[t]);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(v) {
    setForm({ tipe: v.tipe, nama: v.nama, harga_tambahan: String(v.harga_tambahan) });
    setEditingId(v.id);
    setError("");
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");

    if (!form.nama.trim()) return setError("Nama varian wajib diisi");
    const harga = Number(form.harga_tambahan);
    if (isNaN(harga) || harga < 0) return setError("Harga tambahan tidak valid (minimal 0)");

    // Cek duplikasi nama dalam tipe yang sama
    const duplicate = variants.find(
      (v) => v.tipe === form.tipe &&
             v.nama.toLowerCase() === form.nama.trim().toLowerCase() &&
             v.id !== editingId
    );
    if (duplicate) return setError(`Varian "${form.nama.trim()}" sudah ada pada tipe ${form.tipe}`);

    setSaving(true);

    const payload = {
      produk_id: product.id,
      tipe: form.tipe,
      nama: form.nama.trim(),
      harga_tambahan: harga,
      // urutan: auto (baris terakhir dari tipe ini + 1)
      urutan: editingId
        ? variants.find((v) => v.id === editingId)?.urutan ?? 0
        : Math.max(0, ...variants.filter((v) => v.tipe === form.tipe).map((v) => v.urutan)) + 1,
    };

    const { error: saveError } = editingId
      ? await supabase.from("opsi_varian").update(payload).eq("id", editingId)
      : await supabase.from("opsi_varian").insert(payload);

    setSaving(false);

    if (saveError) {
      setError("Gagal menyimpan: " + saveError.message);
      return;
    }

    setShowForm(false);
    fetchVariants();
  }

  async function handleDelete(id) {
    const { error: deleteError } = await supabase.from("opsi_varian").delete().eq("id", id);
    if (deleteError) {
      setError("Gagal menghapus: " + deleteError.message);
    } else {
      fetchVariants();
    }
    setConfirmDelete(null);
  }

  const tipeLabel = { ukuran: "Ukuran", rasa: "Rasa" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
          <div>
            <h2 className="font-bold text-lg text-neutral-900">Kelola Varian</h2>
            <p className="text-xs text-neutral-400 mt-0.5">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors text-neutral-500"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {error && (
            <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 rounded-full border-b-2 border-primary" />
            </div>
          ) : tipesSorted.length === 0 && !showForm ? (
            <div className="text-center py-8 text-neutral-400 text-sm">
              Belum ada varian. Klik "+ Tambah Varian" untuk mulai.
            </div>
          ) : (
            tipesSorted.map((tipe) => (
              <div key={tipe}>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                  {tipeLabel[tipe] ?? tipe}
                </p>
                <div className="space-y-1.5">
                  {grouped[tipe].map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-neutral-100 bg-neutral-50 hover:bg-neutral-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <GripVertical size={14} className="text-neutral-300 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-neutral-800">{v.nama}</p>
                          <p className="text-xs text-neutral-400">
                            {Number(v.harga_tambahan) > 0
                              ? `+${formatRupiah(v.harga_tambahan)}`
                              : "Tanpa biaya tambahan"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(v)}
                          className="text-blue-500 hover:text-blue-600 transition-colors p-1"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ id: v.id, nama: v.nama })}
                          className="text-danger hover:opacity-70 transition-opacity p-1"
                          title="Hapus"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Form tambah/edit varian */}
          {showForm && (
            <form
              onSubmit={handleSave}
              className="border border-primary/30 bg-primary/5 rounded-2xl p-4 space-y-3"
            >
              <p className="text-sm font-bold text-neutral-800">
                {editingId ? "Edit Varian" : "Tambah Varian Baru"}
              </p>

              {/* Pilih tipe (hanya saat tambah, tidak bisa diubah saat edit) */}
              <div className="flex gap-2">
                {TIPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!!editingId}
                    onClick={() => setForm((f) => ({ ...f, tipe: opt.value }))}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all disabled:cursor-default ${
                      form.tipe === opt.value
                        ? "border-primary bg-primary text-white"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Nama Varian *</label>
                  <input
                    autoFocus
                    placeholder='Contoh: "Large" atau "Pedas L2"'
                    value={form.nama}
                    onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
                    className="w-full border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-sm text-neutral-900 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Harga Tambahan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="0"
                    value={form.harga_tambahan}
                    onChange={(e) => setForm((f) => ({ ...f, harga_tambahan: e.target.value }))}
                    className="w-full border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-sm text-neutral-900 outline-none transition-all"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(""); }}
                  className="flex-1 border border-neutral-200 rounded-xl py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary hover:bg-primary-dark text-white rounded-xl py-2 text-sm font-semibold transition-colors disabled:opacity-70 flex items-center justify-center gap-1.5"
                >
                  {saving ? "Menyimpan..." : (
                    <><Check size={14} /> Simpan</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {!showForm && (
          <div className="px-6 py-4 border-t border-neutral-100 shrink-0">
            <button
              onClick={openCreate}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              <Plus size={16} /> Tambah Varian
            </button>
          </div>
        )}

        {/* Custom Confirm Dialog Hapus */}
        {confirmDelete && (
          <div
            className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center p-6"
            style={{ zIndex: 10 }}
          >
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl p-6 w-full max-w-xs">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Trash2 size={18} className="text-danger" />
              </div>
              <h3 className="font-bold text-base text-neutral-900 text-center mb-1">Hapus Varian?</h3>
              <p className="text-sm text-neutral-500 text-center mb-4">
                Hapus <span className="font-semibold text-neutral-800">"{confirmDelete.nama}"</span>?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 border border-neutral-200 rounded-xl py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete.id)}
                  className="flex-1 bg-danger hover:bg-red-700 text-white rounded-xl py-2 text-sm font-semibold transition-colors"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
