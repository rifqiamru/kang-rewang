-- =====================================================================
-- KANG REWANG MANAGEMENT SYSTEM — Skema Database Supabase (PostgreSQL)
-- ---------------------------------------------------------------------
-- Jalankan seluruh file ini SEKALI di Supabase Dashboard → SQL Editor.
-- File ini idempotent untuk objek fungsi/view/policy, dan aman dijalankan
-- ulang untuk memperbarui fungsi (tabel memakai IF NOT EXISTS).
--
-- Prinsip:
--   * Semua nominal uang = INTEGER (Rupiah, tanpa desimal).
--   * Primary key = UUID, waktu = TIMESTAMPTZ, zona waktu = Asia/Jakarta.
--   * Perhitungan penting (total, sisa bayar, pendapatan jasa, dana titipan,
--     nomor nota) dilakukan DI DATABASE lewat trigger & fungsi, bukan hanya
--     di JavaScript.
--   * RLS aktif di semua tabel; hanya akun PEMILIK yang bisa mengakses.
-- =====================================================================

create extension if not exists pgcrypto;
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- 1. PROFIL & PEMILIK
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  is_owner    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Hanya boleh ada SATU pemilik.
create unique index if not exists profiles_single_owner
  on public.profiles (is_owner) where is_owner;

-- Apakah user yang sedang login adalah pemilik usaha?
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_owner
  );
$$;

-- Akun PERTAMA yang terdaftar otomatis menjadi pemilik.
-- Akun berikutnya (jika pendaftaran tidak dimatikan) TIDAK punya akses data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, is_owner)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    not exists (select 1 from public.profiles where is_owner)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Jika akun pemilik sudah dibuat SEBELUM skema ini dijalankan:
-- jadikan user paling awal sebagai pemilik.
insert into public.profiles (id, full_name, is_owner)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', ''), true
from auth.users u
where not exists (select 1 from public.profiles where is_owner)
order by u.created_at
limit 1
on conflict (id) do update set is_owner = true;

-- ---------------------------------------------------------------------
-- 2. MASTER DATA
-- ---------------------------------------------------------------------
create table if not exists public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists service_categories_name_key
  on public.service_categories (lower(btrim(name)));

create table if not exists public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists expense_categories_name_key
  on public.expense_categories (lower(btrim(name)));

create table if not exists public.app_settings (
  id             uuid primary key default gen_random_uuid(),
  setting_key    text not null unique check (setting_key ~ '^[a-z_]{1,40}$'),
  setting_value  jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);

-- Penghitung nomor nota per prefix + bulan (YYMM). Dipakai secara atomik.
create table if not exists public.invoice_counters (
  prefix       text not null,
  period       text not null check (period ~ '^[0-9]{4}$'),
  last_number  integer not null default 0 check (last_number >= 0),
  updated_at   timestamptz not null default now(),
  primary key (prefix, period)
);

