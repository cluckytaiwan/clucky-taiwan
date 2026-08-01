// src/components/admin/SalesSummary.jsx
import { PackageOpen, DollarSign, Clock } from "lucide-react";
import { formatRupiah } from "../../utils/formatCurrency";

export default function SalesSummary({ orders }) {
  const settled      = orders.filter((o) => o.status_pembayaran === "lunas");
  const inProgress   = orders.filter((o) => o.status_pembayaran === "lunas" && o.status_pesanan !== "selesai");
  const totalRevenue = settled.reduce((s, o) => s + Number(o.total_harga), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {[
        { icon: <PackageOpen size={20} />, color: "bg-blue-100 text-blue-600",    label: "Pesanan Lunas",   val: settled.length,    rupiah: false },
        { icon: <DollarSign  size={20} />, color: "bg-green-100 text-green-600",  label: "Total Pendapatan",val: totalRevenue,      rupiah: true  },
        { icon: <Clock       size={20} />, color: "bg-orange-100 text-orange-600",label: "Sedang Diproses", val: inProgress.length, rupiah: false },
      ].map((c) => (
        <div key={c.label} className="bg-surface border border-neutral-200 rounded-xl p-4 flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${c.color}`}>{c.icon}</div>
          <div>
            <p className="text-xs text-neutral-500 font-medium">{c.label}</p>
            <p className={`font-bold font-display leading-tight ${c.rupiah ? "text-base text-green-600" : "text-xl text-neutral-900"}`}>
              {c.rupiah ? formatRupiah(c.val) : c.val}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
