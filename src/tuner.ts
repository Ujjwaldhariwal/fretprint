/* Tuner — loaded only when the Tuner tab is opened (code-split together with the pitch detector). */
import { PitchDetector } from 'pitchy';
import { S, emit } from './state';
import { engine } from './audio/engine';
import { TONES } from './instruments';
import { midiName, midiFromHz, hz } from './theory/notes';

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const T = { running: false, ctx: null as AudioContext | null, stream: null as MediaStream | null, analyser: null as AnalyserNode | null, buf: null as Float32Array<ArrayBuffer> | null, det: null as PitchDetector<Float32Array> | null, hist: [] as number[], target: 0, auto: true, lastHeard: 0, tunedSince: 0, tuned: new Set<number>(), shown: 0, raf: 0 };

function drawGauge() {
  const cx = 260, cy = 250, R = 214;
  const pt = (c: number, r: number) => { const a = ((c * 1.1 - 90) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const [a1, b1] = pt(-5, R), [a2, b2] = pt(5, R);
  let s = `<path d="M${a1} ${b1}A${R} ${R} 0 0 1 ${a2} ${b2}" stroke="var(--good)" stroke-width="10" fill="none" stroke-linecap="round" opacity=".9"/>`;
  for (let c = -50; c <= 50; c += 5) {
    const major = c % 25 === 0, [x1, y1] = pt(c, R - (major ? 22 : c % 10 === 0 ? 14 : 9)), [x2, y2] = pt(c, R - 2);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${major ? 'tick-major' : 'tick'}"/>`;
  }
  for (const [c, t] of [[-50, '−50'], [-25, '−25'], [0, '0'], [25, '+25'], [50, '+50']] as const) { const [x, y] = pt(c, R - 40); s += `<text x="${x}" y="${y + 4}" class="tick-label">${t}</text>`; }
  { const [x, y] = pt(-57, R - 4); s += `<text x="${x - 4}" y="${y + 6}" class="tick-sym">♭</text>`; }
  { const [x, y] = pt(57, R - 4); s += `<text x="${x + 4}" y="${y + 6}" class="tick-sym">♯</text>`; }
  s += `<g id="needle"><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - R + 18}" id="needleLine"/></g><circle cx="${cx}" cy="${cy}" r="11" class="hub"/>`;
  $('#gauge').innerHTML = s;
}
// critically-damped needle: smooth but never lags behind the pitch
let needle = 0, needleTarget = 0, needleActive = false;
function animateNeedle() {
  needle += (needleTarget - needle) * 0.35;
  const n = document.getElementById('needle'), line = document.getElementById('needleLine');
  if (n && line) {
    n.setAttribute('transform', `rotate(${Math.max(-50, Math.min(50, needle)) * 1.1} 260 250)`);
    line.setAttribute('class', !needleActive ? 'needle idle' : Math.abs(needleTarget) < 5 ? 'needle good' : 'needle');
  }
}

export function renderStrings() {
  const n = S.tuning.length;
  $('#tStrings').innerHTML = S.tuning.map((m, i) => `<button class="pill${T.target === i && T.lastHeard ? ' target' : ''}${T.tuned.has(i) ? ' tuned' : ''}" data-i="${i}"><small>STR ${n - i}</small><b>${midiName(m)}</b>${T.tuned.has(i) ? '<i>✓</i>' : ''}</button>`).join('');
  $('#a4Out').textContent = String(S.a4);
}

async function start() {
  try {
    T.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    T.ctx = new AudioContext({ latencyHint: 'interactive' });
    const src = T.ctx.createMediaStreamSource(T.stream);
    const size = Math.min(...S.tuning) < 40 ? 8192 : 4096;
    T.analyser = T.ctx.createAnalyser(); T.analyser.fftSize = size;
    src.connect(T.analyser);
    T.buf = new Float32Array(size);
    T.det = PitchDetector.forFloat32Array(size);
    T.det.minVolumeDecibels = -45;
    T.running = true; T.hist = [];
    $('#btnMic').textContent = 'Stop tuner'; $('#btnMic').classList.remove('primary');
    $('#tRead').textContent = 'Listening — play one string';
    loop();
  } catch (err) {
    const e = err as DOMException;
    $('#tRead').textContent = e.name === 'NotAllowedError'
      ? 'Microphone blocked. Allow it from the address bar (and in System Settings → Privacy & Security → Microphone on a Mac).'
      : 'Could not open the microphone: ' + e.message;
  }
}
export function stop() {
  if (!T.running) return;
  T.running = false; cancelAnimationFrame(T.raf);
  T.stream?.getTracks().forEach(t => t.stop()); T.ctx?.close();
  $('#btnMic').textContent = 'Start tuner'; $('#btnMic').classList.add('primary');
  $('#tNote').className = 't-note idle'; $('#tNote').textContent = '—'; $('#tRead').textContent = 'Start the tuner and play one string'; $('#tHint').textContent = '';
  needleTarget = 0; needleActive = false; animateNeedle();
}
const median = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];

function loop() {
  if (!T.running) return;
  T.raf = requestAnimationFrame(loop);
  T.analyser!.getFloatTimeDomainData(T.buf!);
  const [f, clarity] = T.det!.findPitch(T.buf!, T.ctx!.sampleRate);
  const now = performance.now();
  if (clarity > 0.9 && f > 25 && f < 2200) {
    T.hist.push(f); if (T.hist.length > 5) T.hist.shift();
    const fm = median(T.hist), mf = midiFromHz(fm, S.a4);
    if (T.auto) { let best = 0, bd = Infinity; S.tuning.forEach((m, i) => { const d = Math.abs(mf - m); if (d < bd) { bd = d; best = i; } }); T.target = best; }
    const tm = S.tuning[T.target];
    const cents = 1200 * Math.log2(fm / hz(tm, S.a4));
    const near = Math.round(mf), nm = midiName(near), base = nm.replace(/-?\d+$/, '');
    $('#tNote').className = 't-note';
    $('#tNote').innerHTML = `${base}<sub>${nm.slice(base.length)}</sub>`;
    $('#tRead').textContent = `${fm.toFixed(2)} Hz · ${cents >= 0 ? '+' : '−'}${Math.abs(cents).toFixed(1)} cents from ${midiName(tm)}`;
    const h = $('#tHint');
    if (Math.abs(cents) < 4) {
      h.className = 't-hint good'; h.textContent = 'In tune';
      if (!T.tunedSince) T.tunedSince = now;
      if (now - T.tunedSince > 400) T.tuned.add(T.target);
    } else {
      T.tunedSince = 0;
      h.className = 't-hint off';
      h.textContent = Math.abs(cents) > 100 ? (cents < 0 ? 'Far too low — tighten' : 'Far too high — loosen') : cents < 0 ? 'Too low — tighten' : 'Too high — loosen';
    }
    needleTarget = cents; needleActive = true; T.lastHeard = now;
    if (now - T.shown > 160) { T.shown = now; renderStrings(); }
  } else if (T.lastHeard && now - T.lastHeard > 1200) {
    T.hist = []; T.lastHeard = 0; T.tunedSince = 0; needleTarget = 0; needleActive = false;
    $('#tHint').textContent = ''; $('#tNote').className = 't-note idle'; renderStrings();
  }
  animateNeedle();
}

let mounted = false;
export function mountTuner() {
  if (mounted) { renderStrings(); return; }
  mounted = true;
  drawGauge(); renderStrings(); animateNeedle();
  $('#btnMic').addEventListener('click', () => (T.running ? stop() : start()));
  $('#tStrings').addEventListener('pointerdown', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.pill'); if (!b) return;
    const i = +b.dataset.i!;
    if (!T.auto) { T.target = i; renderStrings(); }
    engine.unlock();
    engine.play(S.tuning[i], { bank: TONES[S.tone].bank, string: 'ref' });
  });
  ($('#chkAuto') as HTMLInputElement).addEventListener('change', e => { T.auto = (e.target as HTMLInputElement).checked; });
  $('#a4Down').addEventListener('click', () => { S.a4 = Math.max(415, S.a4 - 1); engine.a4 = S.a4; emit('setup'); renderStrings(); });
  $('#a4Up').addEventListener('click', () => { S.a4 = Math.min(466, S.a4 + 1); engine.a4 = S.a4; emit('setup'); renderStrings(); });
}
export function onTuningChanged() { T.tuned.clear(); if (mounted) renderStrings(); }
