import { describe, it, expect } from 'vitest';
import { identify, parseChord, findVoicings, keysForChord, scalesForChord, spellDegree, spellingName, parseNote, midiName, CHORD_TYPES } from '../src/theory';
import { parseTuning } from '../src/instruments';

const STD = parseTuning('E2 A2 D3 G3 B3 E4');
const play = (frets: number[], tuning = STD) => frets.map((f, i) => (f < 0 ? null : tuning[i] + f)).filter((m): m is number => m != null);
const name = (frets: number[], tuning = STD) => identify(play(frets, tuning))[0]?.name;

describe('chord identification (standard tuning)', () => {
  const cases: [string, number[], string][] = [
    ['open C', [-1, 3, 2, 0, 1, 0], 'C'],
    ['open G', [3, 2, 0, 0, 0, 3], 'G'],
    ['open D', [-1, -1, 0, 2, 3, 2], 'D'],
    ['open Am', [-1, 0, 2, 2, 1, 0], 'Am'],
    ['open Em', [0, 2, 2, 0, 0, 0], 'Em'],
    ['F barre', [1, 3, 3, 2, 1, 1], 'F'],
    ['Bm barre', [-1, 2, 4, 4, 3, 2], 'Bm'],
    ['Bb barre', [-1, 1, 3, 3, 3, 1], 'B♭'],
    ['Ebm (minor spelled flat)', [-1, -1, 1, 3, 4, 2], 'E♭m'],
    ['C#m barre', [-1, 4, 6, 6, 5, 4], 'C♯m'],
    ['Cadd9', [-1, 3, 2, 0, 3, 0], 'Cadd9'],
    ['D7', [-1, -1, 0, 2, 1, 2], 'D7'],
    ['Em7', [0, 2, 0, 0, 0, 0], 'Em7'],
    ['Cmaj7', [-1, 3, 2, 0, 0, 0], 'Cmaj7'],
    ['Am7', [-1, 0, 2, 0, 1, 0], 'Am7'],
    ['Dsus4', [-1, -1, 0, 2, 3, 3], 'Dsus4'],
    ['Dsus2', [-1, -1, 0, 2, 3, 0], 'Dsus2'],
    ['E7#9 Hendrix', [0, 7, 6, 7, 8, -1], 'E7♯9'],
    ['Bm7b5', [-1, 2, 3, 2, 3, -1], 'Bm7♭5'],
    ['Cdim7', [-1, 3, 4, 2, 4, -1], 'Cdim7'],
    ['G/B first inversion', [-1, 2, 0, 0, 0, 3], 'G/B'],
    ['power chord', [3, 5, 5, -1, -1, -1], 'G5'],
    ['Fmaj7', [-1, -1, 3, 2, 1, 0], 'Fmaj7'],
    ['Fmaj7#11 (no 5th)', [-1, -1, 3, 2, 0, 0], 'Fmaj7♯11'],
  ];
  for (const [label, frets, expected] of cases) it(label, () => expect(name(frets)).toBe(expected));

  it('reports inversions', () => {
    expect(identify(play([-1, 2, 0, 0, 0, 3]))[0].inversion).toBe('1st inversion');
    expect(identify(play([3, -1, 2, 0, 1, 0]))[0].inversion).toBe('2nd inversion');
  });
  it('custom DADGAD shape', () => {
    const dadgad = parseTuning('D2 A2 D3 G3 A3 D4');
    expect(name([0, 0, 4, 2, 0, 0], dadgad)).toBe('D');
    expect(name([0, 0, 0, 2, 0, 0], dadgad)).toBe('D5');
    expect(name([0, 0, 0, 0, 0, 0], dadgad)).toBe('Dsus4');
  });
});

describe('spelling', () => {
  it('spells chord tones by letter', () => {
    const eb = parseNote('Eb')!.spelling;
    expect(spellingName(spellDegree(eb, 'b7'))).toBe('D♭');
    expect(spellingName(spellDegree(eb, '3'))).toBe('G');
    const fs = parseNote('F#')!.spelling;
    expect(spellingName(spellDegree(fs, '3'))).toBe('A♯');
    expect(spellingName(spellDegree(parseNote('C')!.spelling, 'bb7'))).toBe('B𝄫');
  });
  it('octave follows the letter', () => expect(midiName(60, { letter: 6, acc: 1 })).toBe('B♯3'));
  it('Ab major tones', () => {
    const m = identify([56, 60, 63])[0];
    expect(m.tones.map(t => t.name)).toEqual(['A♭', 'C', 'E♭']);
  });
});

describe('parser', () => {
  it.each([['Ebmaj7', 'E♭', 'maj7'], ['F#m7b5', 'F♯', 'm7♭5'], ['Cadd9/G', 'C', 'add9'], ['Bb13', 'B♭', '13'], ['Am', 'A', 'm'], ['CM7', 'C', 'maj7'], ['Gsus', 'G', 'sus4']])('%s', (s, root, sym) => {
    const p = parseChord(s)!;
    expect(p.rootName).toBe(root);
    expect(p.type.symbol).toBe(sym);
  });
  it('rejects junk', () => expect(parseChord('Hello')).toBeNull());
  it('every symbol round-trips', () => {
    for (const t of CHORD_TYPES) expect(parseChord('C' + t.symbol)?.type.symbol, t.symbol).toBe(t.symbol);
  });
});

describe('keys and scales', () => {
  it('G is I in G major and V in C major', () => {
    const k = keysForChord(identify(play([3, 2, 0, 0, 0, 3]))[0]).map(x => `${x.numeral} ${x.key}`);
    expect(k).toContain('I G major');
    expect(k).toContain('V C major');
  });
  it('E7 is V7 in A harmonic minor', () => {
    const k = keysForChord(identify(play([0, 2, 0, 1, 0, 0]))[0]).map(x => `${x.numeral} ${x.key}`);
    expect(k).toContain('V7 A harmonic minor');
  });
  it('scales over Am7 include Dorian and minor pentatonic', () => {
    const s = scalesForChord(identify(play([-1, 0, 2, 0, 1, 0]))[0]).map(x => x.scale.name);
    expect(s).toContain('Dorian');
    expect(s).toContain('Minor pentatonic');
  });
});

describe('voicing generator', () => {
  it('finds the open C shape in standard tuning', () => {
    const p = parseChord('C')!;
    const v = findVoicings(STD, p.root, p.type, null).map(x => x.frets.join(','));
    expect(v).toContain('-1,3,2,0,1,0');
  });
  it('every voicing it returns names back to the requested chord', () => {
    for (const sym of ['Am7', 'Dmaj7', 'G7', 'Bbmaj9', 'F#m', 'Esus4']) {
      const p = parseChord(sym)!;
      for (const v of findVoicings(STD, p.root, p.type, null)) {
        const notes = play(v.frets);
        const pcs = new Set(notes.map(m => ((m % 12) + 12) % 12));
        for (const r of p.type.required) expect(pcs.has((p.root + r) % 12), `${sym} ${v.frets}`).toBe(true);
      }
    }
  });
  it('works on a ukulele', () => {
    const p = parseChord('C')!;
    const v = findVoicings(parseTuning('G4 C4 E4 A4'), p.root, p.type, null).map(x => x.frets.join(','));
    expect(v).toContain('0,0,0,3');
  });
});
