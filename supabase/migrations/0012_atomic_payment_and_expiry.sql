-- 0012_atomic_payment_and_expiry.sql
--
-- Perbaikan keandalan P1:
--
-- 1. proses_status_pembayaran(): update status pembayaran + pengembalian stok
--    dalam SATU transaksi dengan update bersyarat. Mencegah race condition saat
--    Midtrans mengirim notifikasi yang sama berulang/bersamaan (sebelumnya stok
--    bisa dikembalikan dua kali), dan mengizinkan transisi lunas -> dikembalikan
--    (refund) yang sebelumnya diabaikan.
--
-- 2. kedaluwarsakan_pesanan_lama(): menandai pesanan "menunggu_pembayaran" yang
--    melewati batas waktu sebagai "kadaluarsa" dan mengembalikan stoknya.
--    Dijalankan pg_cron tiap 5 menit. Tanpa ini, pesanan yang tidak pernah
--    dibayar menahan stok selamanya (Midtrans tidak selalu mengirim notifikasi
--    expire bila pembeli tidak memilih metode bayar).
--
--    Batas 45 menit > masa berlaku Snap (30 menit, diset di create-order),
--    sehingga pesanan tidak dibatalkan selagi pembeli masih bisa membayar.

-- ── 1. Update status pembayaran secara atomik ──────────────────────────────
create or replace function public.proses_status_pembayaran(
  p_pesanan_id uuid,
  p_status     status_pembayaran
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lama status_pembayaran;
begin
  select status_pembayaran into v_lama
  from pesanan
  where id = p_pesanan_id
  for update;                       -- kunci baris: notifikasi paralel menunggu giliran

  if v_lama is null then
    return 'not_found';
  end if;

  -- Transisi yang diizinkan:
  --   menunggu_pembayaran -> status apa pun selain dirinya
  --   lunas               -> dikembalikan (refund)
  if not (
    (v_lama = 'menunggu_pembayaran' and p_status <> 'menunggu_pembayaran')
    or (v_lama = 'lunas' and p_status = 'dikembalikan')
  ) then
    return 'ignored';               -- sudah final / duplikat notifikasi
  end if;

  update pesanan
  set status_pembayaran = p_status,
      dibayar_pada = case when p_status = 'lunas' then coalesce(dibayar_pada, now()) else dibayar_pada end
  where id = p_pesanan_id;

  -- Pesanan gagal sebelum dibayar: kembalikan stok yang direservasi saat checkout.
  -- (Refund dari lunas TIDAK mengembalikan stok — makanan sudah dibuat.)
  if v_lama = 'menunggu_pembayaran' and p_status in ('kadaluarsa', 'dibatalkan', 'ditolak') then
    update produk p
    set stok = p.stok + d.total,
        updated_at = now()
    from (
      select produk_id, sum(jumlah)::int as total
      from detail_pesanan
      where pesanan_id = p_pesanan_id and produk_id is not null
      group by produk_id
    ) d
    where p.id = d.produk_id;
  end if;

  return 'updated';
end;
$$;

revoke all on function public.proses_status_pembayaran(uuid, status_pembayaran) from public, anon, authenticated;
grant execute on function public.proses_status_pembayaran(uuid, status_pembayaran) to service_role;

-- ── 2. Kedaluwarsakan pesanan yang tidak dibayar ───────────────────────────
create or replace function public.kedaluwarsakan_pesanan_lama(p_batas interval default interval '45 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_jumlah integer := 0;
begin
  for v_id in
    select id from pesanan
    where status_pembayaran = 'menunggu_pembayaran'
      and created_at < now() - p_batas
    order by created_at
    for update skip locked
  loop
    if public.proses_status_pembayaran(v_id, 'kadaluarsa') = 'updated' then
      v_jumlah := v_jumlah + 1;
    end if;
  end loop;
  return v_jumlah;
end;
$$;

revoke all on function public.kedaluwarsakan_pesanan_lama(interval) from public, anon, authenticated;
grant execute on function public.kedaluwarsakan_pesanan_lama(interval) to service_role;

-- ── 3. Jadwal pg_cron tiap 5 menit ─────────────────────────────────────────
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid) from cron.job where jobname = 'kedaluwarsakan-pesanan-lama';
select cron.schedule(
  'kedaluwarsakan-pesanan-lama',
  '*/5 * * * *',
  $$select public.kedaluwarsakan_pesanan_lama();$$
);
