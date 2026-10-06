import { S, inst, stringMidi, sounding, emit } from '../state';
import { TONES } from '../instruments';
import { engine } from '../audio/engine';
import { identify, pc, INTERVAL_SHORT, defaultSpelling, spellingName, midiName } from '../theory';

/**
 * Fretboard renderer.
 * The board (wood, frets, strings, hit areas) is rebuilt only when the instrument, tuning, capo or tone changes.
 * Taps only rewrite the small marker layer, so a tap costs a few microseconds of DOM work,
 * and sound starts on pointerdown, before any rendering.
 */
interface Geo { n: number; N: number; W: number; H: number; LBL: number; NUTX: number; X0: number; X1: number; TOP: number; boardH: number; gap: number; xs: number[]; y: (i: number) => number; fx: (f: number) => number }
let G: Geo;
let svg: SVGSVGElement, markers: SVGGElement, ghost: SVGCircleElement;
let builtKey = '';

function geometry(): Geo {
  const n = S.tuning.length, N = inst().frets;
  const W = 1240, LBL = 52, OPEN = 46, NUTX = LBL + OPEN, X0 = NUTX + 9, X1 = W - 12;
  const gap = n <= 4 ? 46 : n === 5 ? 40 : n === 6 ? 35 : 31, EDGE = 19, TOP = 10, boardH = (n - 1) * gap + EDGE * 2;
  const xs: number[] = [];
  for (let f = 0; f <= N; f++) xs[f] = X0 + (X1 - X0) * (0.62 * (1 - 2 ** (-f / 12)) / (1 - 2 ** (-N / 12)) + 0.38 * f / N);
  return { n, N, W, H: TOP + boardH + 30, LBL, NUTX, X0, X1, TOP, boardH, gap, xs, y: i => TOP + EDGE + (n - 1 - i) * gap, fx: f => xs[f] - (xs[f] - xs[f - 1]) * 0.45 };
}
function stringLook(m: number) {
  const w = Math.max(1, Math.min(4.2, 3.7 - (m - 28) * 0.062));
  const nylon = S.tone === 'nylon';
  const wound = nylon ? m < 52 : m <= 55;
  const fill = !wound ? (nylon ? 'url(#gNylon)' : 'url(#gPlain)') : S.tone === 'acoustic' ? 'url(#gBronze)' : 'url(#gSteel)';
  return { w, wound, fill };
}

