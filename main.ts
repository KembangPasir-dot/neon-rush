// NEON RUSH — entrypoint (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ beside this file into
// /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with the vendored make.fun library, so the judge
// reads the game's files and its screenshots. No network, no installs,
// no deleting anything: /output is a fresh writable mount in the grader.
//
// Run it locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message) {
  throw new Error('NEON RUSH main.ts: ' + message);
}

function countEntries(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    total += 1;
    if (statSync(full).isDirectory()) total += countEntries(full);
  }
  return total;
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
if (!existsSync(join(gameDir, 'vendor', 'three.min.js'))) fail('game/vendor/three.min.js is missing');
if (!existsSync(shotsDir)) fail('screenshots/ is missing');

// The gate's caps for this bounty (game/ files, screenshots, dossier):
// refuse early with a clear message instead of handing in an entry the
// scorer would refuse.
const gameEntries = countEntries(gameDir);
if (gameEntries > 993) fail('game/ holds ' + gameEntries + ' entries, over the 993 cap');
const shotFiles = readdirSync(shotsDir).filter((n) => !n.startsWith('.'));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  fail('screenshots/ holds ' + shotFiles.length + ' files, need 3 or 4');
}
for (const name of shotFiles) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > 262144) fail('screenshot ' + name + ' is ' + size + ' bytes, over 256 KiB');
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

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

console.log('NEON RUSH handed in: ' + gameEntries + ' game entries, ' +
  shotFiles.length + ' screenshots -> ' + out);
