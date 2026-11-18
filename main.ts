// Solmar Bay — Neon Tide, the gta6-01 entry program (Node 22, standard library only).
//
// The game is this directory's game/ folder: plain static files a desktop browser loads
// offline (game/index.html and its ES modules, three.js vendored under game/vendor, no
// network request at all). This program hands the entry in: it copies game/ and
// screenshots/ from beside this file into the output directory and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library. It never deletes the output directory itself — it only creates it and
// copies into it, so it is safe under the grader's bind mount, and it is fully
// deterministic: two runs produce byte-identical output.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is derived from this file's own location, never from the
// working directory: the grader runs the program from `/`, so process.cwd()
// would point at the wrong place.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Create the output directory (and only create it). Nothing here removes it.
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's caps: text_max_bytes shapes the dossier text; the rest refuse an
// entry the scorer would refuse (more than 4 screenshots or one over 256 KiB;
// more than 993 files in game/ or 48 MiB of game files in all, or a path under
// game/ over 1000 bytes).
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, dossierCaps));
console.log(`Solmar Bay handed in: game + screenshots copied to ${outDir}`);
