// src/pages/public/ProfilePage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import StoreFooter from "../../components/StoreFooter";

/**
 * Profil Saya (pelanggan): lihat email, ubah nama, ganti kata sandi, keluar.
 * Nama dipakai otomatis di checkout. Email tidak bisa diubah di sini.
 */
export default function ProfilePage() {
  const { nama, email, updateNama, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();

  const [namaBaru, setNamaBaru] = useState(nama);
  const [namaError, setNamaError] = useState("");
  const [savingNama, setSavingNama] = useState(false);

  const [pw, setPw] = useState({ baru: "", ulang: "" });
  const [pwError, setPwError] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  async function handleSaveNama(e) {
    e.preventDefault();
    setNamaError("");
    if (namaBaru.trim().length < 3) return setNamaError("Nama minimal 3 karakter");
    if (namaBaru.trim().length > 60) return setNamaError("Nama maksimal 60 karakter");
    setSavingNama(true);
    const err = await updateNama(namaBaru);
    setSavingNama(false);
    if (err) setNamaError("Gagal menyimpan nama, coba lagi");
    else toast.success("Nama diperbarui");
  }

  async function handleSavePassword(e) {
    e.preventDefault();
    setPwError("");
    if (pw.baru.length < 8) return setPwError("Kata sandi baru minimal 8 karakter");
    if (pw.baru !== pw.ulang) return setPwError("Konfirmasi kata sandi tidak sama");
    setSavingPw(true);
    const err = await updatePassword(pw.baru);
    setSavingPw(false);
    if (err) {
      setPwError(/same|different/i.test(err.message) ? "Kata sandi baru harus berbeda dari yang lama" : "Gagal mengganti kata sandi, coba lagi");
    } else {
      setPw({ baru: "", ulang: "" });
      toast.success("Kata sandi diganti");
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  const field = "w-full mt-1 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  const card = "rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm";

  return (
    <div className="flex min-h-screen flex-col bg-background pt-8">
      <div className="mx-auto w-full max-w-lg flex-1 px-4">
        <button onClick={() => navigate("/")} className="mb-4 font-body text-sm text-neutral-500 hover:text-neutral-900">
          &larr; Kembali ke Beranda
        </button>
        <h1 className="font-display text-2xl font-bold text-neutral-900">Profil Saya</h1>

        <section className={`${card} mt-5`} aria-labelledby="profil-data">
          <h2 id="profil-data" className="font-display text-lg font-bold text-neutral-900">Data Akun</h2>
          <form onSubmit={handleSaveNama} className="mt-4 space-y-4" noValidate>
            <div>
              <label htmlFor="profil-email" className="text-sm font-semibold text-neutral-800">Email</label>
              <input id="profil-email" value={email} readOnly className={`${field} bg-neutral-50 text-neutral-500`} />
              <p className="mt-1 text-xs text-neutral-500">Email dipakai untuk masuk dan tidak dapat diubah.</p>
            </div>
            <div>
              <label htmlFor="profil-nama" className="text-sm font-semibold text-neutral-800">Nama lengkap</label>
              <input id="profil-nama" value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)} className={field} autoComplete="name" />
              <p className="mt-1 text-xs text-neutral-500">Nama ini terisi otomatis saat checkout.</p>
              {namaError && <p role="alert" className="mt-1 text-xs text-danger">{namaError}</p>}
            </div>
            <button type="submit" disabled={savingNama || namaBaru.trim() === nama} className="rounded-xl bg-primary px-5 py-2.5 font-body text-sm font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-50">
              {savingNama ? "Menyimpan..." : "Simpan Nama"}
            </button>
          </form>
        </section>

        <section className={`${card} mt-4`} aria-labelledby="profil-sandi">
          <h2 id="profil-sandi" className="font-display text-lg font-bold text-neutral-900">Ganti Kata Sandi</h2>
          <form onSubmit={handleSavePassword} className="mt-4 space-y-4" noValidate>
            <div>
              <label htmlFor="pw-baru" className="text-sm font-semibold text-neutral-800">Kata sandi baru</label>
              <input id="pw-baru" type="password" value={pw.baru} onChange={(e) => setPw({ ...pw, baru: e.target.value })} className={field} placeholder="Minimal 8 karakter" autoComplete="new-password" />
            </div>
            <div>
              <label htmlFor="pw-ulang" className="text-sm font-semibold text-neutral-800">Ulangi kata sandi baru</label>
              <input id="pw-ulang" type="password" value={pw.ulang} onChange={(e) => setPw({ ...pw, ulang: e.target.value })} className={field} autoComplete="new-password" />
            </div>
            {pwError && <p role="alert" className="text-xs text-danger">{pwError}</p>}
            <button type="submit" disabled={savingPw || !pw.baru} className="rounded-xl border border-neutral-300 px-5 py-2.5 font-body text-sm font-bold text-neutral-900 transition-colors hover:bg-neutral-100 disabled:opacity-50">
              {savingPw ? "Menyimpan..." : "Ganti Kata Sandi"}
            </button>
          </form>
        </section>

        <div className="mt-4 flex flex-col gap-2 pb-10 sm:flex-row">
          <button onClick={() => navigate("/cek-pesanan")} className="flex-1 rounded-xl border border-neutral-200 bg-white py-3 font-body text-sm font-semibold text-neutral-900 hover:bg-neutral-100">
            Lihat Pesanan Saya
          </button>
          <button onClick={handleSignOut} className="flex-1 rounded-xl border border-red-200 bg-white py-3 font-body text-sm font-semibold text-danger hover:bg-red-50">
            Keluar
          </button>
        </div>
      </div>
      <StoreFooter />
    </div>
  );
}
