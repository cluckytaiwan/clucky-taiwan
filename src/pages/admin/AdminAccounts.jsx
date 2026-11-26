// src/pages/admin/AdminAccounts.jsx
//
// Khusus Owner: kelola akun admin (tambah, ubah, hapus). Hanya CRUD, tanpa status
// aktif/nonaktif. Membuat/menghapus akun login butuh hak server, jadi semua
// perubahan lewat Edge Function manage-admin (yang memeriksa ulang peran Owner).
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, X, Users } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabaseClient";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function callManageAdmin(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

const tanggal = (iso) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-neutral-900">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Form Tambah / Ubah. Saat ubah, kata sandi boleh dikosongkan (tidak diubah). */
function AccountForm({ account, onClose, onSaved }) {
  const editing = Boolean(account);
  const [form, setForm] = useState({ nama: account?.nama ?? "", email: account?.email ?? "", password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (form.nama.trim().length < 3) return setError("Nama minimal 3 karakter");
    if (!EMAIL_REGEX.test(form.email.trim())) return setError("Format email tidak valid");
    if (!editing && form.password.length < 8) return setError("Kata sandi minimal 8 karakter");
    if (editing && form.password && form.password.length < 8) return setError("Kata sandi baru minimal 8 karakter");

    setSaving(true);
    const body = editing
      ? { aksi: "ubah", user_id: account.user_id, nama: form.nama.trim(), email: form.email.trim(), ...(form.password ? { password: form.password } : {}) }
      : { aksi: "tambah", nama: form.nama.trim(), email: form.email.trim(), password: form.password };
    const res = await callManageAdmin(body).catch(() => null);
    setSaving(false);
    if (!res?.success) return setError(res?.error?.message || "Gagal menyimpan, coba lagi");
    toast.success(editing ? "Akun admin diperbarui" : "Akun admin ditambahkan");
    onSaved();
  }

  const input = "w-full mt-1 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="acc-nama" className="text-sm font-semibold text-neutral-800">Nama lengkap</label>
        <input id="acc-nama" className={input} value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama staf" />
      </div>
      <div>
        <label htmlFor="acc-email" className="text-sm font-semibold text-neutral-800">Email</label>
        <input id="acc-email" type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staf@clucky.id" />
      </div>
      <div>
        <label htmlFor="acc-pw" className="text-sm font-semibold text-neutral-800">
          {editing ? "Kata sandi baru (opsional)" : "Kata sandi sementara"}
        </label>
        <input id="acc-pw" type="password" className={input} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? "Kosongkan jika tidak diubah" : "Minimal 8 karakter"} autoComplete="new-password" />
      </div>
      <p className="text-xs text-neutral-500">
        {editing
          ? "Perubahan langsung berlaku di login berikutnya. Mengisi kata sandi baru berarti mereset kata sandi akun ini."
          : "Akun baru dapat masuk lewat halaman Login Pengelola. Owner tidak dapat membuat Owner lain dari sini."}
      </p>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-center text-sm text-danger">{error}</p>}
      <button type="submit" disabled={saving} className="w-full rounded-xl bg-primary py-2.5 font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
        {saving ? "Menyimpan..." : editing ? "Simpan perubahan" : "Simpan"}
      </button>
    </form>
  );
}

function ConfirmDelete({ account, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setDeleting(true);
    setError("");
    const res = await callManageAdmin({ aksi: "hapus", user_id: account.user_id }).catch(() => null);
    setDeleting(false);
    if (!res?.success) return setError(res?.error?.message || "Gagal menghapus, coba lagi");
    toast.success("Akun admin dihapus");
    onDeleted();
  }

  return (
    <>
      <p className="text-sm text-neutral-600">
        Akun <strong>{account.nama}</strong> ({account.email}) akan dihapus permanen dan tidak bisa masuk lagi ke panel pengelola.
        Riwayat pesanan yang pernah diproses tetap tersimpan.
      </p>
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-center text-sm text-danger">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={onClose} className="rounded-xl border border-neutral-200 py-2.5 font-semibold text-neutral-800 hover:bg-neutral-50">Batal</button>
        <button onClick={confirm} disabled={deleting} className="rounded-xl bg-primary py-2.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
          {deleting ? "Menghapus..." : "Ya, hapus akun"}
        </button>
      </div>
    </>
  );
}

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { type: 'tambah' | 'ubah' | 'hapus', account? }

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("admin")
      .select("user_id, nama, email, role, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true });
    if (error) console.error("[AkunAdmin] gagal memuat:", error.message);
    setAccounts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function saved() { setModal(null); load(); }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-neutral-900">Kelola Akun Admin</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Tambah, ubah, atau hapus akun pengelola operasional</p>
        </div>
        <button onClick={() => setModal({ type: "tambah" })} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark">
          <Plus size={16} /> Tambah Admin
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400"><Loader2 className="animate-spin" size={22} /></div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-surface py-16 text-center">
          <Users className="mx-auto mb-3 text-neutral-300" size={36} />
          <p className="font-semibold text-neutral-700">Belum ada akun admin</p>
          <p className="text-sm text-neutral-400">Tambahkan akun agar staf dapat memproses pesanan.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Peran</th>
                <th className="px-5 py-3">Dibuat</th>
                <th className="px-5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {accounts.map((a) => (
                <tr key={a.user_id}>
                  <td className="px-5 py-3.5 font-semibold text-neutral-800">{a.nama || "—"}</td>
                  <td className="px-5 py-3.5 text-neutral-600">{a.email}</td>
                  <td className="px-5 py-3.5"><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">Admin</span></td>
                  <td className="px-5 py-3.5 text-neutral-600 whitespace-nowrap">{tanggal(a.created_at)}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <button onClick={() => setModal({ type: "ubah", account: a })} className="mr-4 font-semibold text-neutral-600 hover:text-primary">Ubah</button>
                    <button onClick={() => setModal({ type: "hapus", account: a })} className="font-semibold text-danger hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === "tambah" && (
        <Modal title="Tambah Admin" onClose={() => setModal(null)}><AccountForm onClose={() => setModal(null)} onSaved={saved} /></Modal>
      )}
      {modal?.type === "ubah" && (
        <Modal title="Ubah Admin" onClose={() => setModal(null)}><AccountForm account={modal.account} onClose={() => setModal(null)} onSaved={saved} /></Modal>
      )}
      {modal?.type === "hapus" && (
        <Modal title="Hapus akun admin?" onClose={() => setModal(null)}><ConfirmDelete account={modal.account} onClose={() => setModal(null)} onDeleted={saved} /></Modal>
      )}
    </div>
  );
}
