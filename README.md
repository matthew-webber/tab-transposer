# Tab Transposer

Chrome extension that moves the fret numbers in guitar tabs up or down, right on
the page. Open the popup and use − / + to move ½ step (one fret) at a time, up to
5 steps either way. The toolbar icon turns orange and shows the step count while
a page is transposed. Reloading the page resets it.

- Only tab staves (`e|---3---|` lines) change. Chords, lyrics and notes don't.
- Strings stay aligned when frets go from one digit to two (8 → 10).
- Frets that would go below 0 jump up an octave (−1 → 11) and are highlighted.
- Click the number, or press `0`, to reset. Arrow keys and +/− work too.

## Development

```sh
bun install
bun run dev        # WXT dev mode
bun run test       # unit tests for detection, transposition and formatting
bun run build      # then load .output/chrome-mv3/ unpacked in chrome://extensions
bun run icons      # regenerate toolbar icons
```
