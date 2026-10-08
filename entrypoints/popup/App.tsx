import { useCallback, useEffect, useRef, useState } from 'react';
import { clampFrets, formatSteps, MAX_FRETS, stepLabel } from '@/lib/steps';
import type { ContentRequest, ContentState } from '@/lib/messages';

type View =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | ({ status: 'ready'; tabId: number } & ContentState);

const request = (tabId: number, msg: ContentRequest) =>
  browser.tabs.sendMessage(tabId, msg) as Promise<ContentState>;

/** Injects the content script (once per page) and reads its current state. */
async function connect(): Promise<View> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) throw new Error('No active tab');
  await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/content.js'] });
  return { status: 'ready', tabId: tab.id, ...(await request(tab.id, { type: 'get' })) };
}

export default function App() {
  const [view, setView] = useState<View>({ status: 'loading' });
  const latest = useRef(0);

  useEffect(() => {
    connect().then(setView, () => setView({ status: 'unavailable' }));
  }, []);

  const change = useCallback(
    (next: number) => {
      if (view.status !== 'ready') return;
      const frets = clampFrets(next);
      if (frets === view.frets) return;
      const id = ++latest.current;
      setView({ ...view, frets });
      request(view.tabId, { type: 'set', frets }).then(
        (state) => id === latest.current && setView((v) => (v.status === 'ready' ? { ...v, ...state } : v)),
        () => setView({ status: 'unavailable' }),
      );
    },
    [view],
  );

  useEffect(() => {
    if (view.status !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowRight', '+', '='].includes(e.key)) change(view.frets + 1);
      else if (['ArrowDown', 'ArrowLeft', '-'].includes(e.key)) change(view.frets - 1);
      else if (e.key === '0') change(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, change]);

  if (view.status === 'loading') return <main className="popup" />;
  if (view.status === 'unavailable') {
    return (
      <main className="popup">
        <p className="note">Can’t run on this page.</p>
      </main>
    );
  }

  const { frets, blockCount } = view;
  return (
    <main className="popup">
      <div className="control">
        <button
          type="button"
          className="step"
          aria-label="Down half a step"
          disabled={frets <= -MAX_FRETS}
          onClick={() => change(frets - 1)}
        >
          −
        </button>
        <output
          className={frets ? 'value active' : 'value'}
          aria-live="polite"
          title={frets ? 'Click to reset' : undefined}
          onClick={() => change(0)}
        >
          {formatSteps(frets)}
        </output>
        <button
          type="button"
          className="step"
          aria-label="Up half a step"
          disabled={frets >= MAX_FRETS}
          onClick={() => change(frets + 1)}
        >
          +
        </button>
      </div>
      <p className="label">{stepLabel(frets)}</p>
      {blockCount === 0 && <p className="note">No tab found on this page.</p>}
    </main>
  );
}
