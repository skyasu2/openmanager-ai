import type { Preview } from '@storybook/nextjs-vite';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;
