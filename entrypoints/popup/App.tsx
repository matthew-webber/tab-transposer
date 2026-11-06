import { useCallback, useEffect, useRef, useState } from 'react';
import { clampFrets, formatSteps, MAX_FRETS, stepLabel } from '@/lib/steps';
import type { ContentRequest, ContentState } from '@/lib/messages';
import { askRiff, dropRiffAccess, hasRiffAccess, requestRiffAccess, riffSummary, type RiffTranspose } from '@/lib/riff';

type View =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | ({ status: 'ready'; tabId: number; url: string } & ContentState);

const request = (tabId: number, msg: ContentRequest) =>
  browser.tabs.sendMessage(tabId, msg) as Promise<ContentState>;

/** Injects the content script (once per page) and reads its current state. */
async function connect(): Promise<View> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) throw new Error('No active tab');
  await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/content.js'] });
  return { status: 'ready', tabId: tab.id, url: tab.url ?? '', ...(await request(tab.id, { type: 'get' })) };
}

export default function App() {
  const [view, setView] = useState<View>({ status: 'loading' });
  const latest = useRef(0);

  useEffect(() => {
    connect().then(setView, () => setView({ status: 'unavailable' }));
  }, []);

  const update = useCallback(
    (next: { frets?: number; ignoreSixth?: boolean }) => {
      if (view.status !== 'ready') return;
      const frets = clampFrets(next.frets ?? view.frets);
      const ignoreSixth = next.ignoreSixth ?? view.ignoreSixth;
      if (frets === view.frets && ignoreSixth === view.ignoreSixth) return;
      const id = ++latest.current;
      setView({ ...view, frets, ignoreSixth });
      request(view.tabId, { type: 'set', frets, ignoreSixth }).then(
        (state) => id === latest.current && setView((v) => (v.status === 'ready' ? { ...v, ...state } : v)),
        () => setView({ status: 'unavailable' }),
      );
    },
    [view],
  );
  const change = useCallback((frets: number) => update({ frets }), [update]);

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

  const { frets, ignoreSixth, blockCount } = view;
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
      {blockCount === 0 ? (
        <p className="note">No tab found on this page.</p>
      ) : (
        <label className="option" title="Leave the low string as written, e.g. for a drop D tab on a guitar in D standard">
          <input
            type="checkbox"
            checked={ignoreSixth}
            onChange={(e) => update({ ignoreSixth: e.target.checked })}
          />
          Ignore 6th string
        </label>
      )}
      <RiffFooter url={view.url} />
    </main>
  );
}

type Riff = { status: 'loading' } | { status: 'off' } | { status: 'on'; info: RiffTranspose | null };

/**
 * "Follow Riff": once on, tabs saved in Riff open transposed to the tuning set
 * in Riff's sidebar (see entrypoints/background.ts).
 */
function RiffFooter({ url }: { url: string }) {
  const [riff, setRiff] = useState<Riff>({ status: 'loading' });

  const refresh = useCallback(async () => {
    setRiff((await hasRiffAccess()) ? { status: 'on', info: await askRiff(url) } : { status: 'off' });
  }, [url]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (riff.status === 'loading') return <footer className="riff" />;
  if (riff.status === 'off') {
    return (
      <footer className="riff">
        <button
          type="button"
          className="link"
          title="Tabs saved in Riff open already transposed to the tuning you set in Riff"
          // The permission prompt can close the popup; the grant still sticks.
          onClick={() => requestRiffAccess().then(refresh, refresh)}
        >
          Follow Riff’s tuning…
        </button>
      </footer>
    );
  }
  return (
    <footer className="riff">
      <span className="riff-status">{riffSummary(riff.info)}</span>
      <button type="button" className="link" onClick={() => dropRiffAccess().then(refresh, refresh)}>
        Turn off
      </button>
    </footer>
  );
}
