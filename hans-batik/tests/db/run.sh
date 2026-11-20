#!/usr/bin/env bash
# Menjalankan pengujian database di PostgreSQL lokal sementara.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
trap '"$PGBIN/pg_ctl" -D "$WORK/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
RUNAS=""
if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUNAS="runuser -u postgres --"; fi
$RUNAS "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
$RUNAS "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c timezone=Asia/Jakarta" -l "$WORK/log" start -w >/dev/null
export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
PSQL="psql -v ON_ERROR_STOP=1 -q -X"
export PGOPTIONS="-c client_min_messages=warning"
$PSQL -f "$HERE/supabase_stub.sql"
$PSQL -f "$HERE/../../supabase/schema.sql" >/dev/null
$PSQL -f "$HERE/../../supabase/schema.sql" >/dev/null   # harus aman dijalankan ulang
PGOPTIONS="" $PSQL -f "$HERE/test_schema.sql" 2>&1 | sed "s/^psql:.*NOTICE:  //"
# Uji konkurensi nomor nota: 40 penyimpanan paralel.
OWNER=$($PSQL -At -c "select id from public.profiles where is_owner")
SVC=$($PSQL -At -c "select id from public.service_categories where name='Marketplace'")
for i in $(seq 1 40); do
  $PSQL -c "set role authenticated; set request.jwt.claim.sub='$OWNER';
    select public.save_order('{\"transaction_date\":\"2027-01-05\",\"service_category_id\":\"$SVC\",\"shipping_fee\":1000,\"payment_status\":\"Lunas\",\"order_status\":\"Selesai\",\"items\":[]}'::jsonb);" >/dev/null &
done
wait
$PSQL -At -c "select case when count(*) = 40 and count(distinct invoice_number) = 40
                and max(invoice_number) = 'HB-2701040' then 'OK  konkurensi: 40 nota paralel, nomor unik HB-2701001..HB-2701040'
                else 'FAIL konkurensi: ' || count(*) || ' / ' || count(distinct invoice_number) || ' / ' || max(invoice_number) end
              from public.orders where transaction_date = '2027-01-05'" | tee "$WORK/conc"
grep -q '^OK' "$WORK/conc"
echo "Semua pengujian database LULUS."
