// src/pages/admin/AdminLowStock.jsx
// Halaman Stok Rendah — produk dengan stok 0–10 unit
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Search, X, Pencil, AlertTriangle, PackageX } from "lucide-react";
import VariantManager from "../../components/admin/VariantManager";

const emptyForm = {
  name: "", description: "", price: "", stock: "", image_url: "", category_id: "", is_active: true,
};

/* ─── Bar Stok Visual ─────────────────────────────────────── */
function StockBar({ stok }) {
  const max = 10;
  const pct = Math.min((stok / max) * 100, 100);
  const color = stok === 0 ? "bg-danger" : stok <= 5 ? "bg-orange-500" : "bg-amber-400";
  return (
    <div className="w-24 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function AdminLowStock() {
  const [products, setProducts]           = useState([]);
  const [categories, setCategories]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [searchQuery, setSearchQuery]     = useState("");
  const [filterCat, setFilterCat]         = useState("all");
  const [filterLevel, setFilterLevel]     = useState("all"); // all | habis | rendah
  const [showForm, setShowForm]           = useState(false);
  const [editingId, setEditingId]         = useState(null);
  const [form, setForm]                   = useState(emptyForm);
  const [imageFile, setImageFile]         = useState(null);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState("");
  const [managingVariantsFor, setManagingVariantsFor] = useState(null);

  /* ─── Fetch ─── */
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: prodData }, { data: catData }] = await Promise.all([
      supabase
        .from("produk")
        .select("id, nama_produk, deskripsi, harga, stok, url_gambar, aktif, kategori_id, kategori(nama_kategori)")
        .lte("stok", 10)
        .eq("aktif", true)
        .order("stok", { ascending: true }),
      supabase.from("kategori").select("id, nama_kategori").order("nama_kategori"),
    ]);

    setProducts(
      (prodData || []).map(p => ({
        id: p.id,
        name: p.nama_produk,
        description: p.deskripsi,
        price: p.harga,
        stock: p.stok,
        image_url: p.url_gambar,
        is_active: p.aktif,
        category_id: p.kategori_id,
        category_name: p.kategori?.nama_kategori ?? "-",
      }))
    );
    setCategories(catData || []);
    setLoading(false);
  }

  /* ─── Filter ─── */
  const filtered = useMemo(() => {
    let result = products;

    if (filterLevel === "habis")  result = result.filter(p => p.stock === 0);
    if (filterLevel === "rendah") result = result.filter(p => p.stock > 0 && p.stock <= 10);

    if (filterCat !== "all") result = result.filter(p => p.category_id === filterCat);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [products, filterLevel, filterCat, searchQuery]);

  const habisCount  = products.filter(p => p.stock === 0).length;
  const rendahCount = products.filter(p => p.stock > 0 && p.stock <= 10).length;

  /* ─── Edit produk ─── */
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
    if (isNaN(price) || price < 0)                        return setError("Harga tidak valid");
    if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) return setError("Stok tidak valid");
    if (!form.category_id)                                 return setError("Kategori wajib dipilih");

    setSaving(true);
    let finalImageUrl = form.image_url.trim();

    if (imageFile) {
      const fileExt  = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, imageFile);
      if (uploadError) { setSaving(false); return setError("Gagal upload gambar: " + uploadError.message); }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(fileName);
      finalImageUrl = pub.publicUrl;
    }

    const payload = {
      nama_produk: form.name.trim(),
      deskripsi:   form.description.trim(),
      harga:       price,
      stok:        stock,
      url_gambar:  finalImageUrl,
      kategori_id: form.category_id,
      aktif:       form.is_active,
    };

    const { error: saveError } = await supabase.from("produk").update(payload).eq("id", editingId);
    setSaving(false);
    if (saveError) return setError("Gagal menyimpan: " + saveError.message);

    setShowForm(false);
    fetchData();
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-neutral-900 flex items-center gap-2">
            <AlertTriangle size={22} className="text-amber-500" />
            Stok Rendah
          </h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            Produk aktif dengan stok 0–10 unit — perlu pengisian segera
          </p>
        </div>
        <button
          onClick={fetchData}
          className="text-xs font-medium text-neutral-500 hover:text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-3 py-2 rounded-xl transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Ringkasan Cepat */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <PackageX size={16} className="text-danger" />
          <div>
            <p className="font-bold text-danger text-lg leading-none">{habisCount}</p>
            <p className="text-[11px] text-red-400 mt-0.5">Habis Stok</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600" />
          <div>
            <p className="font-bold text-amber-700 text-lg leading-none">{rendahCount}</p>
            <p className="text-[11px] text-amber-500 mt-0.5">Stok Rendah (1–10)</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3">
          <div>
            <p className="font-bold text-neutral-700 text-lg leading-none">{products.length}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Total Terpengaruh</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama produk atau kategori…"
            className="w-full pl-9 pr-8 py-2.5 bg-surface border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Level Stok */}
        <div className="flex gap-1.5">
          {[
            { key: "all",    label: "Semua" },
            { key: "habis",  label: "Habis" },
            { key: "rendah", label: "Rendah (1–10)" },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setFilterLevel(opt.key)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                filterLevel === opt.key
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-surface text-neutral-500 border-neutral-200 hover:border-neutral-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Filter Kategori */}
        {categories.length > 0 && (
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-700 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">Semua Kategori</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.nama_kategori}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabel */}
      {loading ? (
        <div className="text-center py-16 text-neutral-400 text-sm">Memuat data stok…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <AlertTriangle size={32} className="mx-auto mb-3 text-neutral-200" />
          <p className="text-sm">
            {products.length === 0
              ? "Semua produk aktif memiliki stok yang cukup ✓"
              : "Tidak ada produk yang cocok dengan filter."}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-[11px] uppercase tracking-widest text-neutral-400 font-bold">
                  <th className="text-left px-5 py-3">Produk</th>
                  <th className="text-left px-5 py-3">Kategori</th>
                  <th className="text-left px-5 py-3">Harga</th>
                  <th className="text-left px-5 py-3">Stok</th>
                  <th className="text-center px-5 py-3 w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    className={`hover:bg-neutral-50/80 transition-colors align-middle ${
                      p.stock === 0 ? "bg-red-50/30" : ""
                    }`}
                  >
                    {/* Produk */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-neutral-200 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 bg-neutral-100 rounded-lg border border-neutral-200 flex items-center justify-center text-[9px] text-neutral-400 shrink-0">
                            Kosong
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-900 truncate">{p.name}</p>
                        </div>
                      </div>
                    </td>

                    {/* Kategori */}
                    <td className="px-5 py-3.5 text-neutral-500 text-sm">{p.category_name}</td>

                    {/* Harga */}
                    <td className="px-5 py-3.5 text-neutral-700">
                      Rp{Number(p.price).toLocaleString("id-ID")}
                    </td>

                    {/* Stok + Bar */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <span className={`font-bold text-base ${p.stock === 0 ? "text-danger" : p.stock <= 5 ? "text-orange-600" : "text-amber-600"}`}>
                          {p.stock}
                        </span>
                        <StockBar stok={p.stock} />
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          title="Edit Produk"
                          className="p-1.5 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setManagingVariantsFor({ id: p.id, name: p.name })}
                          title="Kelola Varian"
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 text-xs text-neutral-500">
            {filtered.length} produk ditampilkan
            {searchQuery && ` — hasil pencarian "${searchQuery}"`}
          </div>
        </div>
      )}

      {/* Modal Edit Produk */}
      {showForm && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSave}
            className="bg-surface rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg font-display text-neutral-900">Edit Produk</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={20} />
              </button>
            </div>

            <input
              placeholder="Nama produk"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Deskripsi"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Harga"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
              />
              <div className="relative">
                <input
                  type="number"
                  placeholder="Stok"
                  value={form.stock}
                  onChange={e => setForm({ ...form, stock: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    Number(form.stock) === 0
                      ? "border-danger bg-red-50 text-danger"
                      : Number(form.stock) <= 10
                      ? "border-amber-300 bg-amber-50"
                      : "border-neutral-200"
                  }`}
                />
                {Number(form.stock) <= 10 && form.stock !== "" && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-600">
                    {Number(form.stock) === 0 ? "HABIS" : "RENDAH"}
                  </span>
                )}
              </div>
            </div>
            <select
              value={form.category_id}
              onChange={e => setForm({ ...form, category_id: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-900"
            >
              <option value="">Pilih kategori...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.nama_kategori}</option>
              ))}
            </select>

            <div className="space-y-1">
              <label className="text-sm font-medium text-neutral-700">Gambar Produk</label>
              <input
                type="file"
                accept="image/*"
                onChange={e => setImageFile(e.target.files[0])}
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
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
              />
              Produk aktif (tampil di katalog)
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </form>
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
