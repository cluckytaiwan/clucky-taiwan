// src/components/CartDrawer.jsx
import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { X, ShoppingBag } from "lucide-react";
import QtyStepper from "./QtyStepper";
import { useCartStore } from "../store/cartStore";
import { formatRupiah } from "../utils/formatCurrency";

export default function CartDrawer({ isOpen, onClose, onCheckout }) {
  const { items, updateQty, removeItem, getTotal, clearCart, restoreItems } = useCartStore();

  // Snapshot isi keranjang terakhir yang dikosongkan, untuk tombol "Urungkan"
  // di dalam drawer (bukan toast, supaya tidak menutupi header dan tidak
  // menutup drawer saat diklik).
  const [clearedSnapshot, setClearedSnapshot] = useState(null);

  // Snapshot hanya berlaku sampai keranjang terisi lagi — mencegah "Urungkan"
  // basi muncul saat keranjang kelak kosong karena hapus satu per satu.
  useEffect(() => {
    if (items.length > 0) setClearedSnapshot(null);
  }, [items.length]);

  function handleClearAll() {
    setClearedSnapshot(items);
    clearCart();
  }

  function handleUndoClear() {
    if (clearedSnapshot) restoreItems(clearedSnapshot);
    setClearedSnapshot(null);
  }

  function handleOpenChange(open) {
    if (!open) {
      setClearedSnapshot(null);
      onClose();
    }
  }

  return (
    <Drawer.Root open={isOpen} onOpenChange={handleOpenChange} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-neutral-900/50" />
        <Drawer.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-background shadow-xl outline-none">
          <div className="flex items-center justify-between border-b border-neutral-200 py-2 pl-4 pr-2">
            <Drawer.Title className="font-display text-lg font-bold text-neutral-900">
              Keranjang Saya
            </Drawer.Title>
            <div className="flex items-center gap-1">
            {items.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex h-11 items-center rounded-lg px-3 font-body text-sm font-medium text-danger hover:bg-red-50 active:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Kosongkan
              </button>
            )}
            <button
              onClick={() => handleOpenChange(false)}
              aria-label="Tutup keranjang"
              className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-900 hover:bg-neutral-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={20} />
            </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.length === 0 ? (
              <div className="mt-10 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                  <ShoppingBag size={28} className="text-neutral-400" />
                </div>
                <p className="font-body text-sm text-neutral-500 mb-4">
                  {clearedSnapshot ? "Keranjang dikosongkan" : "Keranjang masih kosong"}
                </p>
                {clearedSnapshot && (
                  <button
                    onClick={handleUndoClear}
                    className="mb-3 block w-full font-body text-sm font-semibold text-primary underline underline-offset-2 hover:text-primary-dark"
                  >
                    Urungkan
                  </button>
                )}
                <button
                  onClick={() => handleOpenChange(false)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-body text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  Mulai Belanja
                </button>
              </div>
            ) : (
              items.map((item) => (
                // key pakai cart_key agar item sama dengan varian beda tidak merge di React
                <div key={item.cart_key} className="flex gap-3 border-b border-neutral-200 pb-3">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      loading="lazy"
                      className="h-16 w-16 rounded-lg bg-neutral-200/50 object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag size={20} className="text-neutral-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-neutral-900 truncate">{item.name}</p>
                    {/* Label varian: "Large · Pedas Level 2" */}
                    {item.variant_label && (
                      <p className="font-body text-xs text-neutral-500 mt-0.5 truncate">
                        {item.variant_label}
                      </p>
                    )}
                    <p className="font-body text-sm font-semibold tabular-nums text-primary mt-0.5">
                      {formatRupiah(item.price)}
                    </p>
                    <div className="mt-1">
                      <QtyStepper item={item} onChange={updateQty} onRemove={removeItem} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-dashed border-neutral-200 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="mb-3 flex justify-between font-body font-bold">
                <span className="text-neutral-900">Total</span>
                <span className="tabular-nums text-primary">{formatRupiah(getTotal())}</span>
              </div>
              <button
                onClick={onCheckout}
                className="h-12 w-full rounded-xl bg-primary font-body font-semibold text-white transition-colors hover:bg-primary-dark active:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Checkout
              </button>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
