// Island Hopper — a golden-hour flight game for the make.fun best-flight-game bounty.
// You fly the prop plane "Kite" (PK-KTE) over a tropical archipelago at sunset, thread
// 8 golden rings, then put her down on runway 09 before the 150-second timer runs out.
// The game itself lives in game/: plain static files (index.html plus ES modules, Three.js
// vendored under game/, no network requests, loads offline in a desktop browser), and the
// frames in screenshots/ are what the judge compares — the first by name is the cover.
// This file only hands the entry in: it copies game/ and screenshots/ from beside this
// file into the output directory and writes dossier.json, the summary the judge reads,
// using the vendored make.fun library.
//
// To play it locally, run `node serve.ts` and open http://localhost:8080.
// When running outside the grader container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// What this entry is. Used only for the run summary printed below; it never reaches
// the output directory, so the generated entry is identical either way.
const ENTRY = {
  name: 'Island Hopper',
  plane: 'Kite (PK-KTE)',
  rings: 8,
  runway: '09',
  timeLimitSeconds: 150,
} as const;

console.log(`Building entry: ${ENTRY.name} — ${ENTRY.plane}, ${ENTRY.rings} rings, land on runway ${ENTRY.runway}.`);

// Refuse to hand in a broken entry instead of silently copying a missing folder.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing — the entry cannot be built.');
}
const shotNames = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
  : [];
if (shotNames.length === 0 || shotNames.length > 4) {
  throw new Error(`Expected 1-4 screenshots, found ${shotNames.length}.`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Done: ${ENTRY.name} handed in — ${shotNames.length} screenshots (cover: ${shotNames[0]}), dossier.json written to ${out}.`);
