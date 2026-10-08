# CLAUDE.md

## Project

WXT + React 19 extension. Transposes the fret numbers in guitar tab staves on
the current page (e.g. Ultimate Guitar) by ½-step (1 fret) increments, ±5 steps.
Only stave lines change; chords, lyrics and prose are left alone. State is
per page load: a refresh or SPA navigation resets it.

## Commands

Package manager: bun. Run `bun run compile`, `bun run test`, and `bun run build`
for relevant code changes. `bun run dev` starts WXT. `bun run icons` regenerates
`public/icon*/`. Generated `.wxt/` and `.output/` files must not be edited. Load
`.output/chrome-mv3/` in Chrome.

## Architecture and constraints

- `lib/tab-detect.ts`: pure. Finds stave blocks (≥4 consecutive lines with a
  string label and/or bar and a dash-heavy body of tab characters only).
- `lib/transpose.ts`: pure. Tokenizes frets (repeated digits like `6666` are
  separate strums; pairs ≤24 are one fret), shifts them (below 0 → +12, reported
  as wrapped), and realigns columns across strings when widths change.
  Always transpose from the original text, never from a previous result.
- `entrypoints/content.ts`: runtime-registered, injected by the popup, guarded
  against double injection. Edits only text-node data with `replaceData` (no
  element changes, so React-rendered pages survive) and restores exact
  originals. Wrapped frets use the CSS Custom Highlight API. A MutationObserver
  re-applies after re-renders; it is disconnected during our own writes.
- `entrypoints/background.ts`: per-tab badge text and idle/active icon, cleared
  when the tab starts loading.
- `entrypoints/popup/App.tsx`: − value + control. The content script is the
  source of truth.

Keep the minimal activeTab + scripting permissions with no host permissions or
declared content scripts. Units: state is stored in frets; the UI shows steps
(`lib/steps.ts`). Live DOM checks are still needed when changing detection or
DOM-editing code. Unit tests don't cover the DOM.
