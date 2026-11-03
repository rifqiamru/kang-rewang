// Membuat audio PLACEHOLDER sintetis (bebas hak cipta) ke public/audio/.
//  - music-placeholder.wav : pad ambient minimal 60 dtk, akord berganti per era
//  - sfx-whoosh.wav        : desis transisi
//  - sfx-tick.wav          : klik pendek
//  - sfx-rise.wav          : nada naik untuk logo
// Ganti file-file ini dengan musik/SFX pilihanmu (nama sama) kapan saja.
import { mkdirSync, writeFileSync } from "node:fs";

const SR = 44100;
const OUT = new URL("../public/audio/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const writeWav = (name, samples) => {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const norm = peak > 0 ? 0.89 / peak : 1;
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(s * norm * 32767), 44 + i * 2));
  writeFileSync(new URL(name, OUT), buf);
  console.log("wrote public/audio/" + name);
};

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

// ---- Musik: pad ambient, akord berganti mengikuti scene --------------------
{
  const dur = 60;
  const out = new Float32Array(SR * dur);
  // [mulai detik, nada midi]
  const chords = [
    [0, [45, 52, 57, 60]], // Am  (hook + 1.0)
    [17, [41, 48, 53, 57]], // F   (2.0)
    [29, [43, 50, 55, 59]], // G   (3.0)
    [41, [48, 55, 60, 64]], // C   (4.0)
    [53, [45, 52, 57, 64]], // Am(add) CTA
  ];
  const chordAt = (t) => chords.filter((c) => c[0] <= t).pop()[1];
  const xfade = 1.5;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let s = 0;
    const cur = chords.findLastIndex((c) => c[0] <= t);
    const next = chords[cur + 1];
    const mixNext = next ? Math.min(1, Math.max(0, (t - (next[0] - xfade)) / xfade)) : 0;
    const voices = [
      [chordAt(t), 1 - mixNext],
      ...(next ? [[next[1], mixNext]] : []),
    ];
    for (const [notes, g] of voices) {
      if (g <= 0) continue;
      notes.forEach((n, k) => {
        const f = midi(n);
        const lfo = 0.75 + 0.25 * Math.sin(2 * Math.PI * (0.07 + k * 0.03) * t + k);
        s += g * lfo * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2.003 * t)) / notes.length;
      });
    }
    // denyut halus di era 4.0 (lebih "cepat")
    if (t >= 41 && t < 53) {
      const beat = (t * 2) % 1;
      s += 0.12 * Math.exp(-beat * 9) * Math.sin(2 * Math.PI * midi(72) * t);
    }
    out[i] = s * 0.5;
  }
  writeWav("music-placeholder.wav", out);
}

// ---- Whoosh: noise ter-filter dengan sapuan --------------------------------
{
  const dur = 0.9;
  const out = new Float32Array(Math.round(SR * dur));
  let lp = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / out.length;
    const env = Math.sin(Math.PI * Math.pow(t, 0.7));
    const cutoff = 0.02 + 0.25 * Math.sin(Math.PI * t);
    lp += cutoff * (rand() - lp);
    out[i] = lp * env;
  }
  writeWav("sfx-whoosh.wav", out);
}

// ---- Tick ------------------------------------------------------------------
{
  const dur = 0.12;
  const out = new Float32Array(Math.round(SR * dur));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = Math.exp(-t * 60) * Math.sin(2 * Math.PI * 1500 * t) + 0.3 * Math.exp(-t * 200) * rand();
  }
  writeWav("sfx-tick.wav", out);
}

// ---- Rise ------------------------------------------------------------------
{
  const dur = 1.4;
  const out = new Float32Array(Math.round(SR * dur));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = 300 + 600 * Math.pow(t / dur, 2);
    phase += (2 * Math.PI * f) / SR;
    const env = Math.min(1, t / 0.9) * Math.exp(-Math.max(0, t - 0.9) * 8);
    out[i] = env * (Math.sin(phase) + 0.3 * Math.sin(phase * 2));
  }
  writeWav("sfx-rise.wav", out);
}
