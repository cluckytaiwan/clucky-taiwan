// src/pages/admin/AdminProducts.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Pencil, Trash2, Plus, X, Settings2 } from "lucide-react";
import VariantManager from "../../components/admin/VariantManager";

const emptyForm = {
  name: "", description: "", price: "", stock: "", image_url: "", category_id: "", is_active: true,
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }
  const [managingVariantsFor, setManagingVariantsFor] = useState(null); // { id, name }

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    // Tabel & kolom Bahasa Indonesia (produk), alias ke bentuk Inggris untuk state lokal
    const { data } = await supabase
      .from("produk")
      .select("id, nama_produk, deskripsi, harga, stok, url_gambar, aktif, kategori_id, kategori(nama_kategori)")
      .order("created_at", { ascending: false });
    setProducts(
      (data || []).map((p) => ({
        id: p.id,
        name: p.nama_produk,
        description: p.deskripsi,
        price: p.harga,
        stock: p.stok,
        image_url: p.url_gambar,
        is_active: p.aktif,
        category_id: p.kategori_id,
        category_name: p.kategori?.nama_kategori ?? "-",
      })),
    );
    setLoading(false);
  }

  async function fetchCategories() {
    const { data } = await supabase.from("kategori").select("id, nama_kategori").order("nama_kategori");
    setCategories(data || []);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setImageFile(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(product) {
    setForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      stock: product.stock,
      image_url: product.image_url || "",
      category_id: product.category_id || "",
      is_active: product.is_active,
    });
    setEditingId(product.id);
    setImageFile(null);
    setShowForm(true);
    setError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) return setError("Nama produk wajib diisi");
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (isNaN(price) || price < 0) return setError("Harga tidak valid");
    if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) return setError("Stok tidak valid");
    if (!form.category_id) return setError("Kategori wajib dipilih");

    setSaving(true);

    let finalImageUrl = form.image_url.trim();

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, imageFile);
        
      if (uploadError) {
        setSaving(false);
        return setError("Gagal upload gambar: " + uploadError.message);
      }
      
      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);
        
      finalImageUrl = publicUrlData.publicUrl;
    }

    const payload = {
      nama_produk: form.name.trim(),
      deskripsi: form.description.trim(),
      harga: price,
      stok: stock,
      url_gambar: finalImageUrl,
      kategori_id: form.category_id,
      aktif: form.is_active,
    };

    const { error: saveError } = editingId
      ? await supabase.from("produk").update(payload).eq("id", editingId)
      : await supabase.from("produk").insert(payload);

    setSaving(false);

    if (saveError) {
      setError("Gagal menyimpan: " + saveError.message);
      return;
    }

    setShowForm(false);
    fetchProducts();
  }

  async function handleDelete(id) {
    const { error: deleteError } = await supabase.from("produk").delete().eq("id", id);
    if (deleteError) {
      setError("Gagal menghapus: " + deleteError.message);
    } else {
      fetchProducts();
    }
    setConfirmDelete(null);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display text-neutral-900">Kelola Produk</h1>
        <button
          onClick={openCreate}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
        >
          <Plus size={16} /> Tambah Produk
        </button>
      </div>

      {loading ? (
        <p className="text-neutral-500">Memuat...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-surface rounded-xl border border-neutral-200">
            <thead>
              <tr className="text-left border-b border-neutral-200 text-neutral-500">
                <th className="p-3">Gambar</th>
                <th className="p-3">Nama</th>
                <th className="p-3">Kategori</th>
                <th className="p-3">Harga</th>
                <th className="p-3">Stok</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-neutral-200 last:border-0">
                  <td className="p-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-12 h-12 object-cover rounded-lg border border-neutral-200" />
                    ) : (
                      <div className="w-12 h-12 bg-neutral-100 rounded-lg border border-neutral-200 flex items-center justify-center text-[10px] text-neutral-400 font-medium">Kosong</div>
                    )}
                  </td>
                  <td className="p-3 font-medium text-neutral-900">{p.name}</td>
                  <td className="p-3 text-neutral-500">{p.category_name}</td>
                  <td className="p-3">Rp{Number(p.price).toLocaleString("id-ID")}</td>
                  <td className="p-3">{p.stock}</td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        p.is_active ? "bg-green-100 text-success" : "bg-neutral-200 text-neutral-500"
                      }`}
                    >
                      {p.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setManagingVariantsFor({ id: p.id, name: p.name })}
                        title="Kelola Varian"
                        className="text-neutral-400 hover:text-primary transition-colors p-1 rounded"
                      >
                        <Settings2 size={16} />
                      </button>
                      <button onClick={() => openEdit(p)} className="text-blue-500 hover:text-blue-600 p-1 rounded">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setConfirmDelete({ id: p.id, name: p.name })} className="text-danger hover:opacity-70 p-1 rounded">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-neutral-900/40 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSave}
            className="bg-surface rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg font-display text-neutral-900">
                {editingId ? "Edit Produk" : "Tambah Produk"}
              </h2>
              <button type="button" onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>

            <input
              placeholder="Nama produk"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2"
            />
            <textarea
              placeholder="Deskripsi"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2"
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Harga"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="border border-neutral-200 rounded-lg px-3 py-2"
              />
              <input
                type="number"
                placeholder="Stok"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="border border-neutral-200 rounded-lg px-3 py-2"
              />
            </div>

            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-neutral-900"
            >
              <option value="">Pilih kategori...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nama_kategori}</option>
              ))}
            </select>

            <div className="space-y-1">
              <label className="text-sm font-medium text-neutral-700">Gambar Produk</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white"
              />
              {form.image_url && !imageFile && (
                <p className="text-xs text-neutral-500 italic">Sudah ada gambar. Unggah baru untuk mengganti.</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Produk aktif (tampil di katalog)
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-lg"
            >
              {saving ? "Menyimpan..." : "Simpan"}
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
            <h3 className="font-bold text-lg text-neutral-900 text-center mb-2">Hapus Produk?</h3>
            <p className="text-sm text-neutral-500 text-center mb-1">
              Yakin hapus <span className="font-semibold text-neutral-800">{confirmDelete.name}</span>?
            </p>
            <p className="text-xs text-amber-600 text-center mb-5">
              Produk yang pernah dipesan sebaiknya dinonaktifkan saja, bukan dihapus.
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

      {/* Modal Kelola Varian */}
      {managingVariantsFor && (
        <VariantManager
          product={managingVariantsFor}
          onClose={() => setManagingVariantsFor(null)}
        />
      )}
    </div>
  );
}
