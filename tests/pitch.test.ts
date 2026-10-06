import { describe, it, expect } from 'vitest';
import { PitchDetector } from 'pitchy';
import { renderPluck } from '../src/audio/ks';
import manifest from '../public/samples/manifest.json';

const SR = 48000;
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

function measure(buf: Float32Array, expectHz: number) {
  const N = expectHz < 60 ? 16384 : 8192, det = PitchDetector.forFloat32Array(N);
  const [f, c] = det.findPitch(buf.subarray(Math.floor(0.25 * SR), Math.floor(0.25 * SR) + N), SR);
  return { cents: 1200 * Math.log2(f / expectHz), clarity: c };
}

describe('built-in plucked string is exactly in tune', () => {
  for (const m of [28, 31, 40, 45, 50, 55, 59, 64, 69, 76, 81, 88]) {
    it(`MIDI ${m} (${hz(m).toFixed(2)} Hz) within ±1.5 cents`, () => {
      const { cents, clarity } = measure(renderPluck(hz(m), SR, { seconds: 1 }), hz(m));
      expect(clarity).toBeGreaterThan(0.8);
      expect(Math.abs(cents)).toBeLessThan(1.5);
    });
  }
});

describe('sample bank', () => {
  it('has a recording within 2 semitones of every note inside its range (outside it, the engine uses the exact synth)', () => {
    const ranges: Record<string, [number, number]> = { 'guitar-acoustic': [35, 88], 'guitar-nylon': [35, 88], 'guitar-electric': [35, 88], 'bass-electric': [23, 67], piano: [36, 96] };
    for (const [bank, [lo, hi]] of Object.entries(ranges)) {
      const ms = (manifest as Record<string, { midi: number }[]>)[bank].map(s => s.midi);
      for (let m = Math.max(lo, ms[0]); m <= Math.min(hi, ms[ms.length - 1]); m++) {
        const nearest = Math.min(...ms.map(x => Math.abs(x - m)));
        expect(nearest, `${bank} ${m}`).toBeLessThanOrEqual(2);
      }
    }
  });
});
