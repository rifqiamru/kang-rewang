-- Pengujian skema Kang Rewang. Dijalankan oleh tests/db/run.sh.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'pemilik@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'penyusup@example.com');

select id as svc_belanja from public.service_categories where name = 'Titip Belanja' \gset
select id as svc_antar   from public.service_categories where name = 'Pengiriman Barang' \gset
select id as cat_bensin  from public.expense_categories where name = 'Bensin' \gset
select id as cat_parkir  from public.expense_categories where name = 'Parkir' \gset

do $$ begin
  assert (select count(*) from public.profiles where is_owner) = 1, 'harus ada tepat 1 pemilik';
  assert (select is_owner from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'user pertama = pemilik';
  assert not (select is_owner from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'user kedua bukan pemilik';
  raise notice 'OK  pemilik tunggal';
end $$;

-- ===================== Sebagai PEMILIK =====================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Transaksi A: Titip belanja, 2 barang + ongkos jasa
select public.save_order(jsonb_build_object(
  'client_request_id', 'aaaaaaaa-0000-0000-0000-000000000001',
  'transaction_date', '2026-11-20', 'customer_name', 'Budi', 'customer_phone', '0812-3456 789',
  'service_category_id', :'svc_belanja', 'service_fee', 20000,
  'payment_status', 'Lunas', 'order_status', 'Selesai', 'payment_method', 'Tunai',
  'items', jsonb_build_array(
     jsonb_build_object('item_name', 'Sanmol drop', 'quantity', 1, 'unit_price', 23000),
     jsonb_build_object('item_name', 'Bakso taytoh 12 butir', 'quantity', 1, 'unit_price', 48000))
)) as a \gset
select (:'a'::jsonb ->> 'id') as a_id \gset

-- Transaksi B: Antar barang tanpa rincian barang
select (public.save_order(jsonb_build_object(
  'transaction_date', '2026-11-20', 'customer_name', 'Ani',
  'service_category_id', :'svc_antar', 'service_fee', 25000,
  'payment_status', 'Lunas', 'order_status', 'Selesai', 'items', '[]'::jsonb
)) ->> 'id') as b_id \gset

insert into public.expenses (expense_date, category_id, description, amount)
values ('2026-11-20', :'cat_bensin', 'Isi bensin motor', 20000),
       ('2026-11-20', :'cat_parkir', 'Parkir pasar', 5000);

do $$
declare a jsonb := public.get_order((select id from public.orders where client_request_id = 'aaaaaaaa-0000-0000-0000-000000000001'));
begin
  assert a ->> 'invoice_number' = 'KR-2611001', 'nomor nota A: ' || (a ->> 'invoice_number');
  assert (a ->> 'goods_total')::int = 71000, 'goods A';
  assert (a ->> 'total_amount')::int = 91000, 'total A';
  assert (a ->> 'service_revenue')::int = 20000, 'pendapatan jasa A';
  assert (a ->> 'trust_amount')::int = 71000, 'dana titipan A';
  assert (a ->> 'paid_amount')::int = 91000 and (a ->> 'remaining_amount')::int = 0, 'Lunas → dibayar penuh';
  assert a ->> 'customer_phone' = '08123456789', 'nomor HP dinormalisasi';
  assert jsonb_array_length(a -> 'items') = 2, 'jumlah item A';
  assert (a -> 'items' -> 1 ->> 'subtotal')::int = 48000, 'subtotal item';
  assert a ->> 'service_name' = 'Titip Belanja', 'nama layanan';
  assert (select invoice_number from public.orders where customer_name = 'Ani') = 'KR-2611002', 'nomor nota B';
  raise notice 'OK  nota A & B: nomor, total, subtotal';
end $$;

-- Skenario keuangan wajib (bagian 17)
do $$
declare s jsonb := public.get_financial_summary('2026-11-20', '2026-11-20');
begin
  assert (s ->> 'order_count')::int = 2, 'jumlah order';
  assert (s ->> 'total_value')::int = 116000, 'total nilai transaksi ' || (s ->> 'total_value');
  assert (s ->> 'cash_in')::int = 116000, 'uang masuk';
  assert (s ->> 'service_revenue')::int = 45000, 'pendapatan jasa ' || (s ->> 'service_revenue');
  assert (s ->> 'trust_funds')::int = 71000, 'dana titipan';
  assert (s ->> 'expense_total')::int = 25000, 'pengeluaran';
  assert (s ->> 'net_profit')::int = 20000, 'keuntungan bersih ' || (s ->> 'net_profit');
  assert (s ->> 'receivables')::int = 0, 'piutang';
  assert (select net_profit from public.get_daily_series('2026-11-20', '2026-11-20')) = 20000, 'deret harian';
  raise notice 'OK  skenario keuangan: nilai 116.000, jasa 45.000, titipan 71.000, biaya 25.000, laba 20.000';
end $$;

-- Saldo: hanya ongkos jasa − pengeluaran (dana titipan tidak masuk)
do $$
declare b jsonb;
begin
  b := public.get_balance('2026-11-20');
  assert (b ->> 'balance')::int = 20000, 'saldo = 45.000 jasa − 25.000 biaya, bukan uang titipan: ' || (b ->> 'balance');
  update public.app_settings set setting_value = '{"opening_amount": 500000, "start_date": "2026-11-01"}' where setting_key = 'balance';
  b := public.get_balance('2026-11-20');
  assert (b ->> 'balance')::int = 520000, 'saldo awal + jasa − biaya';
  assert (public.get_balance('2026-11-19') ->> 'balance')::int = 500000, 'saldo per tanggal (sebelum transaksi)';
  update public.app_settings set setting_value = '{"opening_amount": 0, "start_date": "2026-11-21"}' where setting_key = 'balance';
  assert (public.get_balance('2026-11-20') ->> 'balance')::int = 0, 'transaksi sebelum tanggal mulai tidak dihitung';
  update public.app_settings set setting_value = '{"opening_amount": 0, "start_date": null}' where setting_key = 'balance';
  raise notice 'OK  saldo: saldo awal + pendapatan jasa − pengeluaran (titipan tidak masuk)';
end $$;

-- Idempoten: kirim ulang permintaan A yang sama
do $$
declare r jsonb;
begin
  r := public.save_order(jsonb_build_object(
    'client_request_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'transaction_date', '2026-11-20', 'service_fee', 99999, 'items', '[]'::jsonb));
  assert (r ->> '_duplicate')::boolean, 'harus ditandai duplikat';
  assert r ->> 'invoice_number' = 'KR-2611001', 'mengembalikan nota yang sama';
  assert (select count(*) from public.orders) = 2, 'tidak ada transaksi ganda';
  raise notice 'OK  idempoten: simpan ulang tidak membuat transaksi ganda';
end $$;

-- DP & pelunasan
do $$
declare c jsonb; v_id uuid;
begin
  c := public.save_order(jsonb_build_object(
    'transaction_date', '2026-11-21', 'service_fee', 15000, 'payment_status', 'DP',
    'paid_amount', 20000, 'order_status', 'Diproses',
    'items', jsonb_build_array(jsonb_build_object('item_name', 'Beras 5kg', 'quantity', 1, 'unit_price', 35000))));
  v_id := (c ->> 'id')::uuid;
  assert c ->> 'invoice_number' = 'KR-2611003', 'nomor nota C';
  assert (c ->> 'total_amount')::int = 50000 and (c ->> 'remaining_amount')::int = 30000, 'sisa DP';
  assert (public.get_financial_summary('2026-11-21', '2026-11-21') ->> 'receivables')::int = 30000, 'piutang DP';
  assert (public.get_financial_summary('2026-11-21', '2026-11-21') ->> 'cash_in')::int = 20000, 'DP bukan bayar penuh';
  assert (public.get_financial_summary('2026-11-21', '2026-11-21') ->> 'service_revenue')::int = 0, 'belum selesai ≠ pendapatan';
  assert (public.get_financial_summary('2026-11-21', '2026-11-21') ->> 'pending_revenue')::int = 15000, 'pendapatan tertunda';
  begin
    update public.orders set paid_amount = 50000 where id = v_id;
    assert false, 'DP >= total harus ditolak';
  exception when invalid_parameter_value then null;
  end;
  update public.orders set payment_status = 'Lunas', order_status = 'Selesai' where id = v_id;
  assert (select remaining_amount from public.orders where id = v_id) = 0, 'pelunasan';
  assert (public.get_financial_summary('2026-11-21', '2026-11-21') ->> 'service_revenue')::int = 15000, 'pendapatan setelah selesai';
  raise notice 'OK  DP, sisa bayar, pelunasan, pengakuan pendapatan';
end $$;

-- Edit transaksi → rekap ikut berubah; nomor nota tetap
do $$
declare a_id uuid := (select id from public.orders where invoice_number = 'KR-2611001'); r jsonb;
begin
  r := public.save_order(jsonb_build_object(
    'id', a_id, 'transaction_date', '2026-11-20', 'customer_name', 'Budi',
    'service_category_id', (select id from public.service_categories where name = 'Titip Belanja'),
    'service_fee', 30000, 'payment_status', 'Lunas', 'order_status', 'Selesai',
    'items', jsonb_build_array(jsonb_build_object('item_name', 'Sanmol drop', 'quantity', 2, 'unit_price', 23000))));
  assert r ->> 'invoice_number' = 'KR-2611001', 'nomor nota tidak berubah saat edit';
  assert (r ->> 'total_amount')::int = 76000, 'total setelah edit';
  assert jsonb_array_length(r -> 'items') = 1, 'item diganti';
  assert (public.get_financial_summary('2026-11-20', '2026-11-20') ->> 'service_revenue')::int = 55000, 'rekap ikut berubah';
  -- kembalikan
  r := public.save_order(jsonb_build_object(
    'id', a_id, 'transaction_date', '2026-11-20', 'customer_name', 'Budi',
    'service_fee', 20000, 'payment_status', 'Lunas', 'order_status', 'Selesai',
    'service_category_id', (select id from public.service_categories where name = 'Titip Belanja'),
    'items', jsonb_build_array(
       jsonb_build_object('item_name', 'Sanmol drop', 'quantity', 1, 'unit_price', 23000),
       jsonb_build_object('item_name', 'Bakso taytoh 12 butir', 'quantity', 1, 'unit_price', 48000))));
  assert (r ->> 'total_amount')::int = 91000, 'kembali 91.000';
  raise notice 'OK  edit transaksi memperbarui rekap, nomor nota tetap';
end $$;

-- Pembatalan: tidak dihitung, riwayat tetap ada
do $$
declare b_id uuid := (select id from public.orders where invoice_number = 'KR-2611002'); s jsonb;
begin
  update public.orders set order_status = 'Dibatalkan' where id = b_id;
  s := public.get_financial_summary('2026-11-20', '2026-11-20');
  assert (s ->> 'order_count')::int = 1 and (s ->> 'cancelled_count')::int = 1, 'hitungan batal';
  assert (s ->> 'service_revenue')::int = 20000 and (s ->> 'total_value')::int = 91000, 'batal tidak dihitung';
  assert exists (select 1 from public.orders where id = b_id), 'riwayat tetap ada';
  update public.orders set order_status = 'Selesai' where id = b_id;
  raise notice 'OK  pembatalan tidak dihitung, riwayat tetap tersimpan';
end $$;

-- Integritas: angka tidak bisa dimanipulasi langsung
do $$
declare a_id uuid := (select id from public.orders where invoice_number = 'KR-2611001');
begin
  update public.orders set goods_total = 1, total_amount = 5, service_revenue = 999999,
                           invoice_number = 'KR-HACK' where id = a_id;
  assert (select goods_total from public.orders where id = a_id) = 71000, 'goods_total dari item';
  assert (select total_amount from public.orders where id = a_id) = 91000, 'total dihitung ulang';
  assert (select service_revenue from public.orders where id = a_id) = 20000, 'pendapatan dihitung ulang';
  assert (select invoice_number from public.orders where id = a_id) = 'KR-2611001', 'nomor nota tidak bisa diubah';
  update public.order_items set unit_price = 25000 where order_id = a_id and item_name = 'Sanmol drop';
  assert (select total_amount from public.orders where id = a_id) = 93000, 'ubah item → total ikut berubah';
  update public.order_items set unit_price = 23000 where order_id = a_id and item_name = 'Sanmol drop';
  raise notice 'OK  total/pendapatan/nomor nota tidak bisa dimanipulasi langsung';
end $$;

-- Biaya tambahan penggantian biaya & diskon
do $$
declare r jsonb;
begin
  r := public.save_order(jsonb_build_object('transaction_date', '2026-11-22', 'service_fee', 20000,
        'additional_fee', 5000, 'additional_fee_is_revenue', false, 'discount', 2000,
        'payment_status', 'Belum Bayar', 'order_status', 'Selesai', 'items', '[]'::jsonb));
  assert (r ->> 'total_amount')::int = 23000, 'total dengan biaya tambahan & diskon';
  assert (r ->> 'service_revenue')::int = 18000, 'pendapatan = jasa - diskon (biaya tambahan penggantian tidak dihitung)';
  assert (r ->> 'trust_amount')::int = 5000, 'biaya penggantian masuk dana titipan';
  assert (r ->> 'remaining_amount')::int = 23000, 'belum bayar = piutang penuh';
  r := public.save_order(jsonb_build_object('transaction_date', '2026-11-22', 'service_fee', 20000,
        'additional_fee', 5000, 'discount', 2000, 'payment_status', 'Lunas', 'order_status', 'Selesai', 'items', '[]'::jsonb));
  assert (r ->> 'service_revenue')::int = 23000, 'biaya tambahan pendapatan';
  begin
    perform public.save_order(jsonb_build_object('service_fee', 1000, 'discount', 5000, 'items', '[]'::jsonb));
    assert false, 'diskon > total harus ditolak';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_order(jsonb_build_object('service_fee', 1000,
      'items', jsonb_build_array(jsonb_build_object('item_name', '  ', 'quantity', 1, 'unit_price', 1))));
    assert false, 'nama barang kosong harus ditolak';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.expenses (category_id, amount) values ((select id from public.expense_categories limit 1), 0);
    assert false, 'pengeluaran 0 harus ditolak';
  exception when check_violation then null;
  end;
  raise notice 'OK  biaya tambahan, diskon, validasi input';
end $$;

-- Hapus transaksi → item ikut terhapus; kategori terpakai tidak bisa dihapus
do $$
declare v_id uuid := (select id from public.orders where invoice_number = 'KR-2611003');
begin
  delete from public.orders where id = v_id;
  assert not exists (select 1 from public.order_items where order_id = v_id), 'item ikut terhapus';
  begin
    delete from public.expense_categories where name = 'Bensin';
    assert false, 'kategori terpakai tidak boleh terhapus';
  exception when foreign_key_violation then null;
  end;
  raise notice 'OK  hapus transaksi & perlindungan kategori';
end $$;

-- ===================== Sebagai PENYUSUP (akun lain) =====================
reset role;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
begin
  assert (select count(*) from public.orders) = 0, 'penyusup tidak boleh melihat order';
  assert (select count(*) from public.expenses) = 0, 'penyusup tidak boleh melihat pengeluaran';
  assert (select count(*) from public.app_settings) = 0, 'penyusup tidak boleh melihat pengaturan';
  assert (public.get_balance() ->> 'balance')::int = 0, 'penyusup tidak melihat saldo';
  begin
    perform public.save_order('{"service_fee":1000,"items":[]}'::jsonb);
    assert false, 'penyusup tidak boleh menyimpan';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.expenses (category_id, amount) values (gen_random_uuid(), 1000);
    assert false, 'penyusup tidak boleh insert';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set is_owner = true where id = auth.uid();
    assert false, 'tidak boleh mengangkat diri jadi pemilik';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK  RLS: akun bukan pemilik tidak bisa membaca/menulis';
end $$;

-- ===================== Sebagai ANONIM =====================
reset role;
set role anon;
reset request.jwt.claim.sub;
do $$
begin
  begin
    perform count(*) from public.orders;
    assert false, 'anon tidak boleh membaca';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_financial_summary(current_date, current_date);
    assert false, 'anon tidak boleh memanggil laporan';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_balance();
    assert false, 'anon tidak boleh melihat saldo';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK  RLS: pengunjung anonim ditolak';
end $$;
reset role;
