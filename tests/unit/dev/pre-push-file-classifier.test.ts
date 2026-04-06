/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

const {
  normalizeFilePath,
  toCloudRunRelativePath,
  isVitestTestFile,
  isPlaywrightTestFile,
  isJavaScriptSourceFile,
  isCloudRunFile,
  isCloudRunVitestTestFile,
  isCloudRunRelatedSourceFile,
  isCloudRunTypeCheckRelevantFile,
  isRelatedSourceFile,
  isDomTestInfraFile,
  isHookTestInfraFile,
  isFrontendSmokeFile,
  isDomTestFile,
  DOM_INFRA_SMOKE_SENTINEL,
  DOM_TEST_INFRA_EXACT,
} = require('../../../scripts/hooks/pre-push-file-classifier');

describe('normalizeFilePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizeFilePath('src\\components\\Foo.tsx')).toBe(
      'src/components/Foo.tsx'
    );
  });

  it('handles undefined/null gracefully', () => {
    expect(normalizeFilePath(undefined)).toBe('');
    expect(normalizeFilePath(null)).toBe('');
  });
});

describe('toCloudRunRelativePath', () => {
  it('strips cloud-run prefix', () => {
    expect(toCloudRunRelativePath('cloud-run/ai-engine/src/server.ts')).toBe(
      'src/server.ts'
    );
  });

  it('leaves non-cloud-run paths unchanged', () => {
    expect(toCloudRunRelativePath('src/app/page.tsx')).toBe('src/app/page.tsx');
  });
});

describe('isVitestTestFile', () => {
  it('matches .test.ts files', () => {
    expect(isVitestTestFile('src/lib/foo.test.ts')).toBe(true);
  });

  it('matches .spec.tsx files', () => {
    expect(isVitestTestFile('src/components/Bar.spec.tsx')).toBe(true);
  });

  it('excludes e2e test files', () => {
    expect(isVitestTestFile('tests/e2e/smoke.spec.ts')).toBe(false);
  });

  it('excludes manual test files', () => {
    expect(isVitestTestFile('tests/manual/check.test.ts')).toBe(false);
  });

  it('excludes regular source files', () => {
    expect(isVitestTestFile('src/lib/util.ts')).toBe(false);
  });
});

describe('isPlaywrightTestFile', () => {
  it('matches e2e spec files', () => {
    expect(isPlaywrightTestFile('tests/e2e/dashboard.spec.ts')).toBe(true);
  });

  it('excludes non-e2e test files', () => {
    expect(isPlaywrightTestFile('src/components/Foo.test.tsx')).toBe(false);
  });

  it('excludes e2e non-spec files', () => {
    expect(isPlaywrightTestFile('tests/e2e/helpers.ts')).toBe(false);
  });
});

describe('isJavaScriptSourceFile', () => {
  it('matches .ts, .tsx, .js, .jsx', () => {
    expect(isJavaScriptSourceFile('foo.ts')).toBe(true);
    expect(isJavaScriptSourceFile('foo.tsx')).toBe(true);
    expect(isJavaScriptSourceFile('foo.js')).toBe(true);
    expect(isJavaScriptSourceFile('foo.jsx')).toBe(true);
  });

  it('excludes markdown and json', () => {
    expect(isJavaScriptSourceFile('README.md')).toBe(false);
    expect(isJavaScriptSourceFile('config.json')).toBe(false);
  });
});

describe('isCloudRunFile', () => {
  it('matches cloud-run/ai-engine paths', () => {
    expect(isCloudRunFile('cloud-run/ai-engine/src/server.ts')).toBe(true);
  });

  it('excludes other paths', () => {
    expect(isCloudRunFile('src/app/page.tsx')).toBe(false);
  });
});

describe('isCloudRunVitestTestFile', () => {
  it('matches cloud-run test files', () => {
    expect(
      isCloudRunVitestTestFile('cloud-run/ai-engine/src/agents/foo.test.ts')
    ).toBe(true);
  });

  it('excludes non-cloud-run test files', () => {
    expect(isCloudRunVitestTestFile('src/lib/foo.test.ts')).toBe(false);
  });
});

describe('isCloudRunRelatedSourceFile', () => {
  it('matches cloud-run source ts/tsx', () => {
    expect(
      isCloudRunRelatedSourceFile('cloud-run/ai-engine/src/server.ts')
    ).toBe(true);
  });

  it('excludes cloud-run test files', () => {
    expect(
      isCloudRunRelatedSourceFile('cloud-run/ai-engine/src/server.test.ts')
    ).toBe(false);
  });

  it('excludes non-cloud-run src', () => {
    expect(isCloudRunRelatedSourceFile('src/lib/foo.ts')).toBe(false);
  });
});

