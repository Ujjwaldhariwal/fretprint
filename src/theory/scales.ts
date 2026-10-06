import { pc, spellingName, spellDegree, rootSpelling, defaultSpelling, parseNote, type Spelling } from './notes';
import type { ChordMatch } from './chords';

export interface ScaleType { name: string; degrees: string[]; intervals: number[]; family: string }
type Def = [name: string, degrees: string, family: string];
const DEFS: Def[] = [
  ['Major (Ionian)', '1 2 3 4 5 6 7', 'Major modes'],
  ['Natural minor (Aeolian)', '1 2 b3 4 5 b6 b7', 'Major modes'],
  ['Major pentatonic', '1 2 3 5 6', 'Pentatonic & blues'],
  ['Minor pentatonic', '1 b3 4 5 b7', 'Pentatonic & blues'],
  ['Mixolydian', '1 2 3 4 5 6 b7', 'Major modes'],
  ['Dorian', '1 2 b3 4 5 6 b7', 'Major modes'],
  ['Lydian', '1 2 3 #4 5 6 7', 'Major modes'],
  ['Phrygian', '1 b2 b3 4 5 b6 b7', 'Major modes'],
  ['Locrian', '1 b2 b3 4 b5 b6 b7', 'Major modes'],
  ['Blues', '1 b3 4 b5 5 b7', 'Pentatonic & blues'],
  ['Major blues', '1 2 b3 3 5 6', 'Pentatonic & blues'],
  ['Harmonic minor', '1 2 b3 4 5 b6 7', 'Minor family'],
  ['Melodic minor', '1 2 b3 4 5 6 7', 'Minor family'],
  ['Phrygian dominant', '1 b2 3 4 5 b6 b7', 'Minor family'],
  ['Lydian dominant', '1 2 3 #4 5 6 b7', 'Melodic minor modes'],
  ['Altered', '1 b2 #2 3 b5 #5 b7', 'Melodic minor modes'],
  ['Half-whole diminished', '1 b2 #2 3 #4 5 6 b7', 'Symmetric'],
  ['Whole-half diminished', '1 2 b3 4 b5 b6 6 7', 'Symmetric'],
  ['Whole tone', '1 2 3 #4 #5 b7', 'Symmetric'],
  ['Double harmonic (Bhairav)', '1 b2 3 4 5 b6 7', 'World'],
  ['Hungarian minor', '1 2 b3 #4 5 b6 7', 'World'],
  ['Hirajōshi', '1 2 b3 5 b6', 'World'],
];
const semis = (d: string) => { const m = /^(b|#)?(\d+)$/.exec(d)!; return pc([0, 2, 4, 5, 7, 9, 11][(+m[2] - 1) % 7] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0)); };
export const SCALES: ScaleType[] = DEFS.map(([name, d, family]) => { const degrees = d.split(' '); return { name, degrees, family, intervals: degrees.map(semis) }; });

/** Scales rooted on the chord's root that contain every chord tone (good choices to solo over it). */
export function scalesForChord(match: ChordMatch, limit = 6) {
  const need = new Set(match.tones.map(t => pc(t.pc - match.root)));
  const rs = parseNote(match.rootName.replace('♭', 'b').replace('♯', '#'))!.spelling;
  return SCALES.filter(s => [...need].every(x => s.intervals.includes(x)))
    .slice(0, limit)
    .map(s => ({ scale: s, root: match.rootName, notes: s.degrees.map(d => spellingName(spellDegree(rs, d))) }));
}

/* ---------- keys and roman numerals ---------- */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const NAT_MINOR = [0, 2, 3, 5, 7, 8, 10];
const HARM_MINOR = [0, 2, 3, 5, 7, 8, 11];
const MAJOR_KEY_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const MINOR_KEY_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];

function numeral(match: ChordMatch, degreeIdx: number, scale: number[]) {
  const f = match.type.formula;
  const minor = f.includes('b3') && !f.includes('3');
  const dim = f.includes('b5') && minor;
  let r = ROMAN[degreeIdx];
  void scale;
  if (minor) r = r.toLowerCase();
  let suffix = match.type.symbol;
  if (minor) suffix = suffix.replace(/^m(?!aj)/, '');
  if (match.type.symbol === 'dim') suffix = '°';
  else if (match.type.symbol === 'dim7') suffix = '°7';
  else if (match.type.symbol === 'm7♭5') suffix = 'ø7';
  else if (match.type.symbol === 'aug') suffix = '+';
  void dim;
  return r + suffix;
}

/** Keys in which the chord is diatonic, with its roman-numeral function. Tonic and dominant functions first. */
export function keysForChord(match: ChordMatch, limit = 6) {
  const tones = match.tones.filter(t => t.present).map(t => t.pc);
  const res: { key: string; numeral: string; order: number }[] = [];
  const kinds: [string, number[], string[]][] = [['major', MAJOR, MAJOR_KEY_NAMES], ['minor', NAT_MINOR, MINOR_KEY_NAMES], ['harmonic minor', HARM_MINOR, MINOR_KEY_NAMES]];
  for (const [kind, scale, names] of kinds) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const set = scale.map(x => pc(tonic + x));
      if (!tones.every(t => set.includes(t))) continue;
      const deg = set.indexOf(match.root);
      if (deg < 0) continue;
      if (kind === 'harmonic minor' && tones.every(t => NAT_MINOR.map(x => pc(tonic + x)).includes(t))) continue; // already listed as natural minor
      const fn = [0, 4, 5, 2, 1, 3, 6][deg] ?? 6;     // order of importance: I, V, IV, vi, ii, iii, vii
      res.push({ key: `${names[tonic]} ${kind}`, numeral: numeral(match, deg, scale), order: fn * 2 + (kind === 'major' ? 0 : kind === 'minor' ? 1 : 1.5) });
    }
  }
  return res.sort((a, b) => a.order - b.order).slice(0, limit);
}

export { defaultSpelling, rootSpelling };
export type { Spelling };
