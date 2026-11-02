import { badgeText, clampFrets, stepLabel } from '@/lib/steps';
import { isStateMessage, type ContentRequest } from '@/lib/messages';
import { askRiff, hasRiffAccess } from '@/lib/riff';

const SIZES = [16, 32, 48, 128] as const;
const iconSet = (dir: string) => Object.fromEntries(SIZES.map((s) => [s, `/${dir}/${s}.png`]));
const IDLE_ICON = iconSet('icon');
const ACTIVE_ICON = iconSet('icon-active');
const BADGE_COLOR = '#f97316';
const DEFAULT_TITLE = browser.runtime.getManifest().action?.default_title ?? 'Tab Transposer';

/** Page (URL without hash) each tab was last checked against Riff for. */
const handled = new Map<number, string>();
/** The shift Riff asked for in each tab, and its tooltip. */
const fromRiff = new Map<number, { frets: number; title: string }>();

export default defineBackground(() => {
  browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  browser.action.setBadgeTextColor?.({ color: '#ffffff' });

  // The content script reports every change, including its own SPA resets.
  browser.runtime.onMessage.addListener((msg, sender) => {
    const tabId = sender.tab?.id;
    if (isStateMessage(msg) && tabId != null) void show(tabId, msg.frets);
  });

  browser.tabs.onUpdated.addListener((tabId, info, tab) => {
    // A reload or full navigation discards the content script and its state.
    if (info.status === 'loading') {
      handled.delete(tabId);
      fromRiff.delete(tabId);
      void show(tabId, 0);
    }
    // Full loads finish with status "complete"; SPA navigations (pushState)
    // report just a new URL on an already-complete tab.
    if (info.status === 'complete' || (info.url && tab.status === 'complete')) void followRiff(tabId, tab.url);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    handled.delete(tabId);
    fromRiff.delete(tabId);
  });
});

/**
 * If "Follow Riff" is on and this page is a saved Riff tab in a different
 * tuning from the one set in Riff, transpose it. Riff does the tuning maths.
 */
async function followRiff(tabId: number, url: string | undefined) {
  if (!url || !/^https?:/.test(url)) return;
  const page = url.split('#')[0];
  if (handled.get(tabId) === page) return;
  handled.set(tabId, page);
  if (!(await hasRiffAccess())) return;

  const riff = await askRiff(url);
  const frets = clampFrets(riff?.frets ?? 0);
  if (!frets || !riff?.tab?.tuning) return;

  try {
    // Skip if the tab moved on while we were asking.
    if ((await browser.tabs.get(tabId)).url?.split('#')[0] !== page) return;
    const title = `${stepLabel(frets)} for ${riff.playTuning} (tab is in ${riff.tab.tuning}), via Riff`;
    fromRiff.set(tabId, { frets, title });
    await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/content.js'] });
    const msg: ContentRequest = { type: 'set', frets };
    await browser.tabs.sendMessage(tabId, msg);
  } catch {
    // Tab closed, or a page we can't script (e.g. the Web Store).
    fromRiff.delete(tabId);
  }
}

async function show(tabId: number, frets: number) {
  // The Riff tooltip only stands while the page is at the shift Riff asked for.
  const riff = fromRiff.get(tabId);
  const title = riff && riff.frets === frets ? riff.title : DEFAULT_TITLE;
  try {
    await Promise.all([
      browser.action.setBadgeText({ tabId, text: badgeText(frets) }),
      browser.action.setIcon({ tabId, path: frets ? ACTIVE_ICON : IDLE_ICON }),
      browser.action.setTitle({ tabId, title }),
    ]);
  } catch {
    // Tab closed before we got here.
  }
}
