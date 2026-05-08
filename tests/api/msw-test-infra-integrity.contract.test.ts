import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoPath = (...segments: string[]) => join(process.cwd(), ...segments);
const readRepoFile = (...segments: string[]) =>
  readFileSync(repoPath(...segments), 'utf8');

describe('MSW test infrastructure integrity contract', () => {
  it('contract MSW setup fails on unhandled requests instead of warning only', () => {
    const mswSetup = readRepoFile('config/testing/msw-setup.ts');

    expect(mswSetup).toContain("onUnhandledRequest: 'error'");
    expect(mswSetup).not.toContain("onUnhandledRequest: 'warn'");
  });

  it('api-contract tests cannot pass by replacing global.fetch with inline mocks', () => {
    const apiContractTest = readRepoFile('tests/api/api-contract.test.ts');

    expect(apiContractTest).not.toMatch(/\bglobal\.fetch\s*=\s*vi\.fn\(/);
    expect(apiContractTest).not.toMatch(/\bvi\.stubGlobal\(\s*['"]fetch['"]/);
  });

  it('external connectivity test uses an MSW-free Vitest config', () => {
    const packageJson = readRepoFile('package.json');
    const externalConfigPath = repoPath(
      'config/testing/vitest.config.external-connectivity.ts'
    );

    expect(packageJson).toContain(
      'config/testing/vitest.config.external-connectivity.ts'
    );
    expect(existsSync(externalConfigPath)).toBe(true);

    const externalConfig = readFileSync(externalConfigPath, 'utf8');
    expect(externalConfig).toContain('setupFiles: []');
    expect(externalConfig).not.toContain('msw-setup');
  });
});
