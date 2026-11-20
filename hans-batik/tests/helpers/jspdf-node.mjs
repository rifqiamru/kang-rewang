// Memuat vendor/jspdf.umd.min.js (UMD) di Node untuk pengujian.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function loadJsPDFNode() {
  const file = fileURLToPath(new URL('../../www/vendor/jspdf.umd.min.js', import.meta.url));
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', readFileSync(file, 'utf8'))(module.exports, module);
  return module.exports.jsPDF;
}
