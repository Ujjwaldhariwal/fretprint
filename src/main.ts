import '@fontsource-variable/bricolage-grotesque/wght.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './styles.css';
import { S, on, emit, fromHash } from './state';
import { TONES } from './instruments';
import { engine } from './audio/engine';
import { mountBoard, renderBoard, renderMarkers, pluck } from './ui/board';
import { $, renderControls, wireControls, renderChord, renderSaved, wireSaved, wireSearch, renderSearch, strum, playPiano, toast } from './ui/panels';

fromHash(location.hash);
engine.a4 = S.a4;

/* ---------- render wiring ---------- */
mountBoard($<HTMLElement>('#board') as unknown as SVGSVGElement);
on('shape', () => { renderMarkers(); renderChord(); });
on('setup', () => {
  renderControls(); renderBoard(); renderChord();
  renderSearch(($('#search') as HTMLInputElement).value);
  warmBank();
  tunerMod?.onTuningChanged();
});
on('saved', renderSaved);
on('labels', renderMarkers);

renderControls(); renderBoard(true); renderChord(); renderSaved();
wireControls(); wireSearch(); wireSaved();

/* ---------- labels toggle ---------- */
function setLabels(v: 'notes' | 'degrees') {
  S.labels = v;
  $('#lblNotes').setAttribute('aria-pressed', String(v === 'notes'));
  $('#lblDegrees').setAttribute('aria-pressed', String(v === 'degrees'));
  emit('labels');
}
$('#lblNotes').addEventListener('click', () => setLabels('notes'));
$('#lblDegrees').addEventListener('click', () => setLabels('degrees'));
setLabels(S.labels);

/* ---------- playback buttons (pointerdown = no click delay) ---------- */
const press = (id: string, fn: () => void) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
press('#btnStrum', () => strum('down'));
press('#btnStrumUp', () => strum('up'));
press('#btnArp', () => strum('arp'));
press('#btnPiano', () => playPiano(S.frets.map((f, i) => (f < 0 ? null : S.tuning[i] + S.capo + f)).filter((m): m is number => m != null)));
$('#piano').addEventListener('pointerdown', e => {
  const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]'); if (!k) return;
  engine.unlock(); engine.play(+k.dataset.k!, { bank: 'piano', velocity: 0.8, string: 'pk' + k.dataset.k, duration: 2 });
});
$('#btnReset').addEventListener('click', () => { S.frets = S.tuning.map(() => 0); emit('shape'); });

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  const tag = (e.target as HTMLElement).tagName;
  if (/INPUT|SELECT|TEXTAREA/.test(tag) || e.metaKey || e.ctrlKey || e.altKey || S.tab !== 'board') return;
  engine.unlock();
  if (e.code === 'Space') { e.preventDefault(); strum(e.shiftKey ? 'up' : 'down'); }
  else if (e.key === 'a' || e.key === 'A') strum('arp');
  else if (e.key === 'p' || e.key === 'P') $('#btnPiano').dispatchEvent(new PointerEvent('pointerdown'));
  else if (e.key === 'c' || e.key === 'C') $('#btnReset').click();
  else if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
  else if (/^[1-9]$/.test(e.key)) { const n = S.tuning.length, i = n - +e.key; if (i >= 0) pluck(i); }
});

/* ---------- tabs (tuner is code-split and loads on first open) ---------- */
let tunerMod: typeof import('./tuner') | null = null;
async function setTab(t: 'board' | 'tuner') {
  S.tab = t; emit('tab');
  $('#viewBoard').hidden = t !== 'board'; $('#viewTuner').hidden = t !== 'tuner';
  $('#tabBoard').setAttribute('aria-pressed', String(t === 'board')); $('#tabTuner').setAttribute('aria-pressed', String(t === 'tuner'));
  $('#capoField').hidden = t !== 'board';
  if (t === 'tuner') { tunerMod ??= await import('./tuner'); tunerMod.mountTuner(); }
  else tunerMod?.stop();
}
$('#tabBoard').addEventListener('click', () => setTab('board'));
$('#tabTuner').addEventListener('click', () => setTab('tuner'));
if (S.tab === 'tuner') void setTab('tuner');

/* ---------- audio warm-up ---------- */
// Download the current instrument's recordings while the browser is idle, decode them as soon as
// the user first touches the page. Until then every note is an exactly-tuned synthesized string.
function warmBank() {
  const bank = TONES[S.tone].bank;
  const status = $('#soundStatus');
  if (engine.isReady(bank)) { status.textContent = ''; return; }
  status.textContent = 'loading';
  engine.prefetch(bank);
  if (engine.ctx) void engine.load(bank);
}
engine.onBankReady = bank => { if (bank === TONES[S.tone].bank) $('#soundStatus').textContent = ''; };
const idle = (fn: () => void) => ('requestIdleCallback' in window ? (window as any).requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
idle(() => { engine.ensure(); warmBank(); });   // build the audio graph before the first tap
window.addEventListener('pointerdown', () => { engine.unlock(); void engine.load(TONES[S.tone].bank); idle(() => engine.prefetch('piano')); }, { once: true, capture: true });
window.addEventListener('keydown', () => { engine.unlock(); void engine.load(TONES[S.tone].bank); }, { once: true, capture: true });

window.addEventListener('hashchange', () => { if (fromHash(location.hash)) emit('setup', 'shape'); });

/* ---------- offline support ---------- */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
if (location.hash && fromHash(location.hash)) toast('Opened a shared shape');