-- ---------------------------------------------------------------------
-- 3. TRANSAKSI
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id                         uuid primary key default gen_random_uuid(),
  invoice_number             text not null unique,
  client_request_id          uuid unique,  -- kunci idempoten: cegah simpan ganda
  transaction_date           date not null default (now() at time zone 'Asia/Jakarta')::date,
  customer_name              text not null default '' check (char_length(customer_name) <= 100),
  customer_phone             text not null default '' check (customer_phone ~ '^[0-9+]{0,20}$'),
  service_category_id        uuid references public.service_categories (id) on delete restrict,
  description                text not null default '' check (char_length(description) <= 500),
  pickup_location            text not null default '' check (char_length(pickup_location) <= 200),
  destination                text not null default '' check (char_length(destination) <= 200),
  distance                   numeric(8,2) check (distance is null or distance >= 0),

  -- Komponen biaya (Rupiah)
  goods_total                integer not null default 0 check (goods_total >= 0),   -- dari order_items
  service_fee                integer not null default 0 check (service_fee >= 0),
  additional_fee             integer not null default 0 check (additional_fee >= 0),
  additional_fee_is_revenue  boolean not null default true,  -- false = hanya penggantian biaya
  discount                   integer not null default 0 check (discount >= 0),
  total_amount               integer not null default 0 check (total_amount >= 0),  -- dihitung trigger
  paid_amount                integer not null default 0 check (paid_amount >= 0),
  remaining_amount           integer not null default 0 check (remaining_amount >= 0), -- dihitung trigger

  -- Pemisahan akuntansi (dihitung trigger)
  service_revenue            integer not null default 0,  -- pendapatan jasa
  trust_amount               integer not null default 0 check (trust_amount >= 0), -- dana titipan

  payment_method             text not null default 'Tunai' check (char_length(payment_method) <= 40),
  payment_status             text not null default 'Belum Bayar'
                             check (payment_status in ('Belum Bayar', 'DP', 'Lunas')),
  order_status               text not null default 'Menunggu'
                             check (order_status in ('Booking', 'Menunggu', 'Diproses', 'Selesai', 'Dibatalkan')),
  notes                      text not null default '' check (char_length(notes) <= 1000),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  item_name   text not null check (char_length(btrim(item_name)) between 1 and 150),
  quantity    numeric(10,2) not null default 1 check (quantity > 0),
  unit_price  integer not null default 0 check (unit_price >= 0),
  subtotal    integer not null default 0 check (subtotal >= 0),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  expense_date    date not null default (now() at time zone 'Asia/Jakarta')::date,
  category_id     uuid not null references public.expense_categories (id) on delete restrict,
  description     text not null default '' check (char_length(description) <= 200),
  amount          integer not null check (amount > 0),
  payment_method  text not null default 'Tunai' check (char_length(payment_method) <= 40),
  notes           text not null default '' check (char_length(notes) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. INDEX
-- ---------------------------------------------------------------------
create index if not exists orders_transaction_date_idx on public.orders (transaction_date desc, created_at desc);
create index if not exists orders_order_status_idx     on public.orders (order_status);
create index if not exists orders_payment_status_idx   on public.orders (payment_status);
create index if not exists orders_service_category_idx on public.orders (service_category_id);
create index if not exists orders_customer_phone_idx   on public.orders (customer_phone);
create index if not exists orders_customer_name_trgm   on public.orders using gin (customer_name extensions.gin_trgm_ops);
create index if not exists orders_invoice_trgm         on public.orders using gin (invoice_number extensions.gin_trgm_ops);
create index if not exists order_items_order_idx       on public.order_items (order_id, sort_order);
create index if not exists expenses_date_idx           on public.expenses (expense_date desc, created_at desc);
create index if not exists expenses_category_idx       on public.expenses (category_id);

-- ---------------------------------------------------------------------
-- 5. TRIGGER: updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
drop trigger if exists app_settings_updated_at on public.app_settings;
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. TRIGGER: perhitungan item & order (sumber kebenaran angka)
-- ---------------------------------------------------------------------

-- Subtotal item = jumlah × harga satuan (dibulatkan ke Rupiah).
create or replace function public.order_items_compute()
returns trigger language plpgsql as $$
begin
  new.item_name := btrim(new.item_name);
  new.subtotal  := round(new.quantity * new.unit_price)::integer;
  return new;
end;
$$;

drop trigger if exists order_items_compute on public.order_items;
create trigger order_items_compute before insert or update on public.order_items
  for each row execute function public.order_items_compute();

-- Setiap perubahan item → hitung ulang order induk (kecuali saat save_order
-- sedang menulis banyak item sekaligus; save_order menghitung ulang di akhir).
create or replace function public.order_items_sync_parent()
returns trigger language plpgsql as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
begin
  if coalesce(current_setting('kr.bulk_items', true), '') = 'on' then
    return null;
  end if;
  update public.orders set updated_at = now() where id = v_order_id;
  if tg_op = 'UPDATE' and new.order_id is distinct from old.order_id then
    update public.orders set updated_at = now() where id = old.order_id;
  end if;
  return null;
end;
$$;

drop trigger if exists order_items_sync_parent on public.order_items;
create trigger order_items_sync_parent after insert or update or delete on public.order_items
  for each row execute function public.order_items_sync_parent();

-- Rumus utama (lihat README "Aturan Akuntansi"):
--   total_amount     = goods_total + service_fee + additional_fee - discount
--   service_revenue  = service_fee + additional_fee (jika pendapatan) - discount
--   trust_amount     = goods_total + additional_fee (jika hanya penggantian biaya)
--   remaining_amount = total_amount - paid_amount
-- Status pembayaran menentukan paid_amount:
--   Lunas → paid = total, Belum Bayar → paid = 0, DP → 0 < paid < total.
create or replace function public.orders_compute()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    -- Nomor nota & kunci idempoten tidak boleh diubah.
    new.invoice_number    := old.invoice_number;
    new.client_request_id := old.client_request_id;
    new.created_at        := old.created_at;
  end if;

  -- goods_total SELALU diturunkan dari order_items, kecuali saat save_order
  -- menulis item secara massal (nilainya sudah dihitung dari item yang sama).
  if coalesce(current_setting('kr.bulk_items', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.goods_total := 0;
    else
      select coalesce(sum(subtotal), 0)::integer into new.goods_total
      from public.order_items where order_id = new.id;
    end if;
  end if;

  new.customer_name   := btrim(coalesce(new.customer_name, ''));
  new.customer_phone  := regexp_replace(coalesce(new.customer_phone, ''), '[^0-9+]', '', 'g');
  new.service_fee     := coalesce(new.service_fee, 0);
  new.additional_fee  := coalesce(new.additional_fee, 0);
  new.discount        := coalesce(new.discount, 0);
  new.paid_amount     := coalesce(new.paid_amount, 0);

  new.total_amount := new.goods_total + new.service_fee + new.additional_fee - new.discount;
  if new.total_amount < 0 then
    raise exception 'Diskon (Rp%) melebihi total tagihan.', new.discount
      using errcode = '22023';
  end if;

  new.service_revenue := new.service_fee
                       + case when new.additional_fee_is_revenue then new.additional_fee else 0 end
                       - new.discount;
  new.trust_amount    := new.goods_total
                       + case when new.additional_fee_is_revenue then 0 else new.additional_fee end;

  if new.payment_status = 'Lunas' then
    new.paid_amount := new.total_amount;
  elsif new.payment_status = 'Belum Bayar' then
    new.paid_amount := 0;
  elsif new.payment_status = 'DP' then
    if new.paid_amount <= 0 then
      raise exception 'Nominal DP harus lebih dari Rp0.' using errcode = '22023';
    end if;
    if new.paid_amount >= new.total_amount then
      raise exception 'Nominal DP (Rp%) harus lebih kecil dari total tagihan (Rp%). Pilih status Lunas jika sudah dibayar penuh.',
        new.paid_amount, new.total_amount using errcode = '22023';
    end if;
  end if;

  new.remaining_amount := new.total_amount - new.paid_amount;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_compute on public.orders;
create trigger orders_compute before insert or update on public.orders
  for each row execute function public.orders_compute();

-- ---------------------------------------------------------------------
-- 7. NOMOR NOTA OTOMATIS (atomik, aman dari duplikasi)
-- ---------------------------------------------------------------------
create or replace function public.next_invoice_number(p_date date)
returns text
language plpgsql
as $$
declare
  v_cfg     jsonb;
  v_prefix  text;
  v_digits  integer;
  v_period  text := to_char(p_date, 'YYMM');
  v_n       integer;
  v_number  text;
begin
  if not public.is_owner() then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  select setting_value into v_cfg from public.app_settings where setting_key = 'invoice';
  v_prefix := upper(regexp_replace(coalesce(v_cfg ->> 'prefix', 'KR'), '[^A-Za-z0-9]', '', 'g'));
  if v_prefix = '' then v_prefix := 'KR'; end if;
  v_digits := least(greatest(coalesce((v_cfg ->> 'digits')::integer, 3), 2), 6);

  loop
    -- INSERT ... ON CONFLICT DO UPDATE mengunci baris penghitung, sehingga dua
    -- penyimpanan bersamaan tidak akan pernah mendapat nomor yang sama.
    insert into public.invoice_counters as c (prefix, period, last_number)
    values (v_prefix, v_period, 1)
    on conflict (prefix, period)
      do update set last_number = c.last_number + 1, updated_at = now()
    returning c.last_number into v_n;

    v_number := v_prefix || '-' || v_period
             || lpad(v_n::text, greatest(v_digits, char_length(v_n::text)), '0');
    -- Pengaman ekstra bila ada nomor yang pernah dibuat manual.
    exit when not exists (select 1 from public.orders where invoice_number = v_number);
  end loop;
  return v_number;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. FUNGSI TRANSAKSI (RPC)
-- ---------------------------------------------------------------------

-- Ambil satu order lengkap dengan item & nama layanan.
create or replace function public.get_order(p_id uuid)
returns jsonb
language sql
stable
as $$
  select to_jsonb(o)
    || jsonb_build_object(
         'service_name', sc.name,
         'items', coalesce((
            select jsonb_agg(to_jsonb(i) order by i.sort_order, i.created_at)
            from public.order_items i where i.order_id = o.id
         ), '[]'::jsonb))
  from public.orders o
  left join public.service_categories sc on sc.id = o.service_category_id
  where o.id = p_id;
$$;

-- Simpan (buat baru / ubah) transaksi beserta itemnya dalam SATU transaksi
-- database. Nomor nota dibuat di sini. Bersifat idempoten lewat
-- client_request_id: mengirim ulang permintaan yang sama tidak membuat
-- transaksi ganda.
create or replace function public.save_order(p jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_id        uuid := nullif(p ->> 'id', '')::uuid;
  v_req       uuid := nullif(p ->> 'client_request_id', '')::uuid;
  v_items     jsonb := coalesce(p -> 'items', '[]'::jsonb);
  v_date      date := coalesce(nullif(p ->> 'transaction_date', '')::date,
                               (now() at time zone 'Asia/Jakarta')::date);
  v_goods     integer := 0;
  v_existing  uuid;
  v_item      jsonb;
  v_qty       numeric;
  v_price     integer;
begin
  if not public.is_owner() then
    raise exception 'Akses ditolak.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Format rincian barang tidak valid.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_items) > 100 then
    raise exception 'Maksimal 100 item per nota.' using errcode = '22023';
  end if;

  -- Idempoten: permintaan yang sama sudah pernah tersimpan.
  if v_id is null and v_req is not null then
    select id into v_existing from public.orders where client_request_id = v_req;
    if found then
      return public.get_order(v_existing) || jsonb_build_object('_duplicate', true);
    end if;
  end if;

  -- Validasi & hitung total barang dari item.
  for v_item in select * from jsonb_array_elements(v_items) loop
    if char_length(btrim(coalesce(v_item ->> 'item_name', ''))) = 0 then
      raise exception 'Nama barang tidak boleh kosong.' using errcode = '22023';
    end if;
    v_qty   := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1);
    v_price := coalesce(nullif(v_item ->> 'unit_price', '')::integer, 0);
    if v_qty <= 0 then
      raise exception 'Jumlah barang "%" harus lebih dari 0.', v_item ->> 'item_name' using errcode = '22023';
    end if;
    if v_price < 0 then
      raise exception 'Harga barang "%" tidak boleh negatif.', v_item ->> 'item_name' using errcode = '22023';
    end if;
    v_goods := v_goods + round(round(v_qty, 2) * v_price)::integer;
  end loop;

  if nullif(p ->> 'service_category_id', '') is not null and not exists (
    select 1 from public.service_categories where id = (p ->> 'service_category_id')::uuid
  ) then
    raise exception 'Jenis layanan tidak ditemukan.' using errcode = '22023';
  end if;

  perform set_config('kr.bulk_items', 'on', true);

  if v_id is null then
    begin
      insert into public.orders (
        invoice_number, client_request_id, transaction_date, customer_name, customer_phone,
        service_category_id, description, pickup_location, destination, distance,
        goods_total, service_fee, additional_fee, additional_fee_is_revenue, discount,
        paid_amount, payment_method, payment_status, order_status, notes
      ) values (
        public.next_invoice_number(v_date), v_req, v_date,
        coalesce(p ->> 'customer_name', ''), coalesce(p ->> 'customer_phone', ''),
        nullif(p ->> 'service_category_id', '')::uuid,
        coalesce(p ->> 'description', ''), coalesce(p ->> 'pickup_location', ''),
        coalesce(p ->> 'destination', ''), nullif(p ->> 'distance', '')::numeric,
        v_goods,
        coalesce(nullif(p ->> 'service_fee', '')::integer, 0),
        coalesce(nullif(p ->> 'additional_fee', '')::integer, 0),
        coalesce((p ->> 'additional_fee_is_revenue')::boolean, true),
        coalesce(nullif(p ->> 'discount', '')::integer, 0),
        coalesce(nullif(p ->> 'paid_amount', '')::integer, 0),
        coalesce(nullif(p ->> 'payment_method', ''), 'Tunai'),
        coalesce(nullif(p ->> 'payment_status', ''), 'Belum Bayar'),
        coalesce(nullif(p ->> 'order_status', ''), 'Menunggu'),
        coalesce(p ->> 'notes', '')
      ) returning id into v_id;
    exception when unique_violation then
      -- Dua permintaan identik datang bersamaan: kembalikan yang sudah ada.
      select id into v_existing from public.orders where client_request_id = v_req;
      if v_existing is null then raise; end if;
      perform set_config('kr.bulk_items', 'off', true);
      return public.get_order(v_existing) || jsonb_build_object('_duplicate', true);
    end;
  else
    update public.orders set
      transaction_date          = v_date,
      customer_name             = coalesce(p ->> 'customer_name', ''),
      customer_phone            = coalesce(p ->> 'customer_phone', ''),
      service_category_id       = nullif(p ->> 'service_category_id', '')::uuid,
      description               = coalesce(p ->> 'description', ''),
      pickup_location           = coalesce(p ->> 'pickup_location', ''),
      destination               = coalesce(p ->> 'destination', ''),
      distance                  = nullif(p ->> 'distance', '')::numeric,
      goods_total               = v_goods,
      service_fee               = coalesce(nullif(p ->> 'service_fee', '')::integer, 0),
      additional_fee            = coalesce(nullif(p ->> 'additional_fee', '')::integer, 0),
      additional_fee_is_revenue = coalesce((p ->> 'additional_fee_is_revenue')::boolean, true),
      discount                  = coalesce(nullif(p ->> 'discount', '')::integer, 0),
      paid_amount               = coalesce(nullif(p ->> 'paid_amount', '')::integer, 0),
      payment_method            = coalesce(nullif(p ->> 'payment_method', ''), 'Tunai'),
      payment_status            = coalesce(nullif(p ->> 'payment_status', ''), 'Belum Bayar'),
      order_status              = coalesce(nullif(p ->> 'order_status', ''), 'Menunggu'),
      notes                     = coalesce(p ->> 'notes', '')
    where id = v_id;
    if not found then
      raise exception 'Transaksi tidak ditemukan.' using errcode = 'P0002';
    end if;
    delete from public.order_items where order_id = v_id;
  end if;

  insert into public.order_items (order_id, item_name, quantity, unit_price, sort_order)
  select v_id,
         btrim(e.value ->> 'item_name'),
         round(coalesce(nullif(e.value ->> 'quantity', '')::numeric, 1), 2),
         coalesce(nullif(e.value ->> 'unit_price', '')::integer, 0),
         e.ordinality::integer
  from jsonb_array_elements(v_items) with ordinality as e(value, ordinality);

  -- Hitung ulang dari item yang benar-benar tersimpan (verifikasi akhir).
  perform set_config('kr.bulk_items', 'off', true);
  update public.orders set updated_at = now() where id = v_id;

  return public.get_order(v_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 9. FUNGSI LAPORAN — satu sumber angka untuk Dashboard, Rekap, Laporan
-- ---------------------------------------------------------------------
-- Aturan:
--   * Order "Dibatalkan" tidak dihitung sama sekali (tetap tersimpan).
--   * Pendapatan jasa diakui hanya dari order berstatus "Selesai".
--   * Uang masuk = paid_amount (DP dihitung sebesar DP, bukan total).
--   * Piutang = remaining_amount order yang tidak dibatalkan.
--   * Keuntungan bersih = pendapatan jasa − pengeluaran operasional.
create or replace function public.get_financial_summary(p_start date, p_end date)
returns jsonb
language sql
stable
as $$
  with o as (
    select * from public.orders
    where transaction_date between p_start and p_end
  ),
  e as (
    select * from public.expenses
    where expense_date between p_start and p_end
  ),
  agg as (
    select
      count(*) filter (where order_status <> 'Dibatalkan')                                   as order_count,
      count(*) filter (where order_status = 'Selesai')                                       as completed_count,
      count(*) filter (where order_status not in ('Selesai', 'Dibatalkan'))                  as open_count,
      count(*) filter (where order_status = 'Dibatalkan')                                    as cancelled_count,
      count(*) filter (where order_status <> 'Dibatalkan' and payment_status <> 'Lunas')     as unpaid_count,
      coalesce(sum(total_amount)     filter (where order_status <> 'Dibatalkan'), 0)         as total_value,
      coalesce(sum(paid_amount)      filter (where order_status <> 'Dibatalkan'), 0)         as cash_in,
      coalesce(sum(remaining_amount) filter (where order_status <> 'Dibatalkan'), 0)         as receivables,
      coalesce(sum(trust_amount)     filter (where order_status <> 'Dibatalkan'), 0)         as trust_funds,
      coalesce(sum(service_revenue)  filter (where order_status = 'Selesai'), 0)             as service_revenue,
      coalesce(sum(service_revenue)  filter (where order_status not in ('Selesai', 'Dibatalkan')), 0) as pending_revenue
    from o
  ),
  ex as (
    select count(*) as expense_count, coalesce(sum(amount), 0) as expense_total from e
  ),
  bycat as (
    select coalesce(jsonb_agg(jsonb_build_object('category', c.name, 'total', t.total, 'count', t.cnt)
                              order by t.total desc), '[]'::jsonb) as list
    from (select category_id, sum(amount) as total, count(*) as cnt from e group by category_id) t
    join public.expense_categories c on c.id = t.category_id
  ),
  bysvc as (
    select coalesce(jsonb_agg(jsonb_build_object('service', coalesce(s.name, 'Tanpa kategori'),
                                                 'count', t.cnt, 'revenue', t.revenue)
                              order by t.revenue desc), '[]'::jsonb) as list
    from (select service_category_id, count(*) as cnt,
                 coalesce(sum(service_revenue) filter (where order_status = 'Selesai'), 0) as revenue
          from o where order_status <> 'Dibatalkan' group by service_category_id) t
    left join public.service_categories s on s.id = t.service_category_id
  )
  select jsonb_build_object(
    'start', p_start,
    'end', p_end,
    'order_count', agg.order_count,
    'completed_count', agg.completed_count,
    'open_count', agg.open_count,
    'cancelled_count', agg.cancelled_count,
    'unpaid_count', agg.unpaid_count,
    'total_value', agg.total_value,
    'cash_in', agg.cash_in,
    'receivables', agg.receivables,
    'trust_funds', agg.trust_funds,
    'service_revenue', agg.service_revenue,
    'pending_revenue', agg.pending_revenue,
    'expense_count', ex.expense_count,
    'expense_total', ex.expense_total,
    'net_profit', agg.service_revenue - ex.expense_total,
    'expenses_by_category', bycat.list,
    'by_service', bysvc.list
  )
  from agg, ex, bycat, bysvc;
$$;

-- Deret harian untuk grafik (maksimal 400 hari).
create or replace function public.get_daily_series(p_start date, p_end date)
returns table (
  day              date,
  order_count      integer,
  cash_in          bigint,
  service_revenue  bigint,
  expense_total    bigint,
  net_profit       bigint
)
language sql
stable
as $$
  with days as (
    select d::date as day
    from generate_series(p_start, least(p_end, p_start + 399), interval '1 day') d
  ),
  o as (
    select transaction_date as day,
           count(*) filter (where order_status <> 'Dibatalkan')::integer as order_count,
           coalesce(sum(paid_amount) filter (where order_status <> 'Dibatalkan'), 0) as cash_in,
           coalesce(sum(service_revenue) filter (where order_status = 'Selesai'), 0) as service_revenue
    from public.orders
    where transaction_date between p_start and p_end
    group by transaction_date
  ),
  e as (
    select expense_date as day, sum(amount) as expense_total
    from public.expenses
    where expense_date between p_start and p_end
    group by expense_date
  )
  select d.day,
         coalesce(o.order_count, 0),
         coalesce(o.cash_in, 0)::bigint,
         coalesce(o.service_revenue, 0)::bigint,
         coalesce(e.expense_total, 0)::bigint,
         (coalesce(o.service_revenue, 0) - coalesce(e.expense_total, 0))::bigint
  from days d
  left join o on o.day = d.day
  left join e on e.day = d.day
  order by d.day;
$$;

-- Ringkasan semua waktu: order belum selesai & tagihan belum lunas.
create or replace function public.get_outstanding()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'open_count',   count(*) filter (where order_status not in ('Selesai', 'Dibatalkan')),
    'unpaid_count', count(*) filter (where order_status <> 'Dibatalkan' and payment_status <> 'Lunas'),
    'receivables',  coalesce(sum(remaining_amount) filter (where order_status <> 'Dibatalkan'), 0)
  )
  from public.orders;
$$;

-- ---------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.service_categories enable row level security;
alter table public.expense_categories enable row level security;
alter table public.app_settings       enable row level security;
alter table public.invoice_counters   enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.expenses           enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare
  t text;
begin
  foreach t in array array['service_categories', 'expense_categories', 'app_settings',
                           'invoice_counters', 'orders', 'order_items', 'expenses']
  loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated
         using (public.is_owner()) with check (public.is_owner())', t);
  end loop;
end;
$$;

-- Kolom is_owner tidak boleh diubah dari aplikasi.
revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Pengunjung anonim tidak boleh menyentuh data apa pun.
revoke all on public.profiles, public.service_categories, public.expense_categories,
              public.app_settings, public.invoice_counters, public.orders,
              public.order_items, public.expenses
  from anon;

-- Fungsi hanya untuk user yang login (RLS tetap berlaku di dalamnya).
revoke execute on function public.save_order(jsonb)                   from public, anon;
revoke execute on function public.get_order(uuid)                     from public, anon;
revoke execute on function public.next_invoice_number(date)           from public, anon;
grant  execute on function public.next_invoice_number(date)           to authenticated;
revoke execute on function public.get_financial_summary(date, date)   from public, anon;
revoke execute on function public.get_daily_series(date, date)        from public, anon;
revoke execute on function public.get_outstanding()                   from public, anon;
grant  execute on function public.save_order(jsonb)                   to authenticated;
grant  execute on function public.get_order(uuid)                     to authenticated;
grant  execute on function public.get_financial_summary(date, date)   to authenticated;
grant  execute on function public.get_daily_series(date, date)        to authenticated;
grant  execute on function public.get_outstanding()                   to authenticated;
grant  execute on function public.is_owner()                          to authenticated;

-- ---------------------------------------------------------------------
-- 11. DATA AWAL
-- ---------------------------------------------------------------------
insert into public.service_categories (name, sort_order)
select v.name, v.ord from (values
  ('Titip Belanja', 1), ('Titip Makanan', 2), ('Antar Jemput', 3),
  ('Pengiriman Barang', 4), ('Jastip', 5), ('Transportasi', 6), ('Lainnya', 99)
) as v(name, ord)
where not exists (select 1 from public.service_categories s where lower(s.name) = lower(v.name));

insert into public.expense_categories (name, sort_order)
select v.name, v.ord from (values
  ('Bensin', 1), ('Parkir', 2), ('Tol', 3), ('Konsumsi', 4),
  ('Perawatan kendaraan', 5), ('Pembelian perlengkapan', 6),
  ('Biaya komunikasi/internet', 7), ('Biaya operasional lainnya', 99)
) as v(name, ord)
where not exists (select 1 from public.expense_categories s where lower(s.name) = lower(v.name));

insert into public.app_settings (setting_key, setting_value) values
  ('business', jsonb_build_object(
      'name', 'KANG REWANG',
      'tagline', 'Rewang Apa Bae, Ora Rewel',
      'whatsapp', '081292923132',
      'owner_name', 'Rifqi Amrullah',
      'nota_footer', 'Terima kasih sudah pakai jasa Kang Rewang 🙏✨')),
  ('payment', jsonb_build_object(
      'account_holder', 'Rifqi Amrullah',
      'bank',  jsonb_build_object('enabled', true, 'name', 'BRI', 'account_number', '137701013167504'),
      'dana',  jsonb_build_object('enabled', true, 'number', '081292923132'),
      'qris',  jsonb_build_object('enabled', true, 'info', 'Cek Katalog'))),
  ('invoice', jsonb_build_object('prefix', 'KR', 'digits', 3)),
  ('display', jsonb_build_object('show_pending_revenue', true))
on conflict (setting_key) do nothing;
