import path from 'path';

const root = path.resolve(__dirname, '../..');

/**
 * Vitest resolve.alias 공유 설정
 * main.ts, minimal.ts, simple.ts 에서 공통 사용
 */
export const testAliases: Record<string, string> = {
  '@': path.resolve(root, 'src'),
  '@/components': path.resolve(root, 'src/components'),
  '@/lib': path.resolve(root, 'src/lib'),
  '@/services': path.resolve(root, 'src/services'),
  '@/utils': path.resolve(root, 'src/utils'),
  '@/types': path.resolve(root, 'src/types'),
  '@/app': path.resolve(root, 'src/app'),
  '@/hooks': path.resolve(root, 'src/hooks'),
  '@/domains': path.resolve(root, 'src/domains'),
  '@/schemas': path.resolve(root, 'src/schemas'),
  '@/config': path.resolve(root, 'src/config'),
  '@/stores': path.resolve(root, 'src/stores'),
};
