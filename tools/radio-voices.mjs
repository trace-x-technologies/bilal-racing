#!/usr/bin/env node
/**
 * Team-radio voices — speaks every line of lore.radioMessages with the macOS
 * text-to-speech engine and writes one small AAC clip per line:
 *
 *   src/assets/audio/radio/<speaker>-<slug>.m4a
 *   src/assets/audio/radio/manifest.json      { "<speaker>|<text>": "<file>" }
 *
 * Run it after editing the radio lines (macOS only — needs `say` + `afconvert`):
 *
 *   npm run voices
 *
 * The clips are committed, so the build itself never needs a Mac. A line with
 * no clip still plays on the site: transcript only, no voice.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src/assets/audio/radio');

/**
 * One system voice per speaker; `rate` is words per minute. The owner is
 * recorded slow because the site plays him back sped up (higher, smaller,
 * cattier) — see VOICES in Radio.astro.
 */
const VOICES = {
  Poosa: { voice: 'Daniel', rate: 150 },
  Isuru: { voice: 'Rishi', rate: 185 },
  Yasas: { voice: 'Aman', rate: 180 },
};

/** Respellings for the speech engine only (the transcript keeps the real text). */
const SAY_AS = [
  [/\bME\b/g, 'me'], // all-caps can get spelled out letter by letter
  [/—/g, ', '],
];

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/, '');

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

if (process.platform !== 'darwin') {
  console.error('radio-voices: needs macOS (`say` and `afconvert`).');
  process.exit(1);
}

const { radioMessages } = await import('../src/data/lore.ts');

const installed = run('say', ['-v', '?']);
for (const { voice } of Object.values(VOICES)) {
  if (!new RegExp(`^${voice}\\s`, 'm').test(installed)) {
    console.error(`radio-voices: voice "${voice}" is not installed (System Settings → Accessibility → Spoken Content → System Voice → Manage Voices).`);
    process.exit(1);
  }
}

mkdirSync(outDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'radio-voices-'));
const manifest = {};
let bytes = 0;
let take = 0;

const duration = (path) => Number(/estimated duration: ([\d.]+)/.exec(run('afinfo', [path]))?.[1] ?? 0);

/**
 * `say -o` occasionally writes a cut-short file, and never truncates one that
 * already exists. So: a fresh file per take, and keep a take only once a second
 * one comes out the same length.
 */
function speak(cfg, spoken) {
  let prev = 0;
  for (let i = 0; i < 6; i++) {
    const wav = join(tmp, `take-${take++}.wav`);
    run('say', ['-v', cfg.voice, '-r', String(cfg.rate), '-o', wav, '--data-format=LEI16@22050', spoken]);
    const secs = duration(wav);
    if (secs > 0 && Math.abs(secs - prev) < 0.005) return { wav, secs };
    prev = secs;
  }
  throw new Error(`radio-voices: "${cfg.voice}" kept producing different takes of “${spoken}”`);
}

try {
  for (const { from, text } of radioMessages) {
    const cfg = VOICES[from];
    if (!cfg) {
      console.warn(`radio-voices: no voice for "${from}", skipping “${text}”`);
      continue;
    }
    const file = `${from.toLowerCase()}-${slug(text)}.m4a`;
    const spoken = SAY_AS.reduce((s, [re, to]) => s.replace(re, to), text);
    const { wav, secs } = speak(cfg, spoken);
    run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '32000', '-c', '1', wav, join(outDir, file)]);
    manifest[`${from}|${text}`] = file;
    const size = statSync(join(outDir, file)).size;
    bytes += size;
    console.log(`${file.padEnd(64)} ${cfg.voice.padEnd(7)} ${secs.toFixed(2)} s  ${(size / 1024).toFixed(1)} KB`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// Drop clips for lines that no longer exist.
const keep = new Set(Object.values(manifest));
for (const f of readdirSync(outDir)) {
  if (f.endsWith('.m4a') && !keep.has(f)) {
    rmSync(join(outDir, f));
    console.log(`removed stale ${f}`);
  }
}

writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${keep.size} clips, ${(bytes / 1024).toFixed(0)} KB → ${outDir}`);
