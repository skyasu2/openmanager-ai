/**
 * @vitest-environment node
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface DeprecatedModelRule {
  pattern: RegExp;
  label: string;
  allowFiles?: string[];
}

const SCAN_ROOTS = [
  'src/config/ai-providers.ts',
  'cloud-run/ai-engine/src',
  'cloud-run/ai-engine/README.md',
  'cloud-run/ai-engine/.env.example',
  'docs/reference/architecture',
  'docs/development/environment-variables.md',
];

const RULES: DeprecatedModelRule[] = [
  {
    label: 'Cerebras Qwen preview runtime default',
    pattern: /qwen-3-235b-a22b-instruct-2507/,
    allowFiles: [
      'cloud-run/ai-engine/src/lib/config-parser.ts',
      'cloud-run/ai-engine/src/routes/providers.test.ts',
      'cloud-run/ai-engine/src/services/ai-sdk/provider-model-metadata.ts',
      'cloud-run/ai-engine/src/services/ai-sdk/provider-model-metadata.test.ts',
    ],
  },
  {
    label: 'legacy Llama 3.3 routing model',
    pattern: /llama-3\.3-70b(?:-versatile)?/,
  },
  {
    label: 'legacy Gemini 2.0 vision model',
    pattern: /gemini-2\.0-flash/,
  },
  {
    label: 'removed OpenRouter Nemotron vision fallback',
    pattern: /nvidia\/nemotron-nano-12b-v2-vl(?::free)?/,
  },
  {
    label: 'legacy Groq Gemma fallback',
    pattern: /gemma2-9b-it/,
  },
  {
    label: 'legacy Groq Maverick preview primary',
    pattern: /meta-llama\/llama-4-maverick/,
  },
  {
    label: 'non-deterministic OpenRouter free router',
    pattern: /openrouter\/free/,
  },
];

function listTrackedFiles(): string[] {
  return execFileSync('git', ['ls-files', ...SCAN_ROOTS], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .filter(
      (file) => !file.includes('/archive/') && !file.includes('/archived/')
    );
}

describe('AI provider model drift guard', () => {
  it('keeps active code and architecture docs on current model policy', () => {
    const findings: string[] = [];

    for (const file of listTrackedFiles()) {
      const content = readFileSync(file, 'utf8');
      for (const rule of RULES) {
        if (rule.allowFiles?.includes(file)) continue;
        if (!rule.pattern.test(content)) continue;
        findings.push(`${file}: ${rule.label}`);
      }
    }

    expect(findings).toEqual([]);
  });
});
