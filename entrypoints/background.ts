import { badgeText } from '@/lib/steps';
import { isStateMessage } from '@/lib/messages';

const SIZES = [16, 32, 48, 128] as const;
const iconSet = (dir: string) => Object.fromEntries(SIZES.map((s) => [s, `/${dir}/${s}.png`]));
const IDLE_ICON = iconSet('icon');
const ACTIVE_ICON = iconSet('icon-active');
const BADGE_COLOR = '#f97316';

export default defineBackground(() => {
  browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  browser.action.setBadgeTextColor?.({ color: '#ffffff' });

  // The content script reports every change, including its own SPA resets.
  browser.runtime.onMessage.addListener((msg, sender) => {
    const tabId = sender.tab?.id;
    if (isStateMessage(msg) && tabId != null) void show(tabId, msg.frets);
  });

  // A reload or full navigation discards the content script and its state.
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'loading') void show(tabId, 0);
  });
});

async function show(tabId: number, frets: number) {
  try {
    await Promise.all([
      browser.action.setBadgeText({ tabId, text: badgeText(frets) }),
      browser.action.setIcon({ tabId, path: frets ? ACTIVE_ICON : IDLE_ICON }),
    ]);
  } catch {
    // Tab closed before we got here.
  }
}
