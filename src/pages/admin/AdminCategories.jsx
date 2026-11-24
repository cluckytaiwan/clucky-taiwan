// src/pages/admin/AdminCategories.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Pencil, Trash2, Plus, X } from "lucide-react";

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setLoading(true);
    const { data } = await supabase
      .from("kategori")
      .select("id, nama_kategori, created_at, produk(id)")
      .order("created_at", { ascending: true });
    setCategories(data || []);
    setLoading(false);
  }

  function openCreate() {
    setName("");
    setEditingId(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(category) {
    setName(category.nama_kategori);
    setEditingId(category.id);
    setShowForm(true);
    setError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Nama kategori wajib diisi");

    setSaving(true);
    const payload = { nama_kategori: name.trim() };

    // Cek duplikasi jika nama berubah
    const existing = categories.find((c) => c.nama_kategori.toLowerCase() === name.trim().toLowerCase());
    if (existing && existing.id !== editingId) {
      setSaving(false);
      return setError("Kategori dengan nama ini sudah ada!");
    }

    // Rename destructured error agar tidak menimpa (shadow) state error dari useState
    const { error: saveError } = editingId
      ? await supabase.from("kategori").update(payload).eq("id", editingId)
      : await supabase.from("kategori").insert(payload);

    setSaving(false);

    if (saveError) {
      setError("Gagal menyimpan: " + saveError.message);
      return;
    }

    setShowForm(false);
    fetchCategories();
  }

  async function handleDelete(id) {
    const { error: deleteError } = await supabase.from("kategori").delete().eq("id", id);
    if (deleteError) {
      setError("Gagal menghapus: " + deleteError.message);
    } else {
      fetchCategories();
    }
    setConfirmDelete(null);
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-neutral-900">Kelola Kategori</h1>
          <p className="text-neutral-500 text-sm mt-1">Mengatur pengelompokan menu makanan dan minuman.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Tambah Kategori
        </button>
      </div>

      {error && (
        <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg p-3 mb-4">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-surface rounded-xl border border-neutral-200">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500 bg-neutral-50">
                <th className="p-4 font-semibold">Nama Kategori</th>
                <th className="p-4 font-semibold">Jumlah Produk</th>
                <th className="p-4 font-semibold w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-neutral-500">Belum ada data kategori.</td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50/50 transition-colors">
                    <td className="p-4 font-medium text-neutral-900">{c.nama_kategori}</td>
                    <td className="p-4 text-neutral-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {c.produk?.length || 0} produk
                      </span>
                    </td>
                    <td className="p-4 flex gap-3">
                      <button onClick={() => openEdit(c)} className="text-blue-500 hover:text-blue-600 transition-colors" title="Edit">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => setConfirmDelete({ id: c.id, name: c.nama_kategori })} className="text-danger hover:text-red-700 transition-colors" title="Hapus">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSave}
            className="bg-surface rounded-2xl p-6 w-full max-w-sm shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg font-display text-neutral-900">
                {editingId ? "Edit Kategori" : "Tambah Kategori"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nama Kategori</label>
              <input
                autoFocus
                placeholder="Misal: Ayam Goreng"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-neutral-300 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-neutral-900 outline-none transition-all"
              />
            </div>

            {error && <p className="text-sm text-danger mb-4 bg-red-50 p-2 rounded">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? "Menyimpan..." : "Simpan Kategori"}
            </button>
          </form>
        </div>
      )}

      {/* Custom Confirm Dialog Hapus */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-danger" />
            </div>
            <h3 className="font-bold text-lg text-neutral-900 text-center mb-2">Hapus Kategori?</h3>
            <p className="text-sm text-neutral-500 text-center mb-1">
              Yakin hapus <span className="font-semibold text-neutral-800">{confirmDelete.name}</span>?
            </p>
            <p className="text-xs text-amber-600 text-center mb-5">
              Produk yang menggunakan kategori ini akan menjadi tanpa kategori.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-neutral-200 rounded-xl py-2.5 font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                className="flex-1 bg-danger hover:bg-red-700 text-white rounded-xl py-2.5 font-semibold transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
