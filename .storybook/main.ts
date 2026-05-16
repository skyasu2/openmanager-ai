import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/nextjs-vite';
import type { RollupLog } from 'rollup';

const SUPPRESSED_CODES = new Set(['MODULE_LEVEL_DIRECTIVE', 'SOURCEMAP_ERROR']);

const SUPPRESSED_MESSAGES = ['vite-inject-mocker-entry.js'];
const isStorybookVitest =
  process.env.VITEST === 'true' || process.env.VITEST_STORYBOOK === 'true';
const storybookDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(storybookDir, '..');
const vitestStoryGlobs =
  process.env.OPENMANAGER_STORYBOOK_VITEST_STORIES?.split(',')
    .map((storyGlob) => storyGlob.trim())
    .filter(Boolean);

const config: StorybookConfig = {
  stories:
    isStorybookVitest && vitestStoryGlobs && vitestStoryGlobs.length > 0
      ? vitestStoryGlobs
      : ['../src/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/nextjs-vite',
  addons: [
    ...(isStorybookVitest ? [] : ['@storybook/addon-mcp']),
    '@storybook/addon-vitest',
  ],
  features: {
    experimentalComponentsManifest: true,
  },
  typescript: {
    reactDocgen: 'react-docgen',
  },
  viteFinal(config) {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(projectRoot, 'src'),
      '~': projectRoot,
    };

    config.plugins ??= [];
    config.plugins.push({
      name: 'storybook:suppress-warnings',
      enforce: 'pre' as const,
      onLog(_level: string, log: RollupLog) {
        // Suppress known noisy warnings to keep build logs actionable
        if (log.code && SUPPRESSED_CODES.has(log.code)) return false;

        const message = String(log.message ?? '');
        if (
          SUPPRESSED_MESSAGES.some((entry) =>
            message.toLowerCase().includes(entry.toLowerCase())
          )
        ) {
          return false;
        }

        // Circular chunk warnings (e.g., vendor-react -> vendor-storybook) have been resolved
        // by removing 'vendor-react' manual chunk. If they reappear, they will be logged here.
      },
    });

    config.build ??= {};
    config.build.sourcemap = false;
    // Known constraint: Storybook/Vite emits a generated mocker entry chunk
    // (`vite-inject-mocker-entry.js`) around 1.5 MB after minification even
    // when stories themselves are modest. That bundle is framework-generated,
    // not an application chunk we can realistically code-split from repo code.
    // Raise the warning threshold just above the measured output to keep
    // build logs actionable for real regressions in app-owned bundles.
    config.build.chunkSizeWarningLimit = 1600;
    config.css ??= {};
    config.css.devSourcemap = false;

    config.build.rollupOptions ??= {};
    const existing = config.build.rollupOptions.output;
    const chunkConfig = {
      manualChunks(id: string) {
        const filename = id.split(/[\\/]/).pop();

        if (filename === 'vite-inject-mocker-entry.js') {
          return 'vendor-mock-entry';
        }

        if (id.includes('node_modules')) {
          if (id.includes('/storybook/') || id.includes('/@storybook/'))
            return 'vendor-storybook';
          if (id.includes('/recharts/') || id.includes('/d3-'))
            return 'vendor-charts';
          if (id.includes('/@radix-ui/')) return 'vendor-radix';
        }
      },
    };

    if (Array.isArray(existing)) {
      config.build.rollupOptions.output = existing.map((o) => ({
        ...o,
        ...chunkConfig,
      }));
    } else {
      config.build.rollupOptions.output = { ...existing, ...chunkConfig };
    }

    return config;
  },
};

export default config;
