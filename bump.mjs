// Hebt die Fassungsnummer an allen fünf Stellen zugleich.
// Fünf, nicht vier: Cargo.lock wurde schon einmal vergessen, und
// dann meldet der Bauserver eine Abweichung nach zwanzig Minuten.
import { readFileSync, writeFileSync } from "node:fs";

const alt = process.argv[2];
const neu = process.argv[3];
if (!alt || !neu) { console.error("Aufruf: node bump.mjs 1.2.0 2.0.0"); process.exit(1); }

const dateien = [
  ["package.json",              `"version": "${alt}"`,  `"version": "${neu}"`],
  ["src-tauri/Cargo.toml",      `version = "${alt}"`,   `version = "${neu}"`],
  ["src-tauri/tauri.conf.json", `"version": "${alt}"`,  `"version": "${neu}"`],
  ["README.md",                 `Arvalis · ${alt}`,     `Arvalis · ${neu}`],
];

for (const [pfad, suche, ersatz] of dateien) {
  const roh = readFileSync(pfad, "utf8");
  if (!roh.includes(suche)) {
    if (roh.includes(ersatz)) { console.log(`  (schon ${neu}: ${pfad})`); continue; }
    console.error(`FEHLT in ${pfad}: ${suche}`); process.exit(1);
  }
  writeFileSync(pfad, roh.replace(suche, ersatz));
  console.log(`  ${pfad}`);
}

// In Cargo.lock steht die Nummer im Block des Pakets „rana".
const lock = readFileSync("src-tauri/Cargo.lock", "utf8");
const muster = new RegExp(`(name = "rana"\\r?\\nversion = ")${alt.replace(/\./g, "\\.")}(")`);
if (muster.test(lock)) {
  writeFileSync("src-tauri/Cargo.lock", lock.replace(muster, `$1${neu}$2`));
  console.log("  src-tauri/Cargo.lock");
} else if (lock.includes(`name = "rana"\nversion = "${neu}"`)) {
  console.log(`  (schon ${neu}: src-tauri/Cargo.lock)`);
} else {
  console.error("FEHLT in src-tauri/Cargo.lock"); process.exit(1);
}

console.log(`\nFassung ${alt} → ${neu}`);
