// src/pages/admin/AdminProducts.jsx
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Pencil, Trash2, Plus, X, Settings2, Search, AlertTriangle, PackageX } from "lucide-react";
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
    <div className="w-20 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

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
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [managingVariantsFor, setManagingVariantsFor] = useState(null);

  // Filter & search state
  const [filter, setFilter] = useState("all");       // all | rendah | habis | nonaktif
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  async function fetchProducts() {
    setLoading(true);
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

  /* ─── Filter & Search ─── */
  const filtered = useMemo(() => {
    let result = products;

    // Filter pills
    if (filter === "rendah")   result = result.filter(p => p.is_active && p.stock > 0 && p.stock <= 10);
    if (filter === "habis")    result = result.filter(p => p.is_active && p.stock === 0);
    if (filter === "nonaktif") result = result.filter(p => !p.is_active);

    // Filter kategori
    if (filterCat !== "all") result = result.filter(p => p.category_id === filterCat);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [products, filter, filterCat, searchQuery]);

  // Counts untuk badge
  const rendahCount  = useMemo(() => products.filter(p => p.is_active && p.stock > 0 && p.stock <= 10).length, [products]);
  const habisCount   = useMemo(() => products.filter(p => p.is_active && p.stock === 0).length, [products]);
  const nonaktifCount = useMemo(() => products.filter(p => !p.is_active).length, [products]);

  /* ─── CRUD ─── */
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
      
      const { error: uploadError } = await supabase.storage
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

  /* ─── Filter pill config ─── */
  const filterOptions = [
    { key: "all",      label: "Semua",       count: null },
    { key: "rendah",   label: "Stok Rendah", count: rendahCount,   icon: AlertTriangle, badgeClass: "bg-amber-100 text-amber-700" },
    { key: "habis",    label: "Habis",       count: habisCount,    icon: PackageX,      badgeClass: "bg-red-100 text-danger" },
    { key: "nonaktif", label: "Nonaktif",    count: nonaktifCount, badgeClass: "bg-neutral-200 text-neutral-500" },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display text-neutral-900">Kelola Produk</h1>
        <button
          onClick={openCreate}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Tambah Produk
        </button>
      </div>

      {/* Toolbar: Search + Filter Kategori */}
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

      {/* Filter Pills */}
      <div className="flex gap-1.5 flex-wrap">
        {filterOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border flex items-center gap-1.5 ${
              filter === opt.key
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-surface text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700"
            }`}
          >
            {opt.icon && filter !== opt.key && <opt.icon size={12} />}
            {opt.label}
            {opt.count != null && opt.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                filter === opt.key ? "bg-white/20 text-white" : opt.badgeClass
              }`}>
                {opt.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Info pencarian */}
      {searchQuery && (
        <p className="text-xs text-neutral-400">
          {filtered.length} hasil untuk &ldquo;<strong className="text-neutral-600">{searchQuery}</strong>&rdquo;
          {filter !== "all" && ` dalam filter ${filterOptions.find(o => o.key === filter)?.label}`}
        </p>
      )}

      {/* Tabel Produk */}
      {loading ? (
        <div className="text-center py-16 text-neutral-400 text-sm">Memuat data produk…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <p className="text-sm">
            {products.length === 0
              ? 'Belum ada produk. Klik "Tambah Produk" untuk mulai.'
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
                  <th className="text-right px-5 py-3">Harga</th>
                  <th className="text-left px-5 py-3">Stok</th>
                  <th className="text-center px-5 py-3">Status</th>
                  <th className="text-center px-5 py-3 w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((p) => {
                  const isHabis  = p.is_active && p.stock === 0;
                  const isRendah = p.is_active && p.stock > 0 && p.stock <= 10;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-neutral-50/80 transition-colors align-middle ${
                        isHabis ? "bg-red-50/40" : ""
                      }`}
                    >
                      {/* Produk (gambar + nama) */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-neutral-200 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 bg-neutral-100 rounded-lg border border-neutral-200 flex items-center justify-center text-[9px] text-neutral-400 font-medium shrink-0">Kosong</div>
                          )}
                          <p className="font-semibold text-neutral-900 truncate max-w-[180px]">{p.name}</p>
                        </div>
                      </td>

                      {/* Kategori */}
                      <td className="px-5 py-3.5 text-neutral-500">{p.category_name}</td>

                      {/* Harga */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        Rp{Number(p.price).toLocaleString("id-ID")}
                      </td>

                      {/* Stok */}
                      <td className="px-5 py-3.5">
                        {isHabis ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-danger text-base">0</span>
                            <span className="text-[10px] font-bold text-danger bg-red-100 px-1.5 py-0.5 rounded-full w-fit">HABIS</span>
                          </div>
                        ) : isRendah ? (
                          <div className="flex flex-col gap-1.5">
                            <span className={`font-bold text-base ${p.stock <= 5 ? "text-orange-600" : "text-amber-600"}`}>
                              {p.stock}
                            </span>
                            <StockBar stok={p.stock} />
                          </div>
                        ) : (
                          <span className="text-neutral-700">{p.stock}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            p.is_active ? "bg-green-100 text-success" : "bg-neutral-200 text-neutral-500"
                          }`}
                        >
                          {p.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setManagingVariantsFor({ id: p.id, name: p.name })}
                            title="Kelola Varian"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Settings2 size={15} />
                          </button>
                          <button
                            onClick={() => openEdit(p)}
                            title="Edit Produk"
                            className="p-1.5 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
                            title="Hapus Produk"
                            className="p-1.5 rounded-lg text-danger hover:opacity-70 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 text-xs text-neutral-500">
            {filtered.length} produk ditampilkan
            {filter !== "all" && ` — ${filterOptions.find(o => o.key === filter)?.label}`}
            {searchQuery && ` — pencarian "${searchQuery}"`}
          </div>
        </div>
      )}

      {/* Modal Form Produk */}
      {showForm && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSave}
            className="bg-surface rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg font-display text-neutral-900">
                {editingId ? "Edit Produk" : "Tambah Produk"}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={20} />
              </button>
            </div>

            <input
              placeholder="Nama produk"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Deskripsi"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Harga"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
              />
              <div className="relative">
                <input
                  type="number"
                  placeholder="Stok"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    Number(form.stock) === 0 && form.stock !== ""
                      ? "border-danger bg-red-50 text-danger"
                      : Number(form.stock) <= 10 && form.stock !== ""
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
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-900"
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
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
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
