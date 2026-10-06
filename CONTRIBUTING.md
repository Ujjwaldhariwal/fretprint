# Contributing to Fretprint

Thanks for helping! Good first contributions:

- **Tunings** — add them to `src/instruments.ts` (strings listed from the bass side to string 1).
- **Chord qualities** — add a line to `DEFS` in `src/theory/chords.ts` and a test case in `tests/theory.test.ts`.
- **Scales** — `src/theory/scales.ts`.
- **Instruments** — new sample banks go through `scripts/build-samples.mjs` so they get the same pitch measurement.

Before opening a PR: `npm test && npm run build`.

Performance rules: sound must start inside the `pointerdown` handler, before rendering; don't add a UI framework;
keep anything not needed for the first tap behind a dynamic `import()`.
