import { INSTRUMENTS, instrumentById, parseTuning, type ToneId } from './instruments';
import { midiName, noteToMidi } from './theory/notes';

export interface SavedChord { id: string; name: string; chord: string; inst: string; tone: ToneId; tuning: number[]; capo: number; frets: number[]; notes: number[] }
export interface State {
  inst: string; tone: ToneId; tuning: number[]; capo: number; frets: number[];
  labels: 'notes' | 'degrees'; a4: number; tab: 'board' | 'tuner';
  saved: SavedChord[]; myTunings: Record<string, { name: string; notes: number[] }[]>;
}

const KEY = 'fretprint:v1';
function load(): Partial<State> { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }

const defaults: State = {
  inst: 'g6', tone: 'acoustic', tuning: parseTuning(INSTRUMENTS[0].tunings[0][1]), capo: 0, frets: [-1, 3, 2, 0, 1, 0],
  labels: 'notes', a4: 440, tab: 'board', saved: [], myTunings: {},
};
export const S: State = { ...defaults, ...load() };
// repair anything stale from an older version
if (!INSTRUMENTS.some(i => i.id === S.inst)) Object.assign(S, defaults);
if (!instrumentById(S.inst).tones.includes(S.tone)) S.tone = instrumentById(S.inst).tones[0];
if (S.frets.length !== S.tuning.length) S.frets = S.tuning.map(() => 0);

type Topic = 'shape' | 'setup' | 'saved' | 'labels' | 'tab';
const subs = new Map<Topic, Set<() => void>>();
export function on(topic: Topic, fn: () => void) { if (!subs.has(topic)) subs.set(topic, new Set()); subs.get(topic)!.add(fn); }
let saveTimer = 0;
export function emit(...topics: Topic[]) {
  for (const t of topics) subs.get(t)?.forEach(fn => fn());
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } }, 250);
}

export const inst = () => instrumentById(S.inst);
export const stringMidi = (i: number) => (S.frets[i] < 0 ? null : S.tuning[i] + S.capo + S.frets[i]);
export const sounding = () => S.frets.map((_, i) => stringMidi(i)).filter((m): m is number => m != null);
export function tuningName(): string | null {
  const key = S.tuning.join(',');
  const b = inst().tunings.find(([, s]) => parseTuning(s).join(',') === key);
  if (b) return b[0];
  return (S.myTunings[S.inst] || []).find(t => t.notes.join(',') === key)?.name ?? null;
}
export const shapeText = (frets: number[]) => { const wide = frets.some(f => f > 9); return frets.map(f => (f < 0 ? 'x' : String(f))).join(wide ? '-' : ''); };

/* ---------- share links: #g6/E2.A2.D3.G3.B3.E4/0/x.3.2.0.1.0 ---------- */
export function toHash() {
  return `#${S.inst}/${S.tuning.map(m => midiName(m, undefined, false)).join('.')}/${S.capo}/${S.frets.map(f => (f < 0 ? 'x' : f)).join('.')}`;
}
export function fromHash(h: string): boolean {
  const m = /^#([a-z0-9]+)\/([A-Gb#0-9.\-]+)\/(\d+)\/([x0-9.]+)$/.exec(h);
  if (!m || !INSTRUMENTS.some(i => i.id === m[1])) return false;
  const tuning = m[2].split('.').map(n => noteToMidi(n));
  const frets = m[4].split('.').map(f => (f === 'x' ? -1 : +f));
  if (tuning.some(t => t == null) || tuning.length !== frets.length) return false;
  S.inst = m[1]; S.tuning = tuning as number[]; S.capo = Math.min(12, +m[3]); S.frets = frets;
  if (!inst().tones.includes(S.tone)) S.tone = inst().tones[0];
  return true;
}
