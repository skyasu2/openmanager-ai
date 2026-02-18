import type { StorybookConfig } from '@storybook/nextjs-vite';

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
};

export default config;
