import { renderPluck } from './ks';

/**
 * Low-latency sound engine (plain Web Audio, no framework).
 *
 * - One AudioContext with latencyHint "interactive"; notes start at currentTime (no look-ahead queue).
 * - Recorded samples are fetched + decoded ahead of time; each note uses the nearest recording,
 *   pitch-shifted by playbackRate to the EXACT equal-tempered frequency, including a per-sample
 *   correction measured at build time (manifest "cents").
 * - Until a bank is decoded (or above/below its range) notes use an exactly-tuned Karplus–Strong string,
 *   so the very first tap is never silent and never late.
 * - Per-string choke: re-plucking a string stops its previous note, like a real instrument.
 */
interface SampleInfo { note: string; midi: number; cents: number }
interface LoadedSample extends SampleInfo { buffer: AudioBuffer }
type Manifest = Record<string, SampleInfo[]>;

const BASE = '/samples/';
let manifestP: Promise<Manifest> | null = null;
const getManifest = (): Promise<Manifest> => (manifestP ??= fetch(BASE + 'manifest.json').then(r => r.json() as Promise<Manifest>));

export class AudioEngine {
  ctx: AudioContext | null = null;
  a4 = 440;
  private bus!: GainNode;
  private banks = new Map<string, LoadedSample[]>();
  private loading = new Map<string, Promise<void>>();
  private raw = new Map<string, Promise<ArrayBuffer[]>>();
  private ks = new Map<string, AudioBuffer>();
  private voices = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  onBankReady?: (bank: string) => void;

  /** Create the context and graph. Safe to call before any gesture (it starts suspended). */
  ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.2;
    const master = ctx.createGain(); master.gain.value = 0.9;
    this.bus = ctx.createGain();
    const send = ctx.createGain(); send.gain.value = 0.16;
    const verb = ctx.createConvolver(); verb.buffer = this.impulse(ctx, 1.9);
    this.bus.connect(comp); this.bus.connect(send); send.connect(verb); verb.connect(comp);
    comp.connect(master); master.connect(ctx.destination);
    this.ctx = ctx;
    return ctx;
  }
  /** Must run inside a user gesture (pointerdown/keydown) — browsers keep audio locked until then. */
  unlock() { const c = this.ensure(); if (c.state !== 'running') void c.resume(); }

  private impulse(ctx: AudioContext, seconds: number) {
    const len = Math.floor(seconds * ctx.sampleRate), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  /** Download a bank's files (no AudioContext needed) — call during idle time. */
  prefetch(bank: string) {
    if (!this.raw.has(bank)) {
      this.raw.set(bank, getManifest().then((m: Manifest) => Promise.all(m[bank].map((s: SampleInfo) => fetch(`${BASE}${bank}/${s.note}.mp3`).then(r => r.arrayBuffer())))));
    }
    return this.raw.get(bank)!;
  }
  /** Download + decode a bank. Resolves when every recording is ready. */
  load(bank: string): Promise<void> {
    if (this.banks.has(bank)) return Promise.resolve();
    if (!this.loading.has(bank)) {
      const ctx = this.ensure();
      const p = Promise.all([getManifest(), this.prefetch(bank)]).then(async ([m, files]) => {
        const decoded = await Promise.all(files.map(ab => ctx.decodeAudioData(ab.slice(0))));
        this.banks.set(bank, m[bank].map((s: SampleInfo, i: number) => ({ ...s, buffer: decoded[i] })).sort((a: LoadedSample, b: LoadedSample) => a.midi - b.midi));
        this.onBankReady?.(bank);
      }).catch(err => { console.warn('sample bank failed, using synth', bank, err); this.loading.delete(bank); });
      this.loading.set(bank, p);
    }
    return this.loading.get(bank)!;
  }
  isReady(bank: string) { return this.banks.has(bank); }

  private pluckBuffer(midi: number, bright: number) {
    const ctx = this.ensure(), key = `${midi}:${bright}:${this.a4}`;
    let b = this.ks.get(key);
    if (!b) {
      const f = this.a4 * 2 ** ((midi - 69) / 12);
      const data = renderPluck(f, ctx.sampleRate, { seconds: midi < 40 ? 3.2 : 2.6, brightness: bright, seed: midi * 7919 });
      b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.getChannelData(0).set(data);
      this.ks.set(key, b);
    }
    return b;
  }

  /**
   * Play one note.
   * @param string  choke group — a new note on the same group stops the previous one
   */
  play(midi: number, opts: { bank: string; when?: number; velocity?: number; string?: string; duration?: number } ) {
    const ctx = this.ensure();
    const when = Math.max(ctx.currentTime, opts.when ?? 0);
    const vel = opts.velocity ?? 0.85;
    const samples = this.banks.get(opts.bank);
    let buffer: AudioBuffer, rate = 1, gainTrim = 1;
    let nearest: LoadedSample | null = null;
    if (samples) for (const s of samples) if (!nearest || Math.abs(s.midi - midi) < Math.abs(nearest.midi - midi)) nearest = s;
    if (nearest && Math.abs(nearest.midi - midi) <= 4) {
      buffer = nearest.buffer;
      rate = 2 ** ((midi - nearest.midi) / 12 - nearest.cents / 1200) * (this.a4 / 440);
    } else {
      buffer = this.pluckBuffer(midi, opts.bank === 'guitar-electric' ? 0.75 : opts.bank === 'bass-electric' ? 0.35 : 0.6);
      gainTrim = 0.7;
    }
    if (opts.string) {
      const prev = this.voices.get(opts.string);
      if (prev) { prev.gain.gain.cancelScheduledValues(when); prev.gain.gain.setTargetAtTime(0, when, 0.015); prev.src.stop(when + 0.12); }
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vel * vel * gainTrim, when);
    if (opts.duration) { gain.gain.setTargetAtTime(0, when + opts.duration, 0.25); }
    src.connect(gain); gain.connect(this.bus);
    src.start(when);
    if (opts.string) {
      const key = opts.string, v = { src, gain };
      this.voices.set(key, v);
      src.onended = () => { if (this.voices.get(key) === v) this.voices.delete(key); };
    }
  }
  /** Stop a string immediately (muting it). */
  damp(string: string) {
    const v = this.voices.get(string); if (!v || !this.ctx) return;
    v.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02); v.src.stop(this.ctx.currentTime + 0.15);
    this.voices.delete(string);
  }
  now() { return this.ensure().currentTime; }
}

export const engine = new AudioEngine();