describe('isCloudRunTypeCheckRelevantFile', () => {
  it('matches .ts files under cloud-run/ai-engine/src/', () => {
    expect(
      isCloudRunTypeCheckRelevantFile('cloud-run/ai-engine/src/types.ts')
    ).toBe(true);
  });

  it('excludes .js files', () => {
    expect(
      isCloudRunTypeCheckRelevantFile('cloud-run/ai-engine/src/util.js')
    ).toBe(false);
  });

  it('excludes test files', () => {
    expect(
      isCloudRunTypeCheckRelevantFile('cloud-run/ai-engine/src/util.test.ts')
    ).toBe(false);
  });
});

describe('isRelatedSourceFile', () => {
  it('matches src/ ts files', () => {
    expect(isRelatedSourceFile('src/lib/util.ts')).toBe(true);
    expect(isRelatedSourceFile('src/components/Foo.tsx')).toBe(true);
  });

  it('excludes test files', () => {
    expect(isRelatedSourceFile('src/lib/util.test.ts')).toBe(false);
  });

  it('excludes non-src files', () => {
    expect(isRelatedSourceFile('cloud-run/ai-engine/src/server.ts')).toBe(
      false
    );
    expect(isRelatedSourceFile('scripts/hooks/pre-push.js')).toBe(false);
  });
});

describe('isDomTestInfraFile', () => {
  it('matches sentinel path', () => {
    expect(isDomTestInfraFile(DOM_INFRA_SMOKE_SENTINEL)).toBe(true);
  });

  it('does not treat package.json as DOM infra exact anymore', () => {
    expect(isDomTestInfraFile('package.json')).toBe(false);
    expect(DOM_TEST_INFRA_EXACT.has('package.json')).toBe(false);
  });

  it('matches DOM-specific config files exactly', () => {
    expect(isDomTestInfraFile('config/testing/vitest.config.dom.ts')).toBe(
      true
    );
    expect(isDomTestInfraFile('config/testing/vitest.config.main.ts')).toBe(
      true
    );
  });

  it('excludes unrelated files', () => {
    expect(isDomTestInfraFile('src/components/Foo.tsx')).toBe(false);
    expect(isDomTestInfraFile('config/testing/vitest.config.dev.ts')).toBe(
      false
    );
  });
});

describe('isHookTestInfraFile', () => {
  it('matches pre-push.js exactly', () => {
    expect(isHookTestInfraFile('scripts/hooks/pre-push.js')).toBe(true);
  });

  it('excludes other hook files', () => {
    expect(isHookTestInfraFile('scripts/hooks/pre-commit.js')).toBe(false);
  });
});

describe('isFrontendSmokeFile', () => {
  it('matches ai components prefix', () => {
    expect(isFrontendSmokeFile('src/components/ai/ChatPanel.tsx')).toBe(true);
  });

  it('matches ai-sidebar prefix', () => {
    expect(
      isFrontendSmokeFile('src/components/ai-sidebar/AIAssistant.tsx')
    ).toBe(true);
  });

  it('matches exact entry', () => {
    expect(isFrontendSmokeFile('src/app/dashboard/DashboardClient.tsx')).toBe(
      true
    );
  });

  it('excludes regular dashboard components', () => {
    expect(isFrontendSmokeFile('src/components/dashboard/ServerCard.tsx')).toBe(
      false
    );
  });
});

describe('isDomTestFile', () => {
  const manifest = {
    pathPrefixes: ['tests/ai-sidebar/'],
    exactFiles: new Set(['src/components/ai/Chat.test.tsx']),
  };

  it('matches exact file from manifest', () => {
    expect(isDomTestFile('src/components/ai/Chat.test.tsx', manifest)).toBe(
      true
    );
  });

  it('matches path prefix from manifest', () => {
    expect(isDomTestFile('tests/ai-sidebar/useAI.test.ts', manifest)).toBe(
      true
    );
  });

  it('excludes non-test files', () => {
    expect(isDomTestFile('src/lib/util.ts', manifest)).toBe(false);
  });

  it('excludes test files not in manifest', () => {
    expect(isDomTestFile('src/lib/util.test.ts', manifest)).toBe(false);
  });
});
