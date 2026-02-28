import type { StorybookConfig } from '@storybook/nextjs-vite';
import type { RollupLog } from 'rollup';

const SUPPRESSED_CODES = new Set(['MODULE_LEVEL_DIRECTIVE', 'SOURCEMAP_ERROR']);

const SUPPRESSED_MESSAGES = ['vite-inject-mocker-entry.js'];

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/nextjs-vite',
  addons: ['@storybook/addon-mcp'],
  features: {
    experimentalComponentsManifest: true,
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  viteFinal(config) {
    config.plugins ??= [];
    config.plugins.push({
      name: 'storybook:suppress-warnings',
      enforce: 'pre' as const,
      onLog(_level: string, log: RollupLog) {
        if (log.code && SUPPRESSED_CODES.has(log.code)) return false;
        const message = String(log.message ?? '');
        if (
          SUPPRESSED_MESSAGES.some((entry) =>
            message.toLowerCase().includes(entry.toLowerCase())
          )
        ) {
          return false;
        }
      },
    });

    config.build ??= {};
    config.build.sourcemap = false;
    // Keep signal on chunk warnings while acknowledging mock-inject output currently
    // sits in its own large entry file (~1.0MB) for story/test isolation.
    config.build.chunkSizeWarningLimit = 1100;
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
          if (id.includes('/react/') || id.includes('/react-dom/'))
            return 'vendor-react';
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
