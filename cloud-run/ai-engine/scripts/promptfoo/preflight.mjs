#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = process.argv[2];

if (!configPath) {
  console.error(
    '[promptfoo-preflight] usage: node scripts/promptfoo/preflight.mjs <config.yaml>'
  );
  process.exit(1);
}

const absoluteConfigPath = resolve(process.cwd(), configPath);
const config = readFileSync(absoluteConfigPath, 'utf8');

const countMatches = (pattern) => Array.from(config.matchAll(pattern)).length;
const sectionBetween = (startMarker, endMarker) => {
  const start = config.indexOf(startMarker);
  if (start === -1) {
    return '';
  }

  const end = config.indexOf(endMarker, start + startMarker.length);
  return end === -1 ? config.slice(start) : config.slice(start, end);
};

const assertionCount = countMatches(/^\s*-\s*type:\s*[a-z0-9-]+/gim);
const rubricCount = countMatches(/^\s*-\s*type:\s*llm-rubric\b/gim);
const promptsSection = sectionBetween('\nprompts:', '\nproviders:');
const providersSection = sectionBetween('\nproviders:', '\ndefaultTest:');
const testsSection = sectionBetween('\ntests:', '\n# =============================================================================\n# Output Settings');
const promptCount = Array.from(
  promptsSection.matchAll(/^\s*-\s*(?:id:|file:\/\/)/gm)
).length;
const providerCount = Array.from(
  providersSection.matchAll(/^\s*-\s*id:\s*[^\s]+/gm)
).length;
const testCount = Array.from(
  testsSection.matchAll(/^\s*-\s*(?:description:|vars:)/gm)
).length;
const perTestPromptPairCount = Array.from(
  testsSection.matchAll(/^\s*prompts:\s*\[([^\]]+)\]/gm)
).reduce((total, match) => {
  const promptRefs = match[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return total + Math.max(1, promptRefs.length);
}, 0);

const rubricRatio = assertionCount === 0 ? 0 : rubricCount / assertionCount;
const promptTestPairs =
  perTestPromptPairCount > 0
    ? perTestPromptPairCount
    : Math.max(1, promptCount) * Math.max(1, testCount);
const estimatedProviderCalls = Math.max(1, providerCount) * Math.max(1, promptTestPairs);
const ratioText = `${(rubricRatio * 100).toFixed(1)}%`;

console.warn(
  `[promptfoo-preflight] ${configPath}: providers=${providerCount}, prompts=${promptCount}, tests=${testCount}, prompt/test pairs=${promptTestPairs}, estimated live provider calls=${estimatedProviderCalls}`
);
console.warn(
  `[promptfoo-preflight] assertions=${assertionCount}, llm-rubric=${rubricCount} (${ratioText}). Judge LLM assertions must stay below 20%.`
);
console.warn(
  '[promptfoo-preflight] This command can call live provider APIs. Keep it local/manual and verify free-tier headroom before running broad evals.'
);

if (rubricRatio >= 0.2) {
  console.error(
    `[promptfoo-preflight] blocked: llm-rubric ratio ${ratioText} exceeds deterministic eval budget.`
  );
  process.exit(1);
}
