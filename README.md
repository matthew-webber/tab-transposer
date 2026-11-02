# Tab Transposer

Chrome extension that moves the fret numbers in guitar tabs up or down, right on
the page. Open the popup and use − / + to move ½ step (one fret) at a time, up to
5 steps either way. The toolbar icon turns orange and shows the step count while
a page is transposed. Reloading the page resets it.

- Only tab staves (`e|---3---|` lines) change. Chords, lyrics and notes don't.
- Strings stay aligned when frets go from one digit to two (8 → 10).
- Frets that would go below 0 jump up an octave (−1 → 11) and are highlighted.
- Click the number, or press `0`, to reset. Arrow keys and +/− work too.

## Follow Riff

Click **Follow Riff's tuning…** in the popup and allow access to all sites. From then on,
whenever a page that's saved in [Riff](../../riff-app) finishes loading, the extension
asks Riff how far to shift it so it matches the **Tuned to** tuning set in Riff's sidebar,
and transposes it automatically. The tooltip says why. Turn it off from the popup.

## Development

```sh
bun install
bun run dev        # WXT dev mode
bun run test       # unit tests for detection, transposition and formatting
bun run build      # then load .output/chrome-mv3/ unpacked in chrome://extensions
bun run icons      # regenerate toolbar icons
```
