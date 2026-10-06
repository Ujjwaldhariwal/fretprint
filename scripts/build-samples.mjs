#!/usr/bin/env node
/**
 * Builds the self-hosted sample bank in public/samples.
 *
 *   node scripts/build-samples.mjs <path-to-tonejs-instruments/samples>
 *
 * For every instrument it:
 *   1. picks a subset of source notes so no target note is more than ~2 semitones from a sample
 *      (the engine pitch-shifts the nearest sample to the exact frequency),
 *   2. transcodes to mono 96 kb/s MP3, trimmed with a short fade-out (small + decodes everywhere),
 *   3. MEASURES the real pitch of each recording (McLeod pitch method) and stores the error in cents,
 *      so playback is corrected to the exact equal-tempered frequency.
 * Output: public/samples/<set>/<note>.mp3 and public/samples/manifest.json
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PitchDetector } from 'pitchy';

const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) { console.error('usage: build-samples.mjs <samples dir>'); process.exit(1); }
const OUT = new URL('../public/samples/', import.meta.url).pathname;

const SETS = {
  'guitar-acoustic': { maxGap: 3, seconds: 4.0 },
  'guitar-nylon':    { maxGap: 3, seconds: 4.0 },
  'guitar-electric': { maxGap: 4, seconds: 4.0 },
  'bass-electric':   { maxGap: 4, seconds: 3.5 },
  'piano':           { maxGap: 3, seconds: 3.5, range: [36, 96] },
};
const NAMES = ['C','Cs','D','Ds','E','F','Fs','G','Gs','A','As','B'];
const midiOf = f => { const m = /^([A-G]s?)(\d)$/.exec(f); return m ? 12 * (+m[2] + 1) + NAMES.indexOf(m[1]) : null; };

const SR = 44100;
function decode(file, seconds = 1.2, offset = 0.08) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(offset), '-t', String(seconds), '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}
function measure(file, expectedMidi) {
  const pcm = decode(file);
  const N = expectedMidi < 40 ? 8192 : 4096, det = PitchDetector.forFloat32Array(N);
  const reads = [];
  for (let i = 0; i + N <= pcm.length; i += N / 4) {
    const [f, c] = det.findPitch(pcm.subarray(i, i + N), SR);
    if (c > 0.9 && f > 20) reads.push(f);
  }
  if (!reads.length) return 0;
  reads.sort((a, b) => a - b);
  const f = reads[Math.floor(reads.length / 2)];
  const expect = 440 * 2 ** ((expectedMidi - 69) / 12);
  let cents = 1200 * Math.log2(f / expect);
  cents -= 1200 * Math.round(cents / 1200);          // ignore octave errors of the detector
  return Math.abs(cents) > 60 ? 0 : Math.round(cents * 10) / 10;   // >60c means a bad read, not a bad sample
}

const manifest = {};
for (const [set, opt] of Object.entries(SETS)) {
  const dir = join(SRC, set);
  let notes = readdirSync(dir).filter(f => f.endsWith('.mp3')).map(f => f.slice(0, -4))
    .map(n => ({ n, m: midiOf(n) })).filter(x => x.m != null).sort((a, b) => a.m - b.m);
  if (opt.range) notes = notes.filter(x => x.m >= opt.range[0] && x.m <= opt.range[1]);
  // greedy subset: keep a sample whenever the gap from the last kept one would exceed maxGap
  const keep = [];
  notes.forEach((x, i) => {
    const last = keep[keep.length - 1], next = notes[i + 1];
    if (!last || i === notes.length - 1 || (next && next.m - last.m > opt.maxGap)) keep.push(x);
  });
  mkdirSync(join(OUT, set), { recursive: true });
  manifest[set] = [];
  for (const { n, m } of keep) {
    const src = join(dir, n + '.mp3'), dst = join(OUT, set, n + '.mp3');
    const fadeStart = opt.seconds - 0.6;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-t', String(opt.seconds), '-ac', '1', '-ar', '44100',
      '-af', `afade=t=out:st=${fadeStart}:d=0.6`, '-b:a', '96k', dst]);
    const cents = measure(src, m);
    manifest[set].push({ note: n, midi: m, cents });
    process.stdout.write(`${set} ${n} (${m}) ${cents >= 0 ? '+' : ''}${cents}c\n`);
  }
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest));
console.log('wrote', join(OUT, 'manifest.json'));