function build() {
  G = geometry();
  const { n, N, W, H, LBL, NUTX, X0, X1, TOP, boardH, xs } = G;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let grain = '';
  for (let k = 0; k < 24; k++) {
    const y = TOP + rnd() * boardH, a = (rnd() - 0.5) * 7, b = (rnd() - 0.5) * 7;
    grain += `<path d="M${X0} ${y.toFixed(1)}C${X0 + 300} ${(y + a).toFixed(1)} ${X1 - 380} ${(y + b).toFixed(1)} ${X1} ${(y + a / 2).toFixed(1)}" stroke="${rnd() > 0.5 ? '#000' : '#86543a'}" stroke-opacity="${(0.05 + rnd() * 0.08).toFixed(3)}" stroke-width="${(0.6 + rnd() * 1.6).toFixed(2)}" fill="none"/>`;
  }
  const mid = TOP + boardH / 2;
  let s = `<defs>
    <linearGradient id="gWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c261a"/><stop offset=".5" stop-color="#2b1a11"/><stop offset="1" stop-color="#352116"/></linearGradient>
    <linearGradient id="gFret" x1="0" x2="1"><stop offset="0" stop-color="#7d8086"/><stop offset=".5" stop-color="#f4f5f7"/><stop offset="1" stop-color="#868990"/></linearGradient>
    <linearGradient id="gNut" x1="0" x2="1"><stop offset="0" stop-color="#d6caaf"/><stop offset=".5" stop-color="#f6efe0"/><stop offset="1" stop-color="#c8ba9b"/></linearGradient>
    <linearGradient id="gPlain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f7f7"/><stop offset="1" stop-color="#9c9fa4"/></linearGradient>
    <linearGradient id="gSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e6ea"/><stop offset=".55" stop-color="#a2a6ad"/><stop offset="1" stop-color="#6d7178"/></linearGradient>
    <linearGradient id="gBronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1d3a1"/><stop offset=".55" stop-color="#c3945a"/><stop offset="1" stop-color="#83592d"/></linearGradient>
    <linearGradient id="gNylon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf6ea"/><stop offset="1" stop-color="#cfc6b0"/></linearGradient>
    <linearGradient id="gCapo" x1="0" x2="1"><stop offset="0" stop-color="#1d1d20"/><stop offset=".45" stop-color="#4a4a50"/><stop offset="1" stop-color="#18181a"/></linearGradient>
    <radialGradient id="gPearl" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#fffdf7"/><stop offset=".6" stop-color="#e6ddcc"/><stop offset="1" stop-color="#b9ad98"/></radialGradient>
    <radialGradient id="gDot" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#f8d08a"/><stop offset="1" stop-color="#d49a3f"/></radialGradient>
    <pattern id="pWound" width="2.2" height="6" patternUnits="userSpaceOnUse"><rect width="1" height="6" fill="#000" fill-opacity=".25"/></pattern>
  </defs>
  <rect x="${X0}" y="${TOP}" width="${X1 - X0}" height="${boardH}" rx="3" fill="url(#gWood)"/>${grain}`;
  for (const f of [3, 5, 7, 9, 15].filter(f => f <= N)) s += `<circle cx="${(xs[f - 1] + xs[f]) / 2}" cy="${mid}" r="7.5" fill="url(#gPearl)" opacity=".9"/>`;
  if (N >= 12) { const cx = (xs[11] + xs[12]) / 2; s += `<circle cx="${cx}" cy="${TOP + boardH * 0.27}" r="7.5" fill="url(#gPearl)" opacity=".9"/><circle cx="${cx}" cy="${TOP + boardH * 0.73}" r="7.5" fill="url(#gPearl)" opacity=".9"/>`; }
  for (let f = 1; f <= N; f++) s += `<rect x="${xs[f] - 1.8}" y="${TOP}" width="3.6" height="${boardH}" fill="url(#gFret)"/>`;
  s += `<rect x="${NUTX}" y="${TOP - 3}" width="9" height="${boardH + 6}" rx="2" fill="url(#gNut)"/>`;
  if (S.capo > 0) s += `<rect x="${X0}" y="${TOP}" width="${xs[S.capo] - 9 - X0}" height="${boardH}" fill="#000" opacity=".42"/>`;
  for (let i = 0; i < n; i++) {
    const y = G.y(i), st = stringLook(S.tuning[i]);
    s += `<g class="str" id="str${i}"><rect x="${LBL + 6}" y="${y - st.w / 2 + 1.4}" width="${X1 + 6 - LBL}" height="${st.w}" fill="#000" opacity=".45"/><rect class="str-body" x="${LBL + 6}" y="${y - st.w / 2}" width="${X1 + 6 - LBL}" height="${st.w}" fill="${st.fill}"/>${st.wound ? `<rect x="${X0}" y="${y - st.w / 2}" width="${X1 + 6 - X0}" height="${st.w}" fill="url(#pWound)"/>` : ''}</g>`;
  }
  if (S.capo > 0) { const cx = xs[S.capo] - 9; s += `<rect x="${cx - 7}" y="${TOP - 7}" width="14" height="${boardH + 14}" rx="6" fill="url(#gCapo)"/>`; }
  for (let f = 1; f <= N; f++) {
    const hi = [3, 5, 7, 9, 12, 15].includes(f);
    s += `<text x="${(xs[f - 1] + xs[f]) / 2}" y="${TOP + boardH + 22}" text-anchor="middle" class="fretnum${hi ? ' hi' : ''}">${f}</text>`;
  }
  s += `<g id="labels"></g><circle id="ghost" r="13" fill="#e3b45f" opacity="0" pointer-events="none"/><g id="markers"></g>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
  markers = svg.querySelector('#markers')!;
  ghost = svg.querySelector('#ghost')!;
}

/** Map a pointer position to (string, fret|'open'). */
function hitTest(e: PointerEvent): { s: number; f: number | 'open' } | null {
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
  const s = G.n - 1 - Math.round((p.y - G.y(G.n - 1)) / G.gap);
  if (s < 0 || s >= G.n || Math.abs(p.y - G.y(s)) > G.gap * 0.5) return null;
  if (p.x >= G.LBL && p.x < G.NUTX) return { s, f: 'open' };
  for (let f = 1; f <= G.N; f++) if (p.x >= G.xs[f - 1] && p.x < G.xs[f]) return f <= S.capo ? { s, f: 'open' } : { s, f };
  return null;
}

export function pluck(i: number, when?: number, velocity?: number) {
  const m = stringMidi(i); if (m == null) return;
  engine.play(m, { bank: TONES[S.tone].bank, string: 's' + i, when, velocity });
  const delay = when ? Math.max(0, (when - engine.now()) * 1000) : 0;
  delay ? setTimeout(() => buzz(i), delay) : buzz(i);
}
export function buzz(i: number) {
  const el = svg.querySelector<SVGGElement>('#str' + i); if (!el) return;
  el.classList.remove('buzz'); void el.getBoundingClientRect(); el.classList.add('buzz');
}

export function renderMarkers() {
  const best = identify(sounding())[0];
  const lbl = (m: number) => S.labels === 'degrees' && best ? INTERVAL_SHORT[pc(m - best.root)]
    : (best?.tones.find(t => t.pc === pc(m))?.name ?? spellingName(defaultSpelling(m))).replace(/\d/g, '');
  let s = '';
  for (let i = 0; i < G.n; i++) {
    const y = G.y(i), f = S.frets[i], ox = G.LBL + (G.NUTX - G.LBL) / 2;
    if (f < 0) s += `<path d="M${ox - 6} ${y - 6}L${ox + 6} ${y + 6}M${ox + 6} ${y - 6}L${ox - 6} ${y + 6}" stroke="#ec7561" stroke-width="2.4" stroke-linecap="round"/>`;
    else if (f === 0) s += `<circle cx="${ox}" cy="${y}" r="12" fill="#13110f" stroke="#e3b45f" stroke-width="2"/><text x="${ox}" y="${y + 4}" text-anchor="middle" class="mk mk-open">${lbl(stringMidi(i)!)}</text>`;
    else {
      const x = G.fx(f + S.capo), m = stringMidi(i)!, root = best && pc(m) === best.root;
      s += `<circle cx="${x}" cy="${y + 1.6}" r="14.5" fill="#000" opacity=".45"/><circle cx="${x}" cy="${y}" r="14.5" fill="url(#gDot)" stroke="${root ? '#fff3d6' : '#9a6a24'}" stroke-width="${root ? 2.4 : 1}"/><text x="${x}" y="${y + 4}" text-anchor="middle" class="mk">${lbl(m)}</text>`;
    }
  }
  markers.innerHTML = s;
  // open-string pitch labels at the far left (dim when muted)
  let l = '';
  for (let i = 0; i < G.n; i++) {
    const m = S.tuning[i] + S.capo, nm = midiName(m), name = nm.replace(/-?\d+$/, '');
    l += `<text x="${G.LBL - 8}" y="${G.y(i) + 5}" text-anchor="end" class="slabel${S.frets[i] < 0 ? ' off' : ''}">${name}<tspan class="oct">${nm.slice(name.length)}</tspan></text>`;
  }
  svg.querySelector('#labels')!.innerHTML = l;
}

export function renderBoard(force = false) {
  const key = [S.inst, S.tuning.join(','), S.capo, S.tone].join('|');
  if (force || key !== builtKey) { build(); builtKey = key; }
  renderMarkers();
}

export function mountBoard(el: SVGSVGElement) {
  svg = el;
  let dragString = -1, downAt: { s: number; f: number | 'open' } | null = null;
  svg.addEventListener('pointerdown', e => {
    const hit = hitTest(e); if (!hit) return;
    engine.unlock();
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    downAt = hit; dragString = hit.s;
    const { s, f } = hit;
    if (f === 'open') {
      S.frets[s] = S.frets[s] === 0 ? -1 : 0;
      if (S.frets[s] < 0) engine.damp('s' + s);
    } else {
      const rel = f - S.capo;
      S.frets[s] = S.frets[s] === rel ? 0 : rel;
    }
    if (S.frets[s] >= 0) pluck(s);           // sound first …
    emit('shape');                            // … then re-render
  });
  // drag across strings to strum them (without changing the shape)
  svg.addEventListener('pointermove', e => {
    const hit = hitTest(e);
    if (e.buttons && downAt) {
      if (hit && hit.s !== dragString) {
        const step = hit.s > dragString ? 1 : -1;
        for (let k = dragString + step; k !== hit.s + step; k += step) pluck(k);
        dragString = hit.s;
      }
      return;
    }
    if (hit && hit.f !== 'open' && e.pointerType === 'mouse') {
      ghost.setAttribute('cx', String(G.fx(hit.f))); ghost.setAttribute('cy', String(G.y(hit.s))); ghost.setAttribute('opacity', '.35');
    } else ghost.setAttribute('opacity', '0');
  });
  const end = () => { downAt = null; dragString = -1; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('pointerleave', () => ghost?.setAttribute('opacity', '0'));
}
