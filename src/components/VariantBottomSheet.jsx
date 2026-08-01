import { useEffect, useState, useMemo } from "react";
import { Drawer } from "vaul";
import { X, Sparkles, Tag, Plus, ShoppingBag } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useCartStore } from "../store/cartStore";
import { useVariantModalStore } from "../store/variantModalStore";
import { formatRupiah } from "../utils/formatCurrency";
import { getOptimizedImageUrl } from "../utils/imageUrl";
import toast from "react-hot-toast";

// Custom hook untuk mendeteksi layar desktop (Tailwind 'sm' breakpoint: 640px)
function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
}

export default function VariantBottomSheet() {
  const { isOpen, closeModal, productId, preselectVariantIds, referenceBudget, otherVariantItems } = useVariantModalStore();
  
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedVariants, setSelectedVariants] = useState({});
  const { addItem } = useCartStore();

  const isDesktop = useMediaQuery("(min-width: 640px)");

  useEffect(() => {
    if (!isOpen || !productId) return;

    let isMounted = true;
    async function fetchAll() {
      setLoading(true);
      setError(null);
      setSelectedVariants({});

      const [productRes, variantRes] = await Promise.all([
        supabase
          .from("produk")
          .select("id, nama_produk, deskripsi, harga, stok, url_gambar, aktif, kategori(nama_kategori)")
          .eq("id", productId)
          .single(),
        supabase
          .from("opsi_varian")
          .select("id, tipe, nama, harga_tambahan, urutan")
          .eq("produk_id", productId)
          .eq("aktif", true)
          .order("tipe", { ascending: true })
          .order("urutan", { ascending: true }),
      ]);

      if (!isMounted) return;

      if (productRes.error || !productRes.data || !productRes.data.aktif) {
        setError("Produk tidak ditemukan atau tidak aktif.");
        setLoading(false);
        return;
      }

      const p = productRes.data;
      setProduct({
        id: p.id,
        name: p.nama_produk,
        description: p.deskripsi,
        price: Number(p.harga),
        stock: p.stok,
        image_url: p.url_gambar,
        category: p.kategori?.nama_kategori || "-",
      });

      const variantList = variantRes.data || [];
      setVariants(variantList);

      const tipeSet = [...new Set(variantList.map((v) => v.tipe))];
      const initialSelection = Object.fromEntries(
        tipeSet.map((t) => {
          const preselected = variantList.find(
            (v) => v.tipe === t && preselectVariantIds.includes(v.id),
          );
          return [t, preselected ?? null];
        }),
      );
      setSelectedVariants(initialSelection);
      setLoading(false);
    }
    fetchAll();

    return () => { isMounted = false; };
  }, [isOpen, productId, preselectVariantIds]);

  const groupedVariants = useMemo(() => {
    const groups = {};
    for (const v of variants) {
      if (!groups[v.tipe]) groups[v.tipe] = [];
      groups[v.tipe].push(v);
    }
    return groups;
  }, [variants]);

  const variantTypes = Object.keys(groupedVariants);

  const extraPrice = useMemo(
    () =>
      Object.values(selectedVariants).reduce(
        (sum, v) => sum + (v ? Number(v.harga_tambahan) : 0),
        0,
      ),
    [selectedVariants],
  );
  const finalPrice = (product?.price ?? 0) + extraPrice;

  const allVariantsSelected = variantTypes.every((t) => selectedVariants[t] !== null);
  const canAdd = product && product.stock > 0 && (variantTypes.length === 0 || allVariantsSelected);

  const variantLabel = variantTypes
    .filter((t) => selectedVariants[t])
    .map((t) => selectedVariants[t].nama)
    .join(" · ");

  function selectVariant(tipe, varianObj) {
    setSelectedVariants((prev) => ({ ...prev, [tipe]: varianObj }));
  }

  function handleAdd() {
    if (!canAdd) return;

    const selectedVariantIds = variantTypes
      .filter((t) => selectedVariants[t])
      .map((t) => selectedVariants[t].id);

    addItem(
      {
        id: product.id,
        name: product.name,
        base_price: product.price,
        price: finalPrice,
        stock: product.stock,
        image_url: product.image_url,
        variant_ids: selectedVariantIds,
        variant_label: variantLabel,
      },
      1
    );

    toast.success("Berhasil ditambahkan ke keranjang!");
    closeModal();
  }

  // Komponen isi modal yang akan di-render baik di Desktop Modal maupun Mobile Drawer
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-8 text-center">
          <p className="text-danger font-medium mb-4">{error}</p>
          <button onClick={closeModal} className="bg-neutral-100 px-4 py-2 rounded-xl text-sm font-semibold">Tutup</button>
        </div>
      );
    }

    if (!product) return null;

    return (
      <>
        {/* ── Header ── */}
        <div className="relative p-5 sm:p-6 pb-4">
          <button 
            onClick={closeModal} 
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-neutral-400 hover:text-neutral-700 transition-colors"
            aria-label="Tutup modal"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-4 pr-8">
            {product.image_url ? (
              <img 
                src={getOptimizedImageUrl(product.image_url, { width: 120 })} 
                alt={product.name} 
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover bg-neutral-50 shrink-0 border border-neutral-100" 
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-neutral-100 flex items-center justify-center shrink-0">
                <ShoppingBag size={20} className="text-neutral-300" />
              </div>
            )}
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900 leading-snug font-display line-clamp-2">
                {product.name}
              </h2>
              <p className="text-[13px] sm:text-sm font-medium text-neutral-500 mt-0.5">
                Pilih ukuran & rasa
              </p>
            </div>
          </div>
        </div>

        {/* ── Body (Varian) ── */}
        <div className="px-5 sm:px-6 py-2 overflow-y-auto max-h-[60vh] sm:max-h-[50vh] space-y-6">
          
          {/* Notifikasi Budget Recommender */}
          {preselectVariantIds.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-[13px] font-medium text-primary">
              <Sparkles size={14} className="shrink-0" />
              <span>Varian sudah dipilihkan otomatis sesuai budget kamu.</span>
            </div>
          )}
          {otherVariantItems.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-medium text-amber-800">
              <Tag size={14} className="shrink-0" />
              <span>Paket ini juga berisi {otherVariantItems.join(", ")}. Jangan lupa tambahkan setelah ini.</span>
            </div>
          )}

          {/* Selector Varian */}
          {variantTypes.map((tipe) => (
            <div key={tipe}>
              <h3 className="text-[11px] sm:text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">
                {tipe}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {groupedVariants[tipe].map((v) => {
                  const isSelected = selectedVariants[tipe]?.id === v.id;
                  const addedPrice = Number(v.harga_tambahan);
                  
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selectVariant(tipe, v)}
                      className={`rounded-2xl border-2 p-3 text-left transition-all duration-200 ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-orange-50 bg-[#FDF8F3] hover:border-orange-100 hover:bg-[#faeedd]"
                      }`}
                    >
                      <p className={`font-bold text-[13px] sm:text-sm leading-tight ${isSelected ? "text-primary" : "text-neutral-800"}`}>
                        {v.nama}
                      </p>
                      <p className={`text-[11px] sm:text-xs font-medium mt-1 sm:mt-1.5 ${isSelected ? "text-primary/80" : "text-neutral-500"}`}>
                        {addedPrice > 0 ? `+ ${formatRupiah(addedPrice)}` : "Standar"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Hint wajib pilih */}
          {variantTypes.length > 0 && !allVariantsSelected && (
            <p className="text-[12px] sm:text-[13px] text-amber-600 font-medium pb-2">
              * Mohon pilih {variantTypes.filter((t) => !selectedVariants[t]).join(" & ")} terlebih dahulu.
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-5 sm:p-6 pt-4 sm:pt-4 mt-2 sm:mt-2 border-t border-neutral-100 flex flex-row items-center justify-between gap-4 bg-white rounded-b-[24px]">
          <div>
            <p className="text-[11px] sm:text-xs font-medium text-neutral-500 mb-0.5">Total</p>
            <p className="text-lg sm:text-xl font-bold font-display text-primary tracking-tight">
              {formatRupiah(finalPrice)}
            </p>
            
            {/* Peringatan Budget */}
            {referenceBudget != null && finalPrice > referenceBudget && (
              <p className="text-[10px] sm:text-[11px] text-danger font-medium mt-1 absolute bottom-2 left-5 sm:left-6">
                Melebihi budget (+{formatRupiah(finalPrice - referenceBudget)})
              </p>
            )}
          </div>
          
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="bg-primary hover:bg-primary-dark text-white font-bold text-sm px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <Plus size={16} className="hidden sm:block" />
            <span>Tambah</span>
          </button>
        </div>
      </>
    );
  };

  if (!isOpen) return null;

  // Render Desktop (Modal Tengah)
  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div 
          className="bg-white rounded-[24px] w-full max-w-[480px] shadow-2xl flex flex-col relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {renderContent()}
        </div>
        
        {/* Overlay click to close */}
        <div className="fixed inset-0 z-0" onClick={closeModal}></div>
      </div>
    );
  }

  // Render Mobile (Bottom Drawer via vaul)
  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && closeModal()} direction="bottom">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[90vh] flex-col rounded-t-[24px] bg-white shadow-xl outline-none">
          {/* Handle for Drawer */}
          <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-neutral-300" />
          
          {renderContent()}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
