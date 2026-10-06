import { pc, parseDegree, spellDegree, spellingName, spellingPc, rootSpelling, defaultSpelling, parseNote, prettyDegree, type Spelling } from './notes';

/** One chord quality. `formula` uses scale degrees; tones in `optional` may be omitted in a voicing. */
export interface ChordType {
  symbol: string;          // suffix after the root, e.g. "m7♭5"
  name: string;            // long name
  formula: string[];       // e.g. ["1","b3","b5","b7"]
  aliases: string[];       // alternate spellings accepted by the parser
  optional: string[];      // degrees that can be dropped (usually the 5th, the 9th of 11/13 chords)
  rank: number;            // lower = more common, used to break ties
  intervals: number[];     // semitones (mod 12) of formula
  required: number[];      // semitones that must be present
}

type Def = [symbol: string, name: string, formula: string, aliases?: string[], optional?: string[]];
const DEFS: Def[] = [
  ['', 'major', '1 3 5', ['maj', 'M', 'major']],
  ['m', 'minor', '1 b3 5', ['min', '-', 'mi', 'minor']],
  ['5', 'power chord', '1 5', ['no3']],
  ['7', 'dominant seventh', '1 3 5 b7', ['dom7', 'dom']],
  ['maj7', 'major seventh', '1 3 5 7', ['M7', 'Δ', 'Δ7', 'ma7', 'j7']],
  ['m7', 'minor seventh', '1 b3 5 b7', ['-7', 'min7', 'mi7']],
  ['sus4', 'suspended fourth', '1 4 5', ['sus']],
  ['sus2', 'suspended second', '1 2 5'],
  ['add9', 'added ninth', '1 3 5 9', ['add2', '2']],
  ['m(add9)', 'minor added ninth', '1 b3 5 9', ['madd9', 'm(add2)', 'madd2', 'm2']],
  ['6', 'major sixth', '1 3 5 6', ['M6', 'maj6']],
  ['m6', 'minor sixth', '1 b3 5 6', ['-6', 'min6']],
  ['dim', 'diminished', '1 b3 b5', ['°', 'o', 'mb5', 'm♭5']],
  ['aug', 'augmented', '1 3 #5', ['+', '#5', '♯5']],
  ['7sus4', 'dominant seventh suspended fourth', '1 4 5 b7', ['7sus']],
  ['9', 'dominant ninth', '1 3 5 b7 9'],
  ['maj9', 'major ninth', '1 3 5 7 9', ['M9', 'Δ9', 'ma9']],
  ['m9', 'minor ninth', '1 b3 5 b7 9', ['-9', 'min9', 'mi9']],
  ['m7b5', 'half-diminished', '1 b3 b5 b7', ['ø', 'ø7', 'min7b5', 'm7♭5', '-7b5']],
  ['dim7', 'diminished seventh', '1 b3 b5 bb7', ['°7', 'o7']],
  ['6/9', 'six-nine', '1 3 5 6 9', ['69', '6add9']],
  ['m6/9', 'minor six-nine', '1 b3 5 6 9', ['m69']],
  ['add11', 'added eleventh', '1 3 5 11', ['add4']],
  ['m(add11)', 'minor added eleventh', '1 b3 5 11', ['madd11', 'madd4']],
  ['m(maj7)', 'minor-major seventh', '1 b3 5 7', ['mM7', 'mmaj7', 'm(M7)', '-Δ7', 'mΔ7']],
  ['7sus2', 'dominant seventh suspended second', '1 2 5 b7'],
  ['maj7sus2', 'major seventh suspended second', '1 2 5 7', ['M7sus2']],
  ['maj7sus4', 'major seventh suspended fourth', '1 4 5 7', ['M7sus4']],
  ['sus2sus4', 'suspended second and fourth', '1 2 4 5', ['sus24']],
  ['9sus4', 'dominant ninth suspended fourth', '1 4 5 b7 9', ['9sus']],
  ['m7(add11)', 'minor seventh added eleventh', '1 b3 5 b7 11', ['m7add11', 'm7/11']],
  ['7(add11)', 'dominant seventh added eleventh', '1 3 5 b7 11', ['7add11']],
  ['maj7(add11)', 'major seventh added eleventh', '1 3 5 7 11', ['maj7add11']],
  ['7(add13)', 'dominant seventh added thirteenth', '1 3 5 b7 13', ['7add13', '7/6']],
  ['11', 'dominant eleventh', '1 3 5 b7 9 11', [], ['5', '9']],
  ['maj11', 'major eleventh', '1 3 5 7 9 11', ['M11'], ['5', '9']],
  ['m11', 'minor eleventh', '1 b3 5 b7 9 11', ['-11', 'min11'], ['5', '9']],
  ['13', 'dominant thirteenth', '1 3 5 b7 9 13', [], ['5', '9']],
  ['maj13', 'major thirteenth', '1 3 5 7 9 13', ['M13', 'Δ13'], ['5', '9']],
  ['m13', 'minor thirteenth', '1 b3 5 b7 9 13', ['-13', 'min13'], ['5', '9']],
  ['7b9', 'dominant seventh flat nine', '1 3 5 b7 b9', ['7♭9']],
  ['7#9', 'dominant seventh sharp nine', '1 3 5 b7 #9', ['7♯9']],
  ['7#11', 'dominant seventh sharp eleven', '1 3 5 b7 #11', ['7♯11']],
  ['7b13', 'dominant seventh flat thirteen', '1 3 5 b7 b13', ['7♭13']],
  ['7b5', 'dominant seventh flat five', '1 3 b5 b7', ['7♭5']],
  ['aug7', 'augmented seventh', '1 3 #5 b7', ['+7', '7#5', '7♯5', '7+']],
  ['maj7#5', 'augmented major seventh', '1 3 #5 7', ['+maj7', 'maj7+5', 'maj7♯5', '+M7']],
  ['maj7#11', 'major seventh sharp eleven', '1 3 5 7 #11', ['maj7(#11)', 'maj7♯11', 'Δ#11', 'M7#11']],
  ['maj9#11', 'major ninth sharp eleven', '1 3 5 7 9 #11', ['maj9(#11)'], ['5']],
  ['9#11', 'dominant ninth sharp eleven', '1 3 5 b7 9 #11', ['9(#11)'], ['5']],
  ['13#11', 'dominant thirteenth sharp eleven', '1 3 5 b7 9 #11 13', [], ['5', '9']],
  ['7b9b13', 'dominant seventh flat nine flat thirteen', '1 3 5 b7 b9 b13', [], ['5']],
  ['7#9b13', 'dominant seventh sharp nine flat thirteen', '1 3 5 b7 #9 b13', [], ['5']],
  ['7#5#9', 'dominant seventh sharp five sharp nine', '1 3 #5 b7 #9', ['7alt']],
  ['9b5', 'dominant ninth flat five', '1 3 b5 b7 9'],
  ['m(maj9)', 'minor-major ninth', '1 b3 5 7 9', ['mM9', 'mmaj9']],
  ['m7b9', 'minor seventh flat nine', '1 b3 5 b7 b9'],
  ['mb6', 'minor flat six', '1 b3 5 b6', ['m(b6)', 'm♭6']],
  ['dim(maj7)', 'diminished major seventh', '1 b3 b5 7', ['°M7', 'dimM7']],
  ['add#11', 'added sharp eleven', '1 3 5 #11', ['add♯11']],
  ['6sus4', 'sixth suspended fourth', '1 4 5 6'],
  ['m11b5', 'half-diminished eleventh', '1 b3 b5 b7 11', [], ['9']],
  ['quartal', 'stacked fourths', '1 4 b7'],
];

