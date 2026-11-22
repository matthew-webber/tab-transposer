import { detectBlocks } from '@/lib/tab-detect';
import { stringShifts, transposeBodies } from '@/lib/transpose';
import { clampFrets } from '@/lib/steps';
import type { ContentRequest, ContentState, StateMessage } from '@/lib/messages';

// Injected on demand by the popup (activeTab + scripting), so state lives only
// as long as this page does: a reload drops it.
export default defineContentScript({
  registration: 'runtime',
  noScriptStartedPostMessage: true,
  main() {
    const w = window as Window & { __tabTransposer?: boolean };
    if (w.__tabTransposer) return;
    w.__tabTransposer = true;
    startTransposer();
  },
});

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'TEMPLATE', 'svg']);
const HIGHLIGHT = 'tab-transposer-wrapped';

interface Segment {
  node: Text;
  start: number;
  end: number;
}

interface Edit {
  start: number;
  end: number;
  text: string;
  wrapped: { col: number; len: number }[];
}

function startTransposer() {
  let frets = 0;
  let ignoreSixth = false;
  let offsets: number[] | null = null;
  let blockCount = 0;
  /** Text nodes we rewrote: original data and what we wrote, for exact restore. */
  const touched = new Map<Text, { original: string; written: string }>();
  const highlight = 'highlights' in CSS ? new Highlight() : null;
  if (highlight) {
    CSS.highlights.set(HIGHLIGHT, highlight);
    const style = document.createElement('style');
    style.textContent = `::highlight(${HIGHLIGHT}) { background-color: rgba(249, 115, 22, 0.28); }`;
    document.head.append(style);
  }

  const observer = new MutationObserver(() => {
    clearTimeout(pending);
    pending = setTimeout(apply, 250);
  });
  let pending: ReturnType<typeof setTimeout> | undefined;

  function restore() {
    for (const [node, { original, written }] of touched) {
      // If the page re-rendered this node, its new text is the original now.
      if (node.data === written) node.data = original;
    }
    touched.clear();
    highlight?.clear();
  }

  function apply() {
    observer.disconnect();
    restore();
    blockCount = 0;
    for (const container of findContainers()) blockCount += transposeContainer(container);
    // Re-apply after the page (e.g. a React re-render) replaces the tab text.
    if (frets || offsets) observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  function transposeContainer(container: Element): number {
    const { text, segments } = collectText(container);
    const blocks = detectBlocks(text);
    if (!frets && !offsets) return blocks.length;

    const edits: Edit[] = [];
    for (const block of blocks) {
      const shifts = stringShifts(block.lines.length, frets, ignoreSixth, offsets);
      const { bodies, wrapped } = transposeBodies(block.lines.map((l) => l.body), shifts);
      block.lines.forEach((line, i) => {
        if (bodies[i] === line.body) return;
        edits.push({
          start: line.bodyStart,
          end: line.bodyStart + line.body.length,
          text: bodies[i],
          wrapped: wrapped.filter((f) => f.line === i),
        });
      });
    }
    // Back to front, so earlier offsets in a shared text node stay valid.
    // replaceData() also shifts the live highlight ranges made for later edits.
    edits.sort((a, b) => b.start - a.start);
    for (const edit of edits) {
      const hits = segments.filter((s) => s.end > edit.start && s.start < edit.end);
      hits.forEach((s, i) => {
        if (!touched.has(s.node)) touched.set(s.node, { original: s.node.data, written: '' });
        const from = Math.max(edit.start, s.start) - s.start;
        const to = Math.min(edit.end, s.end) - s.start;
        // The first text node of a line takes the whole new body.
        s.node.replaceData(from, to - from, i === 0 ? edit.text : '');
        if (i === 0 && highlight) {
          for (const f of edit.wrapped) {
            const range = new Range();
            range.setStart(s.node, from + f.col);
            range.setEnd(s.node, from + f.col + f.len);
            highlight.add(range);
          }
        }
      });
    }
    for (const [node, entry] of touched) entry.written = node.data;
    return blocks.length;
  }

  function set(next: number, nextIgnoreSixth = ignoreSixth, nextOffsets = offsets) {
    frets = clampFrets(next);
    ignoreSixth = nextIgnoreSixth;
    offsets = validOffsets(nextOffsets);
    apply();
    const msg: StateMessage = { type: 'tab-transposer/state', frets, offsets };
    browser.runtime.sendMessage(msg).catch(() => {});
  }

  browser.runtime.onMessage.addListener((msg: ContentRequest, _sender, sendResponse) => {
    if (msg?.type === 'set') {
      // A set right after an SPA navigation (from Riff) belongs to the new
      // page, so the navigation check below mustn't reset it.
      lastPage = pageKey();
      set(msg.frets, msg.ignoreSixth ?? ignoreSixth, msg.offsets === undefined ? offsets : msg.offsets);
    } else if (msg?.type === 'get') apply();
    else return;
    const state: ContentState = { frets, ignoreSixth, offsets, blockCount };
    sendResponse(state);
  });

  // SPA navigation (e.g. picking another tab version on Ultimate Guitar) gets a
  // fresh start, like a reload would. Hash changes don't count.
  const pageKey = () => location.href.split('#')[0];
  let lastPage = pageKey();
  setInterval(() => {
    if (pageKey() === lastPage) return;
    lastPage = pageKey();
    if (frets || ignoreSixth || offsets) set(0, false, null);
  }, 500);
}

/** Small whole-fret offsets, or null when there are none to apply. */
function validOffsets(offsets: unknown): number[] | null {
  if (!Array.isArray(offsets) || offsets.length > 8) return null;
  const out = offsets.map((o) => clampFrets(Number(o)));
  return out.some(Boolean) ? out : null;
}

/** Outermost elements with preserved whitespace that contain dash-heavy text. */
function findContainers(): Set<Element> {
  const isPre = memo((el: Element) => {
    const ws = getComputedStyle(el).whiteSpace;
    return ws.startsWith('pre') || ws === 'break-spaces';
  });
  const containers = new Set<Element>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let el = node.parentElement;
    if (!el || !(node as Text).data.includes('--') || SKIP.has(el.tagName) || el.isContentEditable) continue;
    if (!isPre(el)) continue;
    while (el.parentElement && el.parentElement !== document.body && isPre(el.parentElement)) el = el.parentElement;
    containers.add(el);
  }
  return containers;
}

/**
 * Concatenates a container's text, mapping offsets back to text nodes. <br>
 * and block-level children become virtual newlines so each stave line is
 * found even when the site renders one element per line.
 */
function collectText(root: Element): { text: string; segments: Segment[] } {
  let text = '';
  const segments: Segment[] = [];
  const newline = () => {
    if (text && !text.endsWith('\n')) text += '\n';
  };
  const visit = (parent: Node) => {
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      if (child instanceof Text) {
        segments.push({ node: child, start: text.length, end: text.length + child.data.length });
        text += child.data;
      } else if (child instanceof Element) {
        if (SKIP.has(child.tagName)) continue;
        if (child.tagName === 'BR') {
          text += '\n';
          continue;
        }
        const display = getComputedStyle(child).display;
        if (display === 'none') continue;
        const block = !display.startsWith('inline') && display !== 'contents';
        if (block) newline();
        visit(child);
        if (block) newline();
      }
    }
  };
  visit(root);
  return { text, segments };
}

function memo<K, V>(fn: (key: K) => V): (key: K) => V {
  const cache = new Map<K, V>();
  return (key) => {
    if (!cache.has(key)) cache.set(key, fn(key));
    return cache.get(key)!;
  };
}
