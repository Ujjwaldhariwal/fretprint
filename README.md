<p align="center"><img src="public/icon.svg" width="72" alt="Fretprint logo"></p>

<h1 align="center">Fretprint™</h1>
<p align="center"><b>Every shape has a name.</b><br>Tap any shape on a fretboard — in any tuning — and get its exact notes, chord name, theory and sound.</p>

---

Guitarists invent shapes all the time: a weird open voicing, something in DADGAD, a riff fragment with a capo on 4.
Fretprint tells you what you're actually playing so you can write it down, name it, or play it on a piano.

## Features

- **Any instrument, any tuning** — guitar, 7-string, 4/5-string bass, ukulele, baritone uke, mandolin, banjo.
  18 guitar tunings out of the box (Drop D → Drop B, DADGAD, open D/G/E/A/C, Nashville, all-fourths, New Standard),
  plus a semitone-by-semitone tuning editor and saved custom tunings. Capo support.
- **Exact pitch playback** — every string plays its exact equal-tempered note:
  - real recordings, pitch-shifted from the nearest sample with a **per-recording correction measured at build time** (`scripts/build-samples.mjs`)
  - an exactly-tuned Karplus–Strong string (fractional-delay all-pass, ±1.5 cents, unit-tested) for the first tap and out-of-range notes
  - strum down/up with humanized timing, arpeggio, drag across strings to strum, per-string choke like a real instrument
- **Real music theory**
  - 64 chord qualities (triads → 13♯11, altered dominants, sus, add, 6/9, quartal), scored identification with alternatives
  - correct **enharmonic spelling** (E♭m7 is E♭ G♭ B♭ D♭, not D♯ F♯ A♯ C♯), inversions and slash chords
  - formula view (1 ♭3 5 ♭7) with omitted tones
  - **keys** the chord belongs to with roman numerals (major, natural and harmonic minor)
  - **scales** that fit over it (modes, pentatonics, blues, melodic/harmonic minor modes, symmetric, Bhairav, Hirajōshi…)
  - **reverse lookup**: type `F#m7b5` and get playable voicings *for your current tuning* (searches every 4-fret window, max 4 fingers, barre-aware)
- **Piano view** — the same notes at the same octaves, spelled in context, playable.
- **Tuner** — McLeod pitch method, auto string detection for whatever instrument/tuning you picked, adjustable A4.
- **Share links** — the URL encodes instrument, tuning, capo and shape: `/#g6/D2.A2.D3.G3.A3.D4/2/0.0.0.2.0.0`
- **Works offline** (service worker), installable as an app, no account, no tracking.

## Performance design

| Concern | Approach |
|---|---|
| Tap → sound latency | Sound starts on `pointerdown` (not `click`), before any rendering. `AudioContext({latencyHint: 'interactive'})`, notes start at `currentTime` — no scheduler look-ahead. Measured handler cost: 2–5 ms. |
| First tap | Audio graph is built during idle time; samples are downloaded during idle and decoded on first touch. Until then an exactly-tuned synthesized string plays, so nothing is ever silent or late. |
| Rendering | Fretboard SVG (wood, frets, strings) is built once per instrument/tuning; a tap only rewrites a ~6-element marker layer. No SVG filters. |
| Bundle | No framework. ~17 kB gzipped JS + 8 kB CSS on first load; the tuner and its pitch detector are code-split (~5 kB) and load only when opened. Fonts self-hosted, subset by `unicode-range`. |
| Assets | Samples are mono 96 kb/s MP3, trimmed, ~600–900 kB per instrument, loaded only for the instrument in use. Hashed assets are served `immutable` for a year. |
| Offline | Service worker: cache-first for hashed assets and samples, network-first for the page. |

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # theory + tuning-accuracy tests (vitest)
npm run build      # type-check + production build in dist/
```

Rebuild the sample bank (needs ffmpeg) from [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments):

```bash
git clone --depth 1 https://github.com/nbrosowsky/tonejs-instruments /tmp/ti
node scripts/build-samples.mjs /tmp/ti/samples
```

## Project layout

```
src/
  theory/       notes & spelling, chord dictionary + identification + parser, scales & keys, voicing search
  audio/        Web Audio engine (sampler with pitch correction, choke groups) and Karplus–Strong synth
  ui/           fretboard renderer, chord/piano/theory panels
  tuner.ts      lazy-loaded tuner
  state.ts      tiny pub/sub store, persistence, share links
scripts/        sample-bank builder (transcode + pitch measurement)
tests/          vitest suites
```

## Deploy

Static site — any host works. On Vercel: import the repo, framework **Vite**, done (`vercel.json` sets caching headers).

## Credits & license

Code: MIT © Abhinav. Instrument recordings come from [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) (MIT, © Nicholaus P. Brosowsky),
which collects them from University of Iowa MIS (acoustic guitar), Karoryfer (electric guitar, bass), Freesound user *quartertone* (nylon guitar)
and VSCO 2 Community Edition (piano). They are transcoded and pitch-measured here; see `public/samples/CREDITS.md`.
"Fretprint" is used as a product name; it has not been registered as a trademark.
