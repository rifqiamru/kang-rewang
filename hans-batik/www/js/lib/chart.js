// Grafik batang SVG ringan (tanpa library). Mendukung beberapa seri,
// nilai negatif, legenda, dan tooltip saat disentuh/diarahkan.
import { rupiah, rupiahShort, formatDayMonth, formatDateFull } from './format.js';

function niceStep(range, ticks) {
  const raw = range / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

function barPath(x, y0, y1, w, r) {
  // Batang dengan ujung data membulat, pangkal menempel di garis nol.
  const up = y1 < y0;
  const h = Math.abs(y1 - y0);
  const rr = Math.min(r, w / 2, h);
  if (h < 0.5) return '';
  if (up) {
    return `M${x},${y0}V${y1 + rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 + rr}V${y0}Z`;
  }
  return `M${x},${y0}V${y1 - rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 - rr}V${y0}Z`;
}

/**
 * @param {HTMLElement} el
 * @param {{ data: object[], xKey: string, series: {key,label,color,negColor?}[], title?: string }} opt
 */
export function barChart(el, opt) {
  const { data, xKey, series } = opt;
  el.classList.add('chart');
  el.innerHTML = `
    ${series.length > 1 ? `<div class="chart-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</div>` : ''}
    <div class="chart-plot"><svg role="img" aria-label="${opt.title || 'Grafik'}"></svg><div class="chart-tip" hidden></div></div>`;
  const plot = el.querySelector('.chart-plot');
  const svg = el.querySelector('svg');
  const tip = el.querySelector('.chart-tip');

  function draw() {
    const W = Math.max(280, plot.clientWidth || 320);
    const H = 200;
    const pad = { l: 44, r: 8, t: 10, b: 26 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    let min = 0; let max = 0;
    for (const d of data) for (const s of series) { const v = Number(d[s.key]) || 0; min = Math.min(min, v); max = Math.max(max, v); }
    if (max === min) max = min + 10000;
    const step = niceStep(max - min, 4);
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const y = (v) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;
    const n = Math.max(1, data.length);
    const slot = iw / n;
    const groupW = Math.min(slot * 0.78, 22 * series.length + 2 * (series.length - 1));
    const gap = series.length > 1 ? 2 : 0;
    const bw = Math.max(2, (groupW - gap * (series.length - 1)) / series.length);
    const labelEvery = Math.ceil(n / Math.max(1, Math.floor(iw / 42)));

    let g = '';
    for (let v = lo; v <= hi + 1e-6; v += step) {
      const yy = y(v).toFixed(1);
      g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}" class="${v === 0 ? 'axis-zero' : 'grid'}"/>`;
      g += `<text x="${pad.l - 6}" y="${yy}" class="tick" text-anchor="end" dominant-baseline="middle">${rupiahShort(v)}</text>`;
    }
    let bars = '';
    let hits = '';
    data.forEach((d, i) => {
      const gx = pad.l + i * slot + (slot - groupW) / 2;
      series.forEach((s, j) => {
        const v = Number(d[s.key]) || 0;
        const color = v < 0 && s.negColor ? s.negColor : s.color;
        const p = barPath(gx + j * (bw + gap), y(0), y(v), bw, 4);
        if (p) bars += `<path d="${p}" fill="${color}"/>`;
      });
      if (i % labelEvery === 0 || n <= 8) {
        bars += `<text x="${(pad.l + i * slot + slot / 2).toFixed(1)}" y="${H - 8}" class="tick" text-anchor="middle">${formatDayMonth(d[xKey])}</text>`;
      }
      hits += `<rect class="hit" data-i="${i}" x="${(pad.l + i * slot).toFixed(1)}" y="${pad.t}" width="${slot.toFixed(1)}" height="${ih}"/>`;
    });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.innerHTML = `<g>${g}</g><g>${bars}</g><g class="hits">${hits}</g>`;
  }

  function show(i, evX) {
    const d = data[i];
    if (!d) return;
    svg.querySelectorAll('.hit').forEach((r) => r.classList.toggle('on', Number(r.dataset.i) === i));
    tip.innerHTML = `<b>${formatDateFull(d[xKey])}</b>${series.map((s) =>
      `<div><i style="background:${s.color}"></i>${s.label}<span>${rupiah(d[s.key])}</span></div>`).join('')}`;
    tip.hidden = false;
    const pw = plot.clientWidth;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(0, evX - tw / 2), pw - tw)}px`;
  }
  function hide() {
    tip.hidden = true;
    svg.querySelectorAll('.hit.on').forEach((r) => r.classList.remove('on'));
  }
  svg.addEventListener('pointermove', (e) => {
    const r = e.target.closest?.('.hit');
    if (!r) return;
    const box = plot.getBoundingClientRect();
    show(Number(r.dataset.i), e.clientX - box.left);
  });
  svg.addEventListener('pointerleave', hide);

  draw();
  const ro = new ResizeObserver(() => draw());
  ro.observe(plot);
  return () => ro.disconnect();
}