const rankOf = (i: number) => i;   // DEFS are written roughly in order of how common they are
export const CHORD_TYPES: ChordType[] = DEFS.map(([symbol, name, f, aliases = [], optional], i) => {
  const formula = f.split(' ');
  const opt = optional ?? (formula.length >= 4 && formula.includes('5') ? ['5'] : []);
  const intervals = formula.map(d => pc(parseDegree(d).semis));
  const required = formula.filter(d => !opt.includes(d)).map(d => pc(parseDegree(d).semis));
  return { symbol: symbol.replace(/b(?=\d)/g, '♭').replace(/#/g, '♯'), name, formula, aliases: [symbol, ...aliases], optional: opt, rank: rankOf(i), intervals, required };
});

/** Extra tones that can be named as "add" when a voicing has more notes than any template. */
const ADD_NAMES: Record<number, string> = { 1: '♭9', 2: '9', 3: '♯9', 5: '11', 6: '♯11', 8: '♭13', 9: '13' };
const ADD_DEGREES: Record<number, string> = { 1: 'b9', 2: '9', 3: '#9', 5: '11', 6: '#11', 8: 'b13', 9: '13' };

export interface ChordMatch {
  root: number;                 // pitch class
  rootName: string;             // spelled, e.g. "E♭"
  type: ChordType;
  added: string[];              // extra degrees, e.g. ["9"]
  omitted: string[];            // optional degrees missing from the voicing
  bass: number | null;          // pitch class of the bass when it is not the root
  bassName: string | null;
  inversion: string;            // "root position" | "1st inversion" | … | "slash bass"
  symbol: string;               // full suffix incl. additions/omissions
  name: string;                 // complete chord symbol, e.g. "Cadd9/E"
  score: number;
  /** Spelled chord tones in formula order, with their degree. */
  tones: { degree: string; name: string; pc: number; present: boolean }[];
}

function isMinorish(t: ChordType) { return t.formula.includes('b3') && !t.formula.includes('3'); }

function buildMatch(root: number, t: ChordType, ivSet: Set<number>, bassPc: number, score: number): ChordMatch {
  const rs: Spelling = rootSpelling(root, isMinorish(t));
  const rootName = spellingName(rs);
  const extras = [...ivSet].filter(x => !t.intervals.includes(x)).sort((a, b) => a - b);
  const added = extras.map(x => ADD_NAMES[x]);
  const omitted = t.optional.filter(d => !ivSet.has(pc(parseDegree(d).semis)));
  const tones = t.formula.map(d => { const s = spellDegree(rs, d); return { degree: d, name: spellingName(s), pc: spellingPc(s), present: ivSet.has(pc(parseDegree(d).semis)) }; });
  for (const x of extras) { const s = spellDegree(rs, ADD_DEGREES[x]); tones.push({ degree: ADD_DEGREES[x], name: spellingName(s), pc: spellingPc(s), present: true }); }
  let symbol = t.symbol;
  if (added.length) symbol += `(add ${added.join(',')})`;
  let bass: number | null = null, bassName: string | null = null, inversion = 'root position';
  if (bassPc !== root) {
    bass = bassPc;
    const tone = tones.find(x => x.pc === bassPc);
    bassName = tone ? tone.name : spellingName(defaultSpelling(bassPc));
    const iv = pc(bassPc - root);
    const deg = tone?.degree.replace(/[b#]/g, '');
    inversion = !tone ? 'slash bass' : deg === '3' || (deg === '2' && t.formula.includes('2')) || (deg === '4' && t.formula.includes('4')) ? '1st inversion'
      : deg === '5' ? '2nd inversion' : deg === '7' || deg === '6' ? '3rd inversion' : `${prettyDegree(tone.degree)} in the bass`;
    void iv;
  }
  const name = rootName + symbol + (bassName ? '/' + bassName : '');
  return { root, rootName, type: t, added, omitted, bass, bassName, inversion, symbol, name, score, tones };
}

/**
 * Name the chord formed by a set of sounding MIDI notes.
 * Every pitch class present is tried as a root against every chord type; the best explanations win.
 */
export function identify(midis: number[], limit = 4): ChordMatch[] {
  if (!midis.length) return [];
  const pcs = [...new Set(midis.map(pc))];
  const bassPc = pc(Math.min(...midis));
  if (pcs.length === 1) return [];
  const out: ChordMatch[] = [];
  for (const root of pcs) {
    const iv = new Set(pcs.map(p => pc(p - root)));
    for (const t of CHORD_TYPES) {
      if (!t.required.every(x => iv.has(x))) continue;
      const extras = [...iv].filter(x => !t.intervals.includes(x));
      if (extras.some(x => !(x in ADD_NAMES))) continue;                    // a leftover 3rd, 5th or 7th means a different chord
      if (extras.length > 2) continue;
      if (t.symbol === '5' && extras.length) continue;
      if (extras.includes(3) && !t.intervals.includes(4)) continue;         // ♯9 only makes sense over a major 3rd
      const missingOpt = t.optional.filter(d => !iv.has(pc(parseDegree(d).semis))).length;
      const score = extras.length * 1.7 + missingOpt * 0.6 + (bassPc !== root ? 0.9 : 0)
        - t.intervals.length * 0.16 + t.rank * 0.02;
      out.push(buildMatch(root, t, iv, bassPc, score));
    }
  }
  out.sort((a, b) => a.score - b.score);
  const seen = new Set<string>(), res: ChordMatch[] = [];
  for (const m of out) {
    if (res.length && m.score - res[0].score > 1.6) break;
    if (seen.has(m.name)) continue;
    seen.add(m.name); res.push(m);
    if (res.length >= limit) break;
  }
  return res;
}

/** Parse a chord symbol such as "Ebmaj7", "F#m7b5", "Cadd9/G", "Bb13#11". */
export function parseChord(input: string): { root: number; rootName: string; type: ChordType; bass: number | null; bassName: string | null } | null {
  const s = input.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const m = /^([A-Ga-g])(#|b)?(.*?)(?:\/([A-Ga-g](?:#|b)?))?$/.exec(s);
  if (!m) return null;
  const rootP = parseNote(m[1].toUpperCase() + (m[2] ?? ''));
  if (!rootP) return null;
  const q = m[3].trim();
  const norm = (x: string) => x.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/\s+/g, '');
  let type = CHORD_TYPES.find(t => t.aliases.some(a => norm(a) === q));
  if (!type) type = CHORD_TYPES.find(t => t.aliases.some(a => norm(a).toLowerCase() === q.toLowerCase() && !/^[mM]/.test(q)));
  if (!type) return null;
  const root = spellingPc(rootP.spelling);
  const bp = m[4] ? parseNote(m[4][0].toUpperCase() + m[4].slice(1)) : null;
  return { root, rootName: spellingName(rootP.spelling), type, bass: bp ? spellingPc(bp.spelling) : null, bassName: bp ? spellingName(bp.spelling) : null };
}

/** Spelled tones of a parsed chord. */
export function chordTones(root: number, rootName: string, t: ChordType) {
  const rs = parseNote(rootName.replace('♭', 'b').replace('♯', '#'))!.spelling;
  return t.formula.map(d => ({ degree: d, name: spellingName(spellDegree(rs, d)), pc: pc(root + parseDegree(d).semis) }));
}
