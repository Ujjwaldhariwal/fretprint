import { S, inst, sounding, stringMidi, emit, tuningName, shapeText, toHash } from '../state';
import { INSTRUMENTS, TONES, instrumentById, parseTuning } from '../instruments';
import { engine } from '../audio/engine';
import { pluck } from './board';
import { identify, keysForChord, scalesForChord, parseChord, findVoicings, chordTones, pc, midiName, defaultSpelling, spellingName, prettyDegree, INTERVAL_SHORT, INTERVAL_LONG, type ChordMatch } from '../theory';

export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

let toastT = 0;
export function toast(msg: string, ms = 1800) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = window.setTimeout(() => t.classList.remove('show'), ms);
}
export async function copy(text: string, done = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(done); } catch { toast('Copy blocked by the browser'); }
}

/* ================= playback helpers ================= */
export function strum(mode: 'down' | 'up' | 'arp') {
  engine.unlock();
  const order = S.frets.map((_, i) => i).filter(i => S.frets[i] >= 0);
  const seq = mode === 'up' ? order.reverse() : order;
  const gap = mode === 'arp' ? 0.19 : S.inst.startsWith('b') ? 0.04 : 0.024;
  const t0 = engine.now() + 0.005;
  seq.forEach((i, k) => pluck(i, t0 + k * gap + (mode === 'arp' ? 0 : Math.random() * 0.006), 0.78 + Math.random() * 0.14 - (mode === 'up' ? 0.08 : 0)));
}
export function playPiano(notes: number[]) {
  engine.unlock();
  const t0 = engine.now() + 0.005;
  [...new Set(notes)].sort((a, b) => a - b).forEach((m, k) => engine.play(m, { bank: 'piano', when: t0 + k * 0.012, velocity: 0.8, duration: 2.2 }));
}

/* ================= controls ================= */
export function renderControls() {
  $('#selInst').innerHTML = INSTRUMENTS.map(i => `<option value="${i.id}"${i.id === S.inst ? ' selected' : ''}>${i.name}</option>`).join('');
  const tones = inst().tones;
  $('#selTone').innerHTML = tones.map(t => `<option value="${t}"${t === S.tone ? ' selected' : ''}>${TONES[t].label}</option>`).join('');
  ($('#selTone') as HTMLSelectElement).disabled = tones.length < 2;
  const name = tuningName(), mine = S.myTunings[S.inst] || [];
  let h = (name ? '' : '<option value="" selected>Custom</option>')
    + `<optgroup label="${esc(inst().short)} tunings">` + inst().tunings.map(([n]) => `<option value="b:${esc(n)}"${n === name ? ' selected' : ''}>${esc(n)}</option>`).join('') + '</optgroup>';
  if (mine.length) h += '<optgroup label="My tunings">' + mine.map(t => `<option value="m:${esc(t.name)}"${t.name === name ? ' selected' : ''}>${esc(t.name)}</option>`).join('') + '</optgroup>';
  $('#selTuning').innerHTML = h;
  $('#tuningNotes').textContent = S.tuning.map(m => midiName(m)).join(' ');
  $('#capoOut').textContent = String(S.capo);
  const n = S.tuning.length;
  $('#tChips').innerHTML = S.tuning.map((m, i) => `<div class="tchip"><button data-t="${i}" data-d="-1" aria-label="Lower string ${n - i}">−</button><span>${midiName(m)}<small>STR ${n - i}</small></span><button data-t="${i}" data-d="1" aria-label="Raise string ${n - i}">+</button></div>`).join('');
  const isMine = mine.some(t => t.name === name);
  $('#btnDelTuning').hidden = !isMine;
}

