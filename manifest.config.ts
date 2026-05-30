import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// Greenhouse is granted at install (Slice 1 content script). Remaining ATS hosts
// are requested on demand as their adapters land; generic pages use activeTab +
// scripting.executeScript (see DESIGN.md §1 permissions).
const ATS_HOSTS = ['https://*.greenhouse.io/*', 'https://*.lever.co/*', 'https://*.ashbyhq.com/*'];
const GRANTED_HOSTS = [
  ...ATS_HOSTS,
  // BYO-key AI calls from the background worker (provider is user-selectable)
  'https://api.anthropic.com/*',
  'https://generativelanguage.googleapis.com/*',
];
const FUTURE_ATS_HOSTS = [
  'https://*.myworkdayjobs.com/*',
  'https://*.smartrecruiters.com/*',
  'https://*.linkedin.com/*',
];

export default defineManifest({
  manifest_version: 3,
  name: 'ApplyPilot',
  version: pkg.version,
  description: pkg.description,
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'ApplyPilot',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
  commands: {
    'open-panel': {
      suggested_key: { default: 'Ctrl+Shift+Y', mac: 'Command+Shift+Y' },
      description: 'Open the ApplyPilot side panel',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ATS_HOSTS,
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: true,
    },
  ],
  permissions: ['storage', 'sidePanel', 'scripting', 'activeTab'],
  host_permissions: GRANTED_HOSTS,
  optional_host_permissions: [...FUTURE_ATS_HOSTS, 'https://*/*'],
  // Bundled chunks must be loadable on any origin so the content script can be
  // injected on demand into non-ATS pages (the loader dynamic-imports a chunk).
  web_accessible_resources: [{ resources: ['assets/*'], matches: ['<all_urls>'] }],
});
