import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readProjectFile = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const extractAssertionTypes = (yamlText: string): string[] =>
  Array.from(yamlText.matchAll(/^\s*-\s*type:\s*([a-z0-9-]+)/gim)).map(
    (match) => match[1]
  );

const extractSection = (
  yamlText: string,
  startMarker: string,
  endMarker: string
): string => {
  const start = yamlText.indexOf(startMarker);
  const end = yamlText.indexOf(endMarker, start + startMarker.length);

  if (start === -1 || end === -1) {
    return '';
  }

  return yamlText.slice(start, end);
};

describe('Promptfoo config contract', () => {
  it('keeps llm-rubric below the default eval budget threshold', () => {
    const config = readProjectFile('promptfoo/promptfooconfig.yaml');
    const assertionTypes = extractAssertionTypes(config);
    const rubricCount = assertionTypes.filter((type) => type === 'llm-rubric')
      .length;
    const rubricRatio = rubricCount / assertionTypes.length;

    expect(assertionTypes.length).toBeGreaterThan(0);
    expect(rubricRatio).toBeLessThan(0.2);
  });

  it('does not use judge LLM assertions in defaultTest', () => {
    const config = readProjectFile('promptfoo/promptfooconfig.yaml');
    const defaultTestSection = extractSection(
      config,
      'defaultTest:',
      '# Test Cases'
    );

    expect(defaultTestSection).not.toContain('type: llm-rubric');
  });

  it('uses deterministic javascript guards for schema-sensitive cases', () => {
    const config = readProjectFile('promptfoo/promptfooconfig.yaml');
    const assertionTypes = extractAssertionTypes(config);
    const javascriptGuardCount = assertionTypes.filter(
      (type) => type === 'javascript'
    ).length;

    expect(javascriptGuardCount).toBeGreaterThanOrEqual(5);
  });

  it('keeps a compact 20-30 case golden dataset', () => {
    const config = readProjectFile('promptfoo/promptfooconfig.yaml');
    const caseCount = Array.from(
      config.matchAll(/^\s*-\s*description:\s+/gm)
    ).length;

    expect(caseCount).toBeGreaterThanOrEqual(20);
    expect(caseCount).toBeLessThanOrEqual(30);
  });

  it('keeps red-team tests deterministic by default', () => {
    const config = readProjectFile('promptfoo/redteam/security-tests.yaml');
    const assertionTypes = extractAssertionTypes(config);

    expect(assertionTypes).not.toContain('llm-rubric');
  });

  it('prints a free-tier warning before promptfoo provider calls', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['prompt:eval']).toContain(
      'scripts/promptfoo/preflight.mjs'
    );
    expect(packageJson.scripts?.['prompt:redteam']).toContain(
      'scripts/promptfoo/preflight.mjs'
    );
  });
});