export function wireControls() {
  $('#selInst').addEventListener('change', e => {
    const id = (e.target as HTMLSelectElement).value, ins = instrumentById(id);
    S.inst = id; if (!ins.tones.includes(S.tone)) S.tone = ins.tones[0];
    S.tuning = parseTuning(ins.tunings[0][1]); S.frets = S.tuning.map(() => 0); S.capo = 0;
    emit('setup', 'shape');
  });
  $('#selTone').addEventListener('change', e => { S.tone = (e.target as HTMLSelectElement).value as typeof S.tone; emit('setup'); });
  $('#selTuning').addEventListener('change', e => {
    const v = (e.target as HTMLSelectElement).value; if (!v) return;
    const nm = v.slice(2);
    const notes = v[0] === 'b' ? parseTuning(inst().tunings.find(([n]) => n === nm)![1]) : S.myTunings[S.inst].find(t => t.name === nm)!.notes;
    S.tuning = notes.slice(); if (S.frets.length !== notes.length) S.frets = notes.map(() => 0);
    emit('setup', 'shape');
  });
  $('#btnEditTuning').addEventListener('click', () => {
    const ed = $('#tuningEditor'); ed.hidden = !ed.hidden;
    $('#btnEditTuning').setAttribute('aria-expanded', String(!ed.hidden));
    $('#btnEditTuning').textContent = ed.hidden ? 'Edit tuning' : 'Done';
  });
  $('#tChips').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-t]'); if (!b) return;
    engine.unlock();
    const i = +b.dataset.t!; S.tuning = S.tuning.slice(); S.tuning[i] = Math.max(12, Math.min(96, S.tuning[i] + +b.dataset.d!));
    emit('setup', 'shape');
    if (S.frets[i] >= 0) pluck(i);
  });
  $('#btnSaveTuning').addEventListener('click', () => {
    const name = ($('#tName') as HTMLInputElement).value.trim();
    if (!name) { $('#tName').focus(); toast('Name the tuning first'); return; }
    S.myTunings[S.inst] = [...(S.myTunings[S.inst] || []).filter(t => t.name !== name), { name, notes: S.tuning.slice() }];
    emit('setup'); toast(`Saved tuning “${name}”`);
  });
  $('#btnDelTuning').addEventListener('click', () => {
    const name = tuningName();
    S.myTunings[S.inst] = (S.myTunings[S.inst] || []).filter(t => t.name !== name);
    emit('setup'); toast('Tuning deleted');
  });
  const capo = (d: number) => { S.capo = Math.max(0, Math.min(12, S.capo + d)); S.frets = S.frets.map(f => (f < 0 ? f : Math.min(f, inst().frets - S.capo))); emit('setup', 'shape'); };
  $('#capoDown').addEventListener('click', () => capo(-1));
  $('#capoUp').addEventListener('click', () => capo(1));
}

