// Render still frame di titik tengah tiap scene (+ frame tambahan opsional).
// Pemakaian: node scripts/render-stills.mjs [hook m1 ...] [--at=12.5,20]
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const SCENES = { hook: [0, 5], m1: [5, 12], m2: [17, 12], m3: [29, 12], m4: [41, 12], cta: [53, 7] };
const FPS = 30;
const args = process.argv.slice(2);
const at = (args.find((a) => a.startsWith("--at=")) || "").slice(5).split(",").filter(Boolean).map(Number);
const keys = args.filter((a) => !a.startsWith("--"));
const extra = args.filter((a) => a.startsWith("--browser-executable"));

const targets = [];
for (const k of keys.length ? keys : Object.keys(SCENES)) {
  if (!SCENES[k]) continue;
  const [s, d] = SCENES[k];
  targets.push({ name: `${k}-mid`, frame: Math.round((s + d / 2) * FPS) });
}
for (const t of at) targets.push({ name: `t${t}`, frame: Math.round(t * FPS) });

mkdirSync("out/stills", { recursive: true });
for (const t of targets) {
  console.log(`-> ${t.name} (frame ${t.frame})`);
  execFileSync(
    "npx",
    ["remotion", "still", "MarketingEvolution", `out/stills/${t.name}.png`, `--frame=${t.frame}`, ...extra],
    { stdio: "inherit" },
  );
}
