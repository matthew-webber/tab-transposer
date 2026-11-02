import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Tab Transposer',
    description: 'Transpose guitar tab fret numbers on the page up or down.',
    // activeTab grants access to the tab the user opened the popup on, and
    // `scripting` lets the popup inject the content script there. No host
    // permissions: it works on any tab site without an install warning, and
    // a reload naturally resets the transposition.
    permissions: ['activeTab', 'scripting'],
    // Opt-in "Follow Riff" (lib/riff.ts): lets the background inject into
    // tab pages as they load and ask the Riff app how far to transpose them.
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {
      default_title: 'Transpose tab',
      default_icon: {
        16: '/icon/16.png',
        32: '/icon/32.png',
        48: '/icon/48.png',
        128: '/icon/128.png',
      },
    },
  },
});
