// Solstice City — the entry program for make.fun gta6-01 (Node 22, stdlib only).
//
// The game lives in this directory's game/ folder: static files a desktop
// browser plays offline (game/index.html plus its ES modules, no libraries and
// no network requests). This program hands the entry in. It copies game/ and
// screenshots/ from beside this file into the output directory and writes
// output/dossier.json, the summary the judge reads, using the vendored
// make.fun library at ./vendor/makefun-game.ts.
//
// Run it outside the grader like this (MAKEFUN_OUTPUT_DIR stands in for
// the grader's /output):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game itself with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own limits (see the kit's RULES.txt): at most
// 4 screenshots of 256 KiB, at most 993 files / 48 MiB under game/, and a
// 1,000-byte cap on any path under game/. The dossier text itself is capped
// at 160 KiB by the library.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
