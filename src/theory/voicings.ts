import { pc } from './notes';
import type { ChordType } from './chords';

export interface Voicing { frets: number[]; base: number; score: number }

/**
 * Generate playable voicings of a chord for ANY tuning (custom tunings included).
 * Search: for every 4-fret window, each string may be muted, open, or fretted inside the window on a chord tone.
 * Constraints: all required tones present, the requested bass is the lowest note, at most 4 fingers
 * (a barre on the lowest fret counts as one finger). Scored for fullness, comfort and position.
 */
export function findVoicings(tuning: number[], root: number, type: ChordType, bass: number | null, opts: { maxFret?: number; span?: number; limit?: number } = {}): Voicing[] {
  const maxFret = opts.maxFret ?? 15, span = opts.span ?? 4, limit = opts.limit ?? 8;
  const n = tuning.length;
  const tones = new Set(type.intervals.map(i => pc(root + i)));
  if (bass != null) tones.add(pc(bass));
  const required = new Set(type.required.map(i => pc(root + i)));
  if (bass != null) required.add(pc(bass));
  const wantBass = bass ?? root;
  const minSounding = Math.min(n, Math.max(3, required.size));
  const found = new Map<string, Voicing>();

  for (let base = 0; base <= maxFret - span + 1; base++) {
    const lo = Math.max(1, base), hi = Math.min(maxFret, base + span - 1);
    const options: number[][] = tuning.map(open => {
      const o = [-1];
      if (tones.has(pc(open))) o.push(0);
      for (let f = lo; f <= hi; f++) if (tones.has(pc(open + f))) o.push(f);
      return o;
    });
    const cur: number[] = new Array(n).fill(-1);
    const walk = (i: number) => {
      if (i === n) { consider(cur, base); return; }
      for (const f of options[i]) { cur[i] = f; walk(i + 1); }
    };
    walk(0);
  }

  function consider(frets: number[], base: number) {
    const sounding = frets.map((f, i) => (f < 0 ? null : tuning[i] + f));
    const notes = sounding.filter((m): m is number => m != null);
    if (notes.length < minSounding) return;
    const pcs = new Set(notes.map(pc));
    for (const r of required) if (!pcs.has(r)) return;
    if (pc(Math.min(...notes)) !== pc(wantBass)) return;
    const fretted = frets.filter(f => f > 0);
    if (fretted.length) {
      const minF = Math.min(...fretted), maxF = Math.max(...fretted);
      if (maxF - minF >= span) return;
      const atMin = fretted.filter(f => f === minF).length;
      const fingers = fretted.length - atMin + 1;
      if (fingers > 4) return;
      // a barre must cover every string between its ends, so no open string may sit under it
      if (atMin > 1) {
        const first = frets.findIndex(f => f === minF), last = frets.lastIndexOf(minF);
        for (let k = first; k <= last; k++) if (frets[k] === 0) return;
      }
    }
    // interior muted strings are awkward
    const firstS = frets.findIndex(f => f >= 0), lastS = n - 1 - [...frets].reverse().findIndex(f => f >= 0);
    let interiorMutes = 0; for (let k = firstS; k <= lastS; k++) if (frets[k] < 0) interiorMutes++;
    if (interiorMutes > 1) return;
    const opens = frets.filter(f => f === 0).length;
    const pos = fretted.length ? Math.min(...fretted) : 0;
    const stretch = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
    const score = notes.length * 1.2 - interiorMutes * 2.5 - stretch * 0.6 - pos * 0.12 + opens * 0.25
      + (pcs.size === tones.size ? 1 : 0) - (frets[0] < 0 && n >= 6 ? 0.2 : 0);
    const key = frets.join(',');
    if (!found.has(key) || found.get(key)!.score < score) found.set(key, { frets: frets.slice(), base, score });
  }

  // best first, but spread across the neck: no two picks start on the same position
  const all = [...found.values()].sort((a, b) => b.score - a.score);
  const picked: Voicing[] = [], usedPos = new Set<number>();
  for (const v of all) {
    const fr = v.frets.filter(f => f > 0);
    const posKey = fr.length ? Math.min(...fr) : 0;
    if (usedPos.has(posKey)) continue;
    usedPos.add(posKey); picked.push(v);
    if (picked.length >= limit) break;
  }
  return picked;
}