/* ================= chord card ================= */
function longName(m: ChordMatch) {
  const t = m.type.name;
  return `${m.rootName} ${t}${m.added.length ? ` with added ${m.added.join(' and ')}` : ''}${m.inversion !== 'root position' ? `, ${m.inversion}` : ''}`;
}
export function renderChord() {
  const notes = sounding(), matches = identify(notes), best = matches[0], n = S.tuning.length;
  const nameEl = $('#chordName'), sub = $('#chordSub');
  const uniq = [...new Set(notes.map(pc))];
  if (best) {
    nameEl.className = 'chord-name';
    nameEl.innerHTML = `${esc(best.rootName)}<span class="q">${esc(best.symbol)}</span>${best.bassName ? `<span class="b">/${esc(best.bassName)}</span>` : ''}`;
    sub.textContent = longName(best);
  } else {
    nameEl.className = 'chord-name empty';
    const lowest = Math.min(...notes), a = pc(lowest), other = uniq.find(x => x !== a);
    const dyad = uniq.length === 2 && other != null;
    nameEl.textContent = !notes.length ? 'Silence' : uniq.length === 1 ? spellingName(defaultSpelling(notes[0]))
      : dyad ? `${spellingName(defaultSpelling(a))}–${spellingName(defaultSpelling(other!))}` : 'Cluster';
    sub.textContent = !notes.length ? 'Every string is muted.' : uniq.length === 1 ? (notes.length > 1 ? 'One note, in octaves' : 'A single note')
      : dyad ? `Two-note interval: ${INTERVAL_LONG[pc(other! - a)]} — add a third note to make a chord` : 'These notes don’t form a named chord.';
  }
  $('#chordAlts').innerHTML = matches.length > 1 ? 'Also reads as ' + matches.slice(1).map(m => `<button class="alt" data-n="${esc(m.name)}">${esc(m.name)}</button>`).join(' ') : '';
  // formula: every chord tone with its degree
  $('#formula').innerHTML = best ? best.tones.map(t => `<div class="deg${t.present ? '' : ' absent'}${t.degree === '1' ? ' root' : ''}"><b>${esc(t.name)}</b><span>${prettyDegree(t.degree)}</span></div>`).join('') + (best.omitted.length ? `<div class="omit">${best.omitted.map(prettyDegree).join(', ')} left out</div>` : '') : '';
  // per string
  const cols: string[] = [];
  for (let i = 0; i < n; i++) {
    const m = stringMidi(i), sp = m == null ? null : best?.tones.find(t => t.pc === pc(m));
    const name = m == null ? '×' : sp ? sp.name + midiName(m).replace(/^[^\d-]+/, '') : midiName(m);
    cols.push(`<div class="col${m == null ? ' muted' : ''}${best && m != null && pc(m) === best.root ? ' root' : ''}"><span class="sn">${n - i}</span><span class="nt">${esc(name)}</span><span class="iv">${m == null ? '&nbsp;' : best ? INTERVAL_SHORT[pc(m - best.root)] : ''}</span><span class="fr">${S.frets[i] < 0 ? 'mute' : S.frets[i] === 0 ? 'open' : 'fret ' + (S.frets[i] + S.capo)}</span></div>`);
  }
  const tbl = $('#stringsTable'); tbl.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`; tbl.innerHTML = cols.join('');
  $('#shapeLine').innerHTML = `<span class="label">Shape</span><span class="mono shape-code">${shapeText(S.frets)}</span><span>${S.capo ? `capo ${S.capo} · ` : ''}${esc(inst().short)} · ${esc(tuningName() ?? 'custom tuning')}</span>`;
  renderPiano(notes, best);
  renderTheory(best);
}

/* ================= piano ================= */
export function renderPiano(notes: number[], best?: ChordMatch) {
  const lo = Math.min(...S.tuning), hi = Math.max(...S.tuning) + inst().frets;
  const start = Math.floor(lo / 12) * 12, end = Math.max(start + 35, Math.min(Math.ceil((hi + 1) / 12) * 12 - 1, start + 59));
  const on = new Set(notes), black = (m: number) => [1, 3, 6, 8, 10].includes(pc(m));
  const whites: number[] = []; for (let m = start; m <= end; m++) if (!black(m)) whites.push(m);
  const w = 100 / whites.length;
  const label = (m: number) => best?.tones.find(t => t.pc === pc(m))?.name ?? spellingName(defaultSpelling(m));
  let h = '';
  whites.forEach((m, k) => { const r = best && on.has(m) && pc(m) === best.root; h += `<div class="wk${on.has(m) ? ' on' : ''}${r ? ' root' : ''}" data-k="${m}" style="left:${k * w}%;width:${w}%"><span>${on.has(m) ? esc(label(m)) : pc(m) === 0 ? midiName(m) : ''}</span></div>`; });
  for (let m = start; m <= end; m++) if (black(m)) {
    const k = whites.indexOf(m - 1), r = best && on.has(m) && pc(m) === best.root;
    h += `<div class="bk${on.has(m) ? ' on' : ''}${r ? ' root' : ''}" data-k="${m}" style="left:${(k + 1) * w - w * 0.31}%;width:${w * 0.62}%"><span>${on.has(m) ? esc(label(m)) : ''}</span></div>`;
  }
  const p = $('#piano'); p.style.minWidth = Math.max(420, whites.length * 21) + 'px'; p.innerHTML = h;
  const ordered = [...on].sort((a, b) => a - b);
  $('#noteOrder').textContent = ordered.length ? ordered.map(m => { const l = label(m); return l + midiName(m).replace(/^[^\d-]+/, ''); }).join('  ') : '—';
}

/* ================= theory ================= */
function renderTheory(best?: ChordMatch) {
  const el = $('#theory');
  if (!best) { el.innerHTML = '<p class="empty-note">Build a chord to see the keys it belongs to and the scales that fit over it.</p>'; return; }
  const keys = keysForChord(best), scales = scalesForChord(best);
  el.innerHTML = `
    <div class="label">In these keys</div>
    <div class="keys">${keys.length ? keys.map(k => `<div class="key"><b>${esc(k.numeral)}</b><span>${esc(k.key)}</span></div>`).join('') : '<span class="empty-note">Not diatonic to any major or minor key — it’s borrowed or altered.</span>'}</div>
    <div class="label" style="margin-top:18px">Scales that fit</div>
    <div class="scales">${scales.map(s => `<div class="scale"><b>${esc(s.root)} ${esc(s.scale.name)}</b><span class="mono">${s.notes.map(esc).join(' ')}</span></div>`).join('')}</div>`;
}

/* ================= chord search (reverse lookup) ================= */
export function renderSearch(q: string) {
  const out = $('#searchResults');
  if (!q.trim()) { out.hidden = true; out.innerHTML = ''; return; }
  const p = parseChord(q);
  out.hidden = false;
  if (!p) { out.innerHTML = `<div class="sr-msg">Try a chord symbol like <b>Cmaj7</b>, <b>F♯m7♭5</b>, <b>Dsus2</b> or <b>G/B</b>.</div>`; return; }
  const vs = findVoicings(S.tuning, p.root, p.type, p.bass, { maxFret: inst().frets, limit: 8 });
  const tones = chordTones(p.root, p.rootName, p.type).map(t => t.name).join(' ');
  if (!vs.length) { out.innerHTML = `<div class="sr-msg">No comfortable shape for <b>${esc(p.rootName + p.type.symbol)}</b> in this tuning (${esc(tones)}).</div>`; return; }
  out.innerHTML = `<div class="sr-msg"><b>${esc(p.rootName + p.type.symbol + (p.bassName ? '/' + p.bassName : ''))}</b> · ${esc(p.type.name)} · ${esc(tones)}</div><div class="sr-list">${vs.map(v => `<button class="sr" data-f="${v.frets.join(',')}">${miniDiagram(v.frets)}<span class="mono">${shapeText(v.frets)}</span></button>`).join('')}</div>`;
}
function miniDiagram(frets: number[]) {
  const n = frets.length, fr = frets.filter(f => f > 0), lo = fr.length ? Math.max(1, Math.min(...fr)) : 1, top = lo <= 2 ? 1 : lo;
  const W = 14 + (n - 1) * 12, H = 76;
  let s = `<svg viewBox="0 0 ${W + 16} ${H}" width="${W + 16}" height="${H}" aria-hidden="true">`;
  for (let i = 0; i < n; i++) s += `<line x1="${10 + i * 12}" y1="14" x2="${10 + i * 12}" y2="70" class="d-str"/>`;
  for (let k = 0; k <= 4; k++) s += `<line x1="10" y1="${14 + k * 14}" x2="${10 + (n - 1) * 12}" y2="${14 + k * 14}" class="${k === 0 && top === 1 ? 'd-nut' : 'd-fret'}"/>`;
  frets.forEach((f, i) => {
    const x = 10 + i * 12;
    if (f < 0) s += `<text x="${x}" y="10" class="d-x">×</text>`;
    else if (f === 0) s += `<circle cx="${x}" cy="7" r="3" class="d-o"/>`;
    else s += `<circle cx="${x}" cy="${14 + (f - top) * 14 + 7}" r="4.6" class="d-dot"/>`;
  });
  if (top > 1) s += `<text x="${12 + (n - 1) * 12}" y="25" class="d-pos">${top}</text>`;
  return s + '</svg>';
}
export function wireSearch() {
  const input = $('#search') as HTMLInputElement;
  let t = 0;
  input.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(() => renderSearch(input.value), 60); });
  $('#searchResults').addEventListener('pointerdown', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.sr'); if (!b) return;
    engine.unlock();
    S.frets = b.dataset.f!.split(',').map(Number).map(f => (f > 0 ? Math.max(0, f - S.capo) : f));
    emit('shape'); strum('down');
  });
  $('#chordAlts').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.alt'); if (!b) return;
    input.value = b.dataset.n!; renderSearch(input.value); input.focus();
  });
}

/* ================= saved chords ================= */
export function renderSaved() {
  const el = $('#savedList');
  if (!S.saved.length) { el.innerHTML = '<p class="empty-note">Save your custom shapes here. They stay in this browser.</p>'; return; }
  el.innerHTML = S.saved.map(c => `<div class="srow"><div class="t">${esc(c.name)}<em>${esc(c.chord)}</em></div><div class="d mono">${esc(shapeText(c.frets))}${c.capo ? ' · capo ' + c.capo : ''} · ${c.notes.map(m => midiName(m)).join(' ')}</div><div class="a"><button class="icon-btn" data-a="play" data-id="${c.id}" aria-label="Play">▶</button><button class="icon-btn" data-a="load" data-id="${c.id}" aria-label="Load on fretboard">↺</button><button class="icon-btn" data-a="del" data-id="${c.id}" aria-label="Delete">✕</button></div></div>`).join('');
}
export function wireSaved() {
  $('#btnSave').addEventListener('click', () => {
    const notes = [...new Set(sounding())].sort((a, b) => a - b);
    if (!notes.length) { toast('Place at least one note first'); return; }
    const best = identify(notes)[0];
    const input = $('#saveName') as HTMLInputElement;
    const name = input.value.trim() || `Shape ${S.saved.length + 1}`;
    S.saved.unshift({ id: Math.random().toString(36).slice(2, 9), name, chord: best?.name ?? '', inst: S.inst, tone: S.tone, tuning: S.tuning.slice(), capo: S.capo, frets: S.frets.slice(), notes });
    input.value = ''; emit('saved'); toast(`Saved “${name}”`);
  });
  $('#savedList').addEventListener('pointerdown', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-a]'); if (!b) return;
    const c = S.saved.find(x => x.id === b.dataset.id); if (!c) return;
    if (b.dataset.a === 'del') { S.saved = S.saved.filter(x => x !== c); emit('saved'); toast('Deleted'); return; }
    engine.unlock();
    Object.assign(S, { inst: c.inst, tone: c.tone, tuning: c.tuning.slice(), capo: c.capo, frets: c.frets.slice() });
    emit('setup', 'shape');
    if (b.dataset.a === 'play') strum('down'); else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#btnCopyAll').addEventListener('click', () => {
    if (!S.saved.length) { toast('Nothing saved yet'); return; }
    copy(S.saved.map(c => `${c.name} — ${c.chord || 'notes'}: ${c.notes.map(m => midiName(m)).join(' ')} (${instrumentById(c.inst).short}, ${shapeText(c.frets)}${c.capo ? ', capo ' + c.capo : ''}, tuning ${c.tuning.map(m => midiName(m)).join(' ')})`).join('\n'));
  });
  $('#btnShare').addEventListener('click', () => {
    history.replaceState(null, '', toHash());
    copy(location.href, 'Link copied — it opens this exact shape');
  });
  $('#btnCopyNotes').addEventListener('click', () => {
    const best = identify(sounding())[0];
    copy(`${best ? best.name + ': ' : ''}${$('#noteOrder').textContent}`);
  });
}
