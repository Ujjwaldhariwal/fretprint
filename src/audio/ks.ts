/**
 * Karplus–Strong plucked string with exact tuning.
 *
 * The loop delay of a basic KS string is L + 0.5 samples (delay line + two-point averaging filter),
 * which can't hit an arbitrary frequency. A first-order all-pass in the loop adds the missing
 * fractional delay d, so the total loop delay equals sampleRate / frequency exactly (Jaffe & Smith, 1983).
 */
export interface PluckOptions {
  seconds?: number;      // rendered length
  t60?: number;          // time for the note to decay by 60 dB
  brightness?: number;   // 0..1, low-pass amount on the excitation
  position?: number;     // pluck position along the string, 0..0.5 (comb filter on the excitation)
  seed?: number;
}

export function renderPluck(freq: number, sampleRate: number, o: PluckOptions = {}): Float32Array {
  const seconds = o.seconds ?? 3;
  const t60 = o.t60 ?? Math.max(1.2, Math.min(4, 520 / freq));
  const brightness = o.brightness ?? 0.6;
  const position = o.position ?? 0.14;
  let seed = o.seed ?? 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

  const D = sampleRate / freq;                     // required total loop delay
  const L = Math.floor(D - 0.5 - 0.1);             // integer part; keeps d in [0.1, 1.1) for a stable all-pass
  const d = D - 0.5 - L;
  const C = (1 - d) / (1 + d);
  const g = Math.pow(10, -3 / (freq * t60));       // per-period loss so the note reaches -60 dB at t60

  // excitation: filtered noise burst, combed for pluck position
  const exc = new Float32Array(L);
  let lp = 0;
  const a = 0.15 + 0.8 * brightness;
  for (let i = 0; i < L; i++) { lp += a * (rand() - lp); exc[i] = lp; }
  const p = Math.max(1, Math.round(position * L));
  for (let i = L - 1; i >= p; i--) exc[i] -= exc[i - p];
  let mean = 0; for (let i = 0; i < L; i++) mean += exc[i]; mean /= L;
  for (let i = 0; i < L; i++) exc[i] -= mean;      // no DC

  const total = Math.floor(seconds * sampleRate);
  const out = new Float32Array(total);
  const line = new Float32Array(L);
  line.set(exc);
  let idx = 0, prev = 0, apX = 0, apY = 0;
  for (let n = 0; n < total; n++) {
    const y = line[idx];
    const avg = 0.5 * (y + prev);
    prev = y;
    const ap = C * avg + apX - C * apY;
    apX = avg; apY = ap;
    line[idx] = ap * g;
    out[n] = y;
    if (++idx === L) idx = 0;
  }
  // normalise and add a short fade-out at the tail
  let peak = 0; for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(out[i]));
  const k = peak > 0 ? 0.8 / peak : 1, fade = Math.floor(0.05 * sampleRate);
  for (let i = 0; i < total; i++) out[i] *= k * (i > total - fade ? (total - i) / fade : 1);
  return out;
}
