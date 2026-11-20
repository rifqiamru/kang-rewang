-- Pengujian skema Hans Batik. Dijalankan oleh tests/db/run.sh.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'pemilik@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'penyusup@example.com');

select id as svc_wa    from public.service_categories where name = 'WhatsApp' \gset
select id as svc_toko  from public.service_categories where name = 'Penjualan Toko' \gset
select id as cat_kain  from public.expense_categories where name = 'Pembelian kain / bahan' \gset
select id as cat_kemas from public.expense_categories where name = 'Kemasan' \gset

do $$ begin
  assert (select count(*) from public.profiles where is_owner) = 1, 'harus ada tepat 1 pemilik';
  assert (select is_owner from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'user pertama = pemilik';
  assert not (select is_owner from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'user kedua bukan pemilik';
  assert (select setting_value ->> 'paper' from public.app_settings where setting_key = 'letterhead') = 'A5', 'pengaturan kop bawaan';
  raise notice 'OK  pemilik tunggal & pengaturan kop';
end $$;

-- ===================== Sebagai PEMILIK =====================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Penjualan A: lewat WhatsApp, 2 barang + ongkos kirim
select public.save_order(jsonb_build_object(
  'client_request_id', 'aaaaaaaa-0000-0000-0000-000000000001',
  'transaction_date', '2026-11-20', 'customer_name', 'Budi', 'customer_phone', '0812-3456 789',
  'service_category_id', :'svc_wa', 'shipping_fee', 20000,
  'shipping_address', 'Jl. Merdeka 1, Purwokerto', 'courier', 'JNE REG', 'tracking_number', ' JNE123 ',
  'payment_status', 'Lunas', 'order_status', 'Selesai', 'payment_method', 'Transfer Bank',
  'items', jsonb_build_array(
     jsonb_build_object('item_name', 'Kemeja batik cap (L)', 'quantity', 2, 'unit_price', 175000),
     jsonb_build_object('item_name', 'Kain batik tulis parang', 'quantity', 1, 'unit_price', 475000))
)) as a \gset

-- Penjualan B: di toko, 1 barang tanpa ongkir
select (public.save_order(jsonb_build_object(
  'transaction_date', '2026-11-20', 'customer_name', 'Ani',
  'service_category_id', :'svc_toko', 'payment_status', 'Lunas', 'order_status', 'Selesai',
  'items', jsonb_build_array(jsonb_build_object('item_name', 'Selendang batik', 'quantity', 1, 'unit_price', 75000))
)) ->> 'id') as b_id \gset

insert into public.expenses (expense_date, category_id, description, amount)
values ('2026-11-20', :'cat_kain', 'Kain primisima 10 m', 300000),
       ('2026-11-20', :'cat_kemas', 'Paper bag', 25000);

do $$
declare a jsonb := public.get_order((select id from public.orders where client_request_id = 'aaaaaaaa-0000-0000-0000-000000000001'));
begin
  assert a ->> 'invoice_number' = 'HB-2611001', 'nomor nota A: ' || (a ->> 'invoice_number');
  assert (a ->> 'goods_total')::int = 825000, 'barang A';
  assert (a ->> 'total_amount')::int = 845000, 'total A';
  assert (a ->> 'sales_revenue')::int = 825000, 'pendapatan penjualan A (tanpa ongkir)';
  assert (a ->> 'trust_amount')::int = 20000, 'ongkir A = titipan';
  assert (a ->> 'paid_amount')::int = 845000 and (a ->> 'remaining_amount')::int = 0, 'Lunas → dibayar penuh';
  assert a ->> 'customer_phone' = '08123456789', 'nomor HP dinormalisasi';
  assert a ->> 'courier' = 'JNE REG' and a ->> 'tracking_number' = 'JNE123', 'kurir & resi tersimpan (resi dirapikan)';
  assert a ->> 'shipping_address' = 'Jl. Merdeka 1, Purwokerto', 'alamat kirim';
  assert jsonb_array_length(a -> 'items') = 2, 'jumlah item A';
  assert (a -> 'items' -> 0 ->> 'subtotal')::int = 350000, 'subtotal item';
  assert a ->> 'service_name' = 'WhatsApp', 'nama kategori';
  assert (select invoice_number from public.orders where customer_name = 'Ani') = 'HB-2611002', 'nomor nota B';
  raise notice 'OK  nota A & B: nomor HB-, total, subtotal, alamat/kurir/resi';
end $$;

-- Skenario keuangan toko batik
do $$
declare s jsonb := public.get_financial_summary('2026-11-20', '2026-11-20');
begin
  assert (s ->> 'order_count')::int = 2, 'jumlah order';
  assert (s ->> 'total_value')::int = 920000, 'total nilai transaksi ' || (s ->> 'total_value');
  assert (s ->> 'cash_in')::int = 920000, 'uang masuk';
  assert (s ->> 'sales_revenue')::int = 900000, 'pendapatan penjualan ' || (s ->> 'sales_revenue');
  assert (s ->> 'trust_funds')::int = 20000, 'ongkir titipan';
  assert (s ->> 'expense_total')::int = 325000, 'pengeluaran';
  assert (s ->> 'net_profit')::int = 575000, 'keuntungan bersih ' || (s ->> 'net_profit');
  assert (s ->> 'receivables')::int = 0, 'piutang';
  assert (select net_profit from public.get_daily_series('2026-11-20', '2026-11-20')) = 575000, 'deret harian';
  raise notice 'OK  skenario keuangan: nilai 920.000, penjualan 900.000, ongkir 20.000, biaya 325.000, laba 575.000';
end $$;

-- Saldo: penjualan − pengeluaran (ongkir titipan tidak masuk)
do $$
declare b jsonb;
begin
  b := public.get_balance('2026-11-20');
  assert (b ->> 'balance')::int = 575000, 'saldo = 900.000 − 325.000: ' || (b ->> 'balance');
  update public.app_settings set setting_value = '{"opening_amount": 500000, "start_date": "2026-11-01"}' where setting_key = 'balance';
  b := public.get_balance('2026-11-20');
  assert (b ->> 'balance')::int = 1075000, 'saldo awal + penjualan − biaya';
  assert (public.get_balance('2026-11-19') ->> 'balance')::int = 500000, 'saldo per tanggal (sebelum transaksi)';
  update public.app_settings set setting_value = '{"opening_amount": 0, "start_date": "2026-11-21"}' where setting_key = 'balance';
  assert (public.get_balance('2026-11-20') ->> 'balance')::int = 0, 'transaksi sebelum tanggal mulai tidak dihitung';
  update public.app_settings set setting_value = '{"opening_amount": 0, "start_date": null}' where setting_key = 'balance';
  raise notice 'OK  saldo: saldo awal + penjualan − pengeluaran (ongkir tidak masuk)';
end $$;

-- Idempoten: kirim ulang permintaan A yang sama
do $$
declare r jsonb;
begin
  r := public.save_order(jsonb_build_object(
    'client_request_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'transaction_date', '2026-11-20', 'shipping_fee', 99999, 'items', '[]'::jsonb));
  assert (r ->> '_duplicate')::boolean, 'harus ditandai duplikat';
  assert r ->> 'invoice_number' = 'HB-2611001', 'mengembalikan nota yang sama';
  assert (select count(*) from public.orders) = 2, 'tidak ada transaksi ganda';
  raise notice 'OK  idempoten: simpan ulang tidak membuat transaksi ganda';
end $$;

-- DP & pelunasan (pesanan khusus)
do $$
declare c jsonb; v_id uuid;
begin
  c := public.save_order(jsonb_build_object(
    'transaction_date', '2026-11-21', 'shipping_fee', 15000, 'payment_status', 'DP',
    'paid_amount', 200000, 'order_status', 'Diproses',
    'items', jsonb_build_array(jsonb_build_object('item_name', 'Batik tulis pesanan', 'quantity', 1, 'unit_price', 600000))));
  v_id := (c ->> 'id')::uuid;
  assert c ->> 'invoice_number' = 'HB-2611003', 'nomor nota C';
  assert (c ->> 'total_amount')::int = 615000 and (c ->> 'remaining_amount')::int = 415000, 'sisa DP';
  assert (public.get_financial_summary('2026-11-21', '2026-11-21') ->> 'receivables')::int = 415000, 'piutang DP';
  assert (public.get_financial_summary('2026-11-21', '2026-11-21') ->> 'cash_in')::int = 200000, 'DP bukan bayar penuh';
  assert (public.get_financial_summary('2026-11-21', '2026-11-21') ->> 'sales_revenue')::int = 0, 'belum selesai ≠ pendapatan';
  assert (public.get_financial_summary('2026-11-21', '2026-11-21') ->> 'pending_revenue')::int = 600000, 'pendapatan tertunda';
  begin
    update public.orders set paid_amount = 615000 where id = v_id;
    assert false, 'DP >= total harus ditolak';
  exception when invalid_parameter_value then null;
  end;
  update public.orders set payment_status = 'Lunas', order_status = 'Dikirim' where id = v_id;
  assert (select remaining_amount from public.orders where id = v_id) = 0, 'pelunasan';
  assert (public.get_financial_summary('2026-11-21', '2026-11-21') ->> 'sales_revenue')::int = 0, 'Dikirim belum Selesai';
  update public.orders set order_status = 'Selesai' where id = v_id;
  assert (public.get_financial_summary('2026-11-21', '2026-11-21') ->> 'sales_revenue')::int = 600000, 'pendapatan setelah selesai';
  begin
    update public.orders set order_status = 'Menunggu' where id = v_id;
    assert false, 'status lama tidak berlaku';
  exception when check_violation then null;
  end;
  raise notice 'OK  DP, sisa bayar, pelunasan, status Pesanan/Diproses/Dikirim/Selesai';
end $$;

-- Edit transaksi → rekap ikut berubah; nomor nota tetap
do $$
declare a_id uuid := (select id from public.orders where invoice_number = 'HB-2611001'); r jsonb;
begin
  r := public.save_order(jsonb_build_object(
    'id', a_id, 'transaction_date', '2026-11-20', 'customer_name', 'Budi',
    'service_category_id', (select id from public.service_categories where name = 'WhatsApp'),
    'shipping_fee', 30000, 'payment_status', 'Lunas', 'order_status', 'Selesai',
    'items', jsonb_build_array(jsonb_build_object('item_name', 'Kemeja batik cap (L)', 'quantity', 2, 'unit_price', 175000))));
  assert r ->> 'invoice_number' = 'HB-2611001', 'nomor nota tidak berubah saat edit';
  assert (r ->> 'total_amount')::int = 380000, 'total setelah edit';
  assert jsonb_array_length(r -> 'items') = 1, 'item diganti';
  assert r ->> 'tracking_number' = '', 'resi dikosongkan saat edit tanpa resi';
  assert (public.get_financial_summary('2026-11-20', '2026-11-20') ->> 'sales_revenue')::int = 425000, 'rekap ikut berubah';
  -- kembalikan
  r := public.save_order(jsonb_build_object(
    'id', a_id, 'transaction_date', '2026-11-20', 'customer_name', 'Budi',
    'shipping_fee', 20000, 'payment_status', 'Lunas', 'order_status', 'Selesai',
    'service_category_id', (select id from public.service_categories where name = 'WhatsApp'),
    'items', jsonb_build_array(
       jsonb_build_object('item_name', 'Kemeja batik cap (L)', 'quantity', 2, 'unit_price', 175000),
       jsonb_build_object('item_name', 'Kain batik tulis parang', 'quantity', 1, 'unit_price', 475000))));
  assert (r ->> 'total_amount')::int = 845000, 'kembali 845.000';
  raise notice 'OK  edit transaksi memperbarui rekap, nomor nota tetap';
end $$;

-- Pembatalan: tidak dihitung, riwayat tetap ada
do $$
declare b_id uuid := (select id from public.orders where invoice_number = 'HB-2611002'); s jsonb;
begin
  update public.orders set order_status = 'Dibatalkan' where id = b_id;
  s := public.get_financial_summary('2026-11-20', '2026-11-20');
  assert (s ->> 'order_count')::int = 1 and (s ->> 'cancelled_count')::int = 1, 'hitungan batal';
  assert (s ->> 'sales_revenue')::int = 825000 and (s ->> 'total_value')::int = 845000, 'batal tidak dihitung';
  assert exists (select 1 from public.orders where id = b_id), 'riwayat tetap ada';
  update public.orders set order_status = 'Selesai' where id = b_id;
  raise notice 'OK  pembatalan tidak dihitung, riwayat tetap tersimpan';
end $$;

-- Integritas: angka tidak bisa dimanipulasi langsung
do $$
declare a_id uuid := (select id from public.orders where invoice_number = 'HB-2611001');
begin
  update public.orders set goods_total = 1, total_amount = 5, sales_revenue = 999999,
                           invoice_number = 'HB-HACK' where id = a_id;
  assert (select goods_total from public.orders where id = a_id) = 825000, 'goods_total dari item';
  assert (select total_amount from public.orders where id = a_id) = 845000, 'total dihitung ulang';
  assert (select sales_revenue from public.orders where id = a_id) = 825000, 'pendapatan dihitung ulang';
  assert (select invoice_number from public.orders where id = a_id) = 'HB-2611001', 'nomor nota tidak bisa diubah';
  update public.order_items set unit_price = 500000 where order_id = a_id and item_name = 'Kain batik tulis parang';
  assert (select total_amount from public.orders where id = a_id) = 870000, 'ubah item → total ikut berubah';
  update public.order_items set unit_price = 475000 where order_id = a_id and item_name = 'Kain batik tulis parang';
  raise notice 'OK  total/pendapatan/nomor nota tidak bisa dimanipulasi langsung';
end $$;

-- Ongkir, biaya tambahan & diskon
do $$
declare r jsonb;
begin
  r := public.save_order(jsonb_build_object('transaction_date', '2026-11-22', 'shipping_fee', 20000,
        'additional_fee', 5000, 'additional_fee_is_revenue', false, 'discount', 2000,
        'payment_status', 'Belum Bayar', 'order_status', 'Selesai',
        'items', jsonb_build_array(jsonb_build_object('item_name', 'Daster batik', 'quantity', 1, 'unit_price', 100000))));
  assert (r ->> 'total_amount')::int = 123000, 'total dengan ongkir, biaya tambahan & diskon';
  assert (r ->> 'sales_revenue')::int = 98000, 'pendapatan = barang − diskon (ongkir & penggantian tidak dihitung)';
  assert (r ->> 'trust_amount')::int = 25000, 'ongkir + biaya penggantian = titipan';
  assert (r ->> 'remaining_amount')::int = 123000, 'belum bayar = piutang penuh';
  r := public.save_order(jsonb_build_object('transaction_date', '2026-11-22',
        'additional_fee', 5000, 'discount', 2000, 'payment_status', 'Lunas', 'order_status', 'Selesai',
        'items', jsonb_build_array(jsonb_build_object('item_name', 'Daster batik', 'quantity', 1, 'unit_price', 100000))));
  assert (r ->> 'sales_revenue')::int = 103000, 'biaya tambahan (mis. jahit) = pendapatan';
  begin
    perform public.save_order(jsonb_build_object('shipping_fee', 1000, 'discount', 5000, 'items', '[]'::jsonb));
    assert false, 'diskon > total harus ditolak';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_order(jsonb_build_object('shipping_fee', 1000,
      'items', jsonb_build_array(jsonb_build_object('item_name', '  ', 'quantity', 1, 'unit_price', 1))));
    assert false, 'nama barang kosong harus ditolak';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_order(jsonb_build_object('tracking_number', repeat('x', 61),
      'items', jsonb_build_array(jsonb_build_object('item_name', 'x', 'quantity', 1, 'unit_price', 1))));
    assert false, 'resi terlalu panjang harus ditolak';
  exception when check_violation then null;
  end;
  begin
    insert into public.expenses (category_id, amount) values ((select id from public.expense_categories limit 1), 0);
    assert false, 'pengeluaran 0 harus ditolak';
  exception when check_violation then null;
  end;
  raise notice 'OK  ongkir, biaya tambahan, diskon, validasi input';
end $$;

-- Hapus transaksi → item ikut terhapus; kategori terpakai tidak bisa dihapus
do $$
declare v_id uuid := (select id from public.orders where invoice_number = 'HB-2611003');
begin
  delete from public.orders where id = v_id;
  assert not exists (select 1 from public.order_items where order_id = v_id), 'item ikut terhapus';
  begin
    delete from public.expense_categories where name = 'Pembelian kain / bahan';
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
    perform public.save_order('{"shipping_fee":1000,"items":[]}'::jsonb);
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
