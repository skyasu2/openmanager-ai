/**
 * @vitest-environment node
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const {
  extractRelativeImports,
  resolveModuleSpecifier,
  auditUiArtifacts,
} = require('../../../scripts/dev/audit-orphan-ui-artifacts');

const tempDirs: string[] = [];

function makeTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orphan-ui-audit-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function writeFile(rootDir: string, relativePath: string, content: string) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('audit-orphan-ui-artifacts', () => {
  it('extracts unique relative imports', () => {
    const source = `
      import { Card } from './Card';
      export { Card } from './Card';
      const lazy = import('../shared/dialog');
      import { noop } from '@/lib/noop';
    `;

    expect(extractRelativeImports(source)).toEqual([
      './Card',
      '../shared/dialog',
    ]);
  });

  it('resolves relative module specifiers against sibling files', () => {
    const rootDir = makeTempDir();
    writeFile(
      rootDir,
      'src/components/Button.tsx',
      'export const Button = () => null;'
    );
    writeFile(
      rootDir,
      'src/components/Button.test.tsx',
      "import { Button } from './Button';\nvoid Button;\n"
    );

    const resolved = resolveModuleSpecifier(
      path.join(rootDir, 'src/components/Button.test.tsx'),
      './Button'
    );

    expect(resolved).toBe(path.join(rootDir, 'src/components/Button.tsx'));
  });

  it('flags broken local imports and manual-review stories separately', () => {
    const rootDir = makeTempDir();

    writeFile(
      rootDir,
      'src/components/Card.tsx',
      'export const Card = () => null;\n'
    );
    writeFile(
      rootDir,
      'src/components/Card.stories.tsx',
      "import { Card } from './Card';\nexport default { component: Card };\n"
    );
    writeFile(
      rootDir,
      'src/pages/LandingPage.stories.tsx',
      "import { Card } from '../components/Card';\nexport default { component: Card };\n"
    );
    writeFile(
      rootDir,
      'src/components/Broken.test.tsx',
      "import { Missing } from './Missing';\nvoid Missing;\n"
    );

    const result = auditUiArtifacts({ cwd: rootDir, rootDir: 'src' });

    expect(result.ok).toBe(false);
    expect(result.brokenRelativeImports).toEqual([
      {
        file: 'src/components/Broken.test.tsx',
        import: './Missing',
      },
    ]);
    expect(result.manualReviewStories).toEqual([
      'src/pages/LandingPage.stories.tsx',
    ]);
  });
});
