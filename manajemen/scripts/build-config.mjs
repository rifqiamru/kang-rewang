// Membuat www/js/config.js dari environment variable (Netlify / .env lokal).
// Menolak build jika key yang diberikan adalah service_role.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Baca .env lokal (opsional) tanpa dependensi tambahan.
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const url = (process.env.SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.role;
  } catch { return null; }
}

if (key && (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role')) {
  console.error('\n✖ SUPABASE_ANON_KEY berisi SERVICE ROLE / SECRET key. Ini berbahaya dan DITOLAK.');
  console.error('  Gunakan "anon" / "publishable" key dari Supabase → Project Settings → API.\n');
  process.exit(1);
}
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$|^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url)) {
  console.warn('⚠ SUPABASE_URL tidak tampak seperti URL Supabase:', url);
}
if (!url || !key) {
  console.warn('⚠ SUPABASE_URL / SUPABASE_ANON_KEY belum diatur. Aplikasi akan menampilkan layar "Konfigurasi belum lengkap".');
}

const out = `// Dibuat otomatis oleh scripts/build-config.mjs — jangan diedit manual.
window.KR_CONFIG = ${JSON.stringify({ SUPABASE_URL: url.replace(/\/$/, ''), SUPABASE_ANON_KEY: key }, null, 2)};
`;
writeFileSync(join(root, 'www', 'js', 'config.js'), out);
console.log('✔ www/js/config.js dibuat' + (url ? ` untuk ${new URL(url).host}` : ' (kosong)'));
