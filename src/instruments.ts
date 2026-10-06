import { noteToMidi } from './theory/notes';

export type ToneId = 'acoustic' | 'nylon' | 'electric' | 'bass';
export interface Instrument { id: string; name: string; short: string; frets: number; tones: ToneId[]; tunings: [string, string][] }

export const TONES: Record<ToneId, { label: string; bank: string }> = {
  acoustic: { label: 'Steel acoustic', bank: 'guitar-acoustic' },
  nylon: { label: 'Nylon', bank: 'guitar-nylon' },
  electric: { label: 'Clean electric', bank: 'guitar-electric' },
  bass: { label: 'Electric bass', bank: 'bass-electric' },
};

/** Strings are listed from the lowest-numbered course on the bass side (string N) to string 1. */
export const INSTRUMENTS: Instrument[] = [
  { id: 'g6', name: 'Guitar', short: 'Guitar', frets: 15, tones: ['acoustic', 'nylon', 'electric'], tunings: [
    ['Standard', 'E2 A2 D3 G3 B3 E4'], ['Drop D', 'D2 A2 D3 G3 B3 E4'], ['Half step down', 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4'],
    ['Whole step down', 'D2 G2 C3 F3 A3 D4'], ['Drop C#', 'C#2 G#2 C#3 F#3 A#3 D#4'], ['Drop C', 'C2 G2 C3 F3 A3 D4'], ['Drop B', 'B1 F#2 B2 E3 G#3 C#4'],
    ['DADGAD', 'D2 A2 D3 G3 A3 D4'], ['Open D', 'D2 A2 D3 F#3 A3 D4'], ['Open D minor', 'D2 A2 D3 F3 A3 D4'],
    ['Open G', 'D2 G2 D3 G3 B3 D4'], ['Open E', 'E2 B2 E3 G#3 B3 E4'], ['Open A', 'E2 A2 E3 A3 C#4 E4'], ['Open C', 'C2 G2 C3 G3 C4 E4'],
    ['Open C6', 'C2 A2 C3 G3 C4 E4'], ['Nashville', 'E3 A3 D4 G4 B3 E4'], ['All fourths', 'E2 A2 D3 G3 C4 F4'], ['New standard', 'C2 G2 D3 A3 E4 G4']] },
  { id: 'g7', name: '7-string guitar', short: '7-string', frets: 15, tones: ['electric', 'acoustic'], tunings: [
    ['Standard', 'B1 E2 A2 D3 G3 B3 E4'], ['Drop A', 'A1 E2 A2 D3 G3 B3 E4'], ['Half step down', 'Bb1 Eb2 Ab2 Db3 Gb3 Bb3 Eb4']] },
  { id: 'b4', name: 'Bass', short: 'Bass', frets: 15, tones: ['bass'], tunings: [
    ['Standard', 'E1 A1 D2 G2'], ['Drop D', 'D1 A1 D2 G2'], ['Half step down', 'Eb1 Ab1 Db2 Gb2'], ['BEAD', 'B0 E1 A1 D2']] },
  { id: 'b5', name: '5-string bass', short: '5-string bass', frets: 15, tones: ['bass'], tunings: [['Standard', 'B0 E1 A1 D2 G2'], ['High C', 'E1 A1 D2 G2 C3']] },
  { id: 'uke', name: 'Ukulele', short: 'Ukulele', frets: 15, tones: ['nylon'], tunings: [['Standard (high G)', 'G4 C4 E4 A4'], ['Low G', 'G3 C4 E4 A4'], ['D tuning', 'A4 D4 F#4 B4']] },
  { id: 'bari', name: 'Baritone ukulele', short: 'Baritone uke', frets: 15, tones: ['nylon'], tunings: [['Standard', 'D3 G3 B3 E4']] },
  { id: 'mando', name: 'Mandolin', short: 'Mandolin', frets: 15, tones: ['acoustic'], tunings: [['Standard', 'G3 D4 A4 E5'], ['Cross AEAE', 'A3 E4 A4 E5']] },
  { id: 'banjo', name: 'Banjo (5-string)', short: 'Banjo', frets: 15, tones: ['acoustic'], tunings: [['Open G', 'G4 D3 G3 B3 D4'], ['Double C', 'G4 C3 G3 C4 D4'], ['Open D', 'F#4 D3 F#3 A3 D4']] },
];
export const instrumentById = (id: string) => INSTRUMENTS.find(i => i.id === id) ?? INSTRUMENTS[0];
export const parseTuning = (s: string) => s.split(' ').map(n => noteToMidi(n)!);
