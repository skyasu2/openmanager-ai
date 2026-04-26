/**
 * @vitest-environment node
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Cloud Run contract test config', () => {
  it('keeps the live Cloud Run contract suite on an MSW-free Vitest config', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8')) as {
      scripts: Record<string, string>;
    };
    const cloudConfig = readFileSync(
      'config/testing/vitest.config.cloud-contract.ts',
      'utf-8'
    );
    const mainConfig = readFileSync(
      'config/testing/vitest.config.main.ts',
      'utf-8'
    );

    expect(packageJson.scripts['test:cloud-contract']).toContain(
      'config/testing/vitest.config.cloud-contract.ts'
    );
    expect(packageJson.scripts['test:cloud-contract']).not.toContain(
      'config/testing/vitest.config.main.ts'
    );
    expect(cloudConfig).toContain('setupFiles: []');
    expect(cloudConfig).not.toContain('msw-setup');
    expect(mainConfig).toContain('tests/api/cloud-run-contract.test.ts');
  });
});
