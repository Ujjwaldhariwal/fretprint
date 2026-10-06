/** Pitch, interval and spelling primitives. MIDI numbers everywhere: C4 = 60, A4 = 69. */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const pc = (m: number) => ((m % 12) + 12) % 12;
export const octaveOf = (m: number) => Math.floor(m / 12) - 1;
export const hz = (m: number, a4 = 440) => a4 * 2 ** ((m - 69) / 12);
export const midiFromHz = (f: number, a4 = 440) => 69 + 12 * Math.log2(f / a4);

/** A spelled note: letter index (0=C..6=B) + accidental (-2..2). */
export interface Spelling { letter: number; acc: number }

export function spellingName(s: Spelling, unicode = true): string {
  const a = s.acc;
  const accStr = unicode
    ? (a === -2 ? '𝄫' : a === -1 ? '♭' : a === 1 ? '♯' : a === 2 ? '𝄪' : '')
    : (a === -2 ? 'bb' : a === -1 ? 'b' : a === 1 ? '#' : a === 2 ? '##' : '');
  return LETTERS[s.letter] + accStr;
}
export const spellingPc = (s: Spelling) => pc(LETTER_PC[s.letter] + s.acc);

/** Parse "C", "Eb", "F#", "Bb3", "C♯4" → { spelling, midi? } */
export function parseNote(input: string): { spelling: Spelling; midi: number | null } | null {
  const m = /^\s*([A-Ga-g])(##|bb|#|b|♯|♭|𝄪|𝄫)?(-?\d)?\s*$/.exec(input);
  if (!m) return null;
  const letter = 'CDEFGAB'.indexOf(m[1].toUpperCase());
  const accMap: Record<string, number> = { '#': 1, '♯': 1, b: -1, '♭': -1, '##': 2, '𝄪': 2, bb: -2, '𝄫': -2 };
  const acc = m[2] ? accMap[m[2]] : 0;
  const midi = m[3] != null ? 12 * (+m[3] + 1) + LETTER_PC[letter] + acc : null;
  return { spelling: { letter, acc }, midi };
}
export const noteToMidi = (s: string) => parseNote(s)?.midi ?? null;

/** Default spelling of a pitch class when there is no harmonic context. */
const FLAT_PREF: Record<number, Spelling> = { 1: { letter: 1, acc: -1 }, 3: { letter: 2, acc: -1 }, 8: { letter: 5, acc: -1 }, 10: { letter: 6, acc: -1 } };
const SHARP_PREF: Record<number, Spelling> = { 1: { letter: 0, acc: 1 }, 6: { letter: 3, acc: 1 }, 8: { letter: 4, acc: 1 } };
export function defaultSpelling(p: number, preferSharps = false): Spelling {
  p = pc(p);
  const natural = LETTER_PC.indexOf(p);
  if (natural >= 0) return { letter: natural, acc: 0 };
  if (preferSharps && SHARP_PREF[p]) return SHARP_PREF[p];
  if (p === 6) return { letter: 3, acc: 1 };       // F♯ reads better than G♭ in most contexts
  return FLAT_PREF[p] ?? { letter: LETTER_PC.indexOf(pc(p - 1)), acc: 1 };
}
/** Root spelling used for chord names: flats for Db Eb Ab Bb majors, sharps for C#m F#m G#m. */
export function rootSpelling(p: number, minor: boolean): Spelling {
  p = pc(p);
  if (minor && (p === 1 || p === 8)) return SHARP_PREF[p];
  return defaultSpelling(p);
}

/** Degree string such as "1", "b3", "#11", "bb7" → semitones above the root and the scale degree. */
export function parseDegree(d: string): { semis: number; degree: number } {
  const m = /^(bb|b|#|##|♭|♯)?(\d+)$/.exec(d);
  if (!m) throw new Error('bad degree ' + d);
  const degree = +m[2];
  const base = [0, 2, 4, 5, 7, 9, 11][(degree - 1) % 7];
  const acc = { b: -1, '♭': -1, bb: -2, '#': 1, '♯': 1, '##': 2 }[m[1] ?? ''] ?? 0;
  return { semis: base + acc, degree };
}
/** Spell the note that is `degree` above a spelled root (e.g. root E♭, degree "b7" → D♭). */
export function spellDegree(root: Spelling, d: string): Spelling {
  const { semis, degree } = parseDegree(d);
  const letter = (root.letter + degree - 1) % 7;
  const target = pc(spellingPc(root) + semis);
  let acc = target - LETTER_PC[letter];
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  return { letter, acc };
}
/** Prettify a degree for display: "b7" → "♭7". */
export const prettyDegree = (d: string) => d.replace(/bb/g, '𝄫').replace(/b/g, '♭').replace(/#/g, '♯');
export const prettyText = (s: string) => s.replace(/#/g, '♯').replace(/(?<=[A-G])b/g, '♭');

/** Interval names by semitone (simple interval within an octave). */
export const INTERVAL_SHORT = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♯5', '6', '♭7', '7'];
export const INTERVAL_LONG = ['unison', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th', 'tritone', 'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th'];

export function midiName(m: number, s?: Spelling, unicode = true): string {
  const sp = s ?? defaultSpelling(m);
  // octave follows the letter (B♯3 is the same key as C4)
  const naturalPc = LETTER_PC[sp.letter];
  const oct = Math.floor((m - naturalPc - sp.acc) / 12) - 1;
  return spellingName(sp, unicode) + oct;
}
