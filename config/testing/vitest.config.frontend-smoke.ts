import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.frontend-smoke.ts'],
    include: [
      'src/components/dashboard/AIAssistantButton.test.tsx',
      'src/components/ai/AIWorkspace.test.tsx',
      'src/components/ai-sidebar/AISidebarV4.test.tsx',
    ],
    exclude: ['node_modules/**', 'dist/**', '.next/**', 'out/**'],
    pool: 'forks',
    isolate: false,
    testTimeout: 10000,
    hookTimeout: 10000,
    reporters: ['default'],
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      'lucide-react': path.resolve(__dirname, '../../__mocks__/lucide-react.ts'),
      recharts: path.resolve(__dirname, '../../__mocks__/recharts.tsx'),
    },
  },
});
