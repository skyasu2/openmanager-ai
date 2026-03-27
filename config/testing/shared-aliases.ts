import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const tsconfigPath = path.resolve(root, 'tsconfig.json');

interface TsConfigShape {
  compilerOptions?: {
    paths?: Record<string, string[]>;
  };
}

function normalizeAliasKey(key: string): string {
  return key.endsWith('/*') ? key.slice(0, -2) : key;
}

function normalizeAliasValue(value: string): string {
  const withoutWildcard = value.endsWith('/*') ? value.slice(0, -2) : value;
  return withoutWildcard.replace(/^\.\//, '');
}

function loadTsconfigAliases(): Record<string, string> {
  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf8');
    const parsed = JSON.parse(raw) as TsConfigShape;
    const paths = parsed.compilerOptions?.paths ?? {};

    return Object.fromEntries(
      Object.entries(paths)
        .map(([alias, mappedPaths]) => {
          const firstPath = mappedPaths[0];
          if (!firstPath) return null;

          return [
            normalizeAliasKey(alias),
            path.resolve(root, normalizeAliasValue(firstPath)),
          ] as const;
        })
        .filter((entry): entry is readonly [string, string] => entry !== null)
    );
  } catch {
    return {};
  }
}

/**
 * Vitest resolve.alias 공유 설정
 * main.ts, minimal.ts, simple.ts 에서 공통 사용
 */
export const testAliases: Record<string, string> = {
  '@': path.resolve(root, 'src'),
  ...loadTsconfigAliases(),
  '@/app': path.resolve(root, 'src/app'),
  '@/domains': path.resolve(root, 'src/domains'),
  '@/config': path.resolve(root, 'src/config'),
  '@/stores': path.resolve(root, 'src/stores'),
  '@/data': path.resolve(root, 'src/data'),
  '@/constants': path.resolve(root, 'src/constants'),
  '@/validators': path.resolve(root, 'src/validators'),
};
