/**
 * Pre-push file classifier helpers
 * Pure functions — no side effects, no process.exit
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const CLOUD_RUN_ROOT = 'cloud-run/ai-engine';

// ─── Infra sets (used by classifier functions) ─────────────────────────────

const DOM_INFRA_SMOKE_SENTINEL = 'src/test/setup.ts';

const DOM_TEST_INFRA_EXACT = new Set([
  'config/testing/dom-test-globs.ts',
  'config/testing/dom-test-manifest.json',
  'config/testing/msw-setup.ts',
  'config/testing/shared-aliases.ts',
  'config/testing/vitest.config.dom.ts',
  'config/testing/vitest.config.main.ts',
  'scripts/dev/vitest-main-wrapper.js',
  DOM_INFRA_SMOKE_SENTINEL,
]);

const HOOK_TEST_INFRA_EXACT = new Set(['scripts/hooks/pre-push.js']);

const FRONTEND_SMOKE_PREFIXES = [
  'src/components/ai/',
  'src/components/ai-sidebar/',
  'src/app/dashboard/ai-assistant/',
];

const FRONTEND_SMOKE_EXACT = new Set([
  'src/app/dashboard/DashboardClient.tsx',
  'src/app/dashboard/dashboard-client-helpers.tsx',
  'src/components/dashboard/AIAssistantButton.tsx',
  'src/components/dashboard/AIAssistantButton.test.tsx',
]);

// ─── DOM manifest loader ───────────────────────────────────────────────────

function loadDomTestManifest(cwd) {
  const manifestPath = path.join(cwd, 'config/testing/dom-test-manifest.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const pathPrefixes = Array.isArray(parsed.pathPrefixes)
      ? parsed.pathPrefixes.map((entry) => normalizeFilePath(entry))
      : [];
    const exactFiles = Array.isArray(parsed.exactFiles)
      ? parsed.exactFiles.map((entry) => normalizeFilePath(entry))
      : [];
    return { pathPrefixes, exactFiles: new Set(exactFiles) };
  } catch (error) {
    console.warn(
      '⚠️  Failed to load DOM test manifest, falling back to quick tests:',
      error.message
    );
    return { pathPrefixes: [], exactFiles: new Set() };
  }
}

// ─── Path helpers ──────────────────────────────────────────────────────────

function normalizeFilePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toCloudRunRelativePath(filePath) {
  return normalizeFilePath(filePath).replace(`${CLOUD_RUN_ROOT}/`, '');
}

// ─── Classifiers ──────────────────────────────────────────────────────────

function isVitestTestFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (normalized.startsWith('tests/e2e/')) return false;
  if (normalized.startsWith('tests/manual/')) return false;
  return /\.(test|spec)\.(js|ts|tsx)$/u.test(normalized);
}

function isPlaywrightTestFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (!normalized.startsWith('tests/e2e/')) return false;
  return /\.(test|spec)\.(js|ts|tsx)$/u.test(normalized);
}

function isJavaScriptSourceFile(filePath) {
  return /\.(js|jsx|ts|tsx)$/u.test(normalizeFilePath(filePath));
}

function isCloudRunFile(filePath) {
  return normalizeFilePath(filePath).startsWith(`${CLOUD_RUN_ROOT}/`);
}

function isCloudRunVitestTestFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  return isCloudRunFile(normalized) && isVitestTestFile(normalized);
}

function isCloudRunRelatedSourceFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (!normalized.startsWith(`${CLOUD_RUN_ROOT}/src/`)) return false;
  if (!isJavaScriptSourceFile(normalized)) return false;
  return !isVitestTestFile(normalized);
}

function isCloudRunTypeCheckRelevantFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (!normalized.startsWith(`${CLOUD_RUN_ROOT}/src/`)) return false;
  if (!/\.(ts|tsx)$/u.test(normalized)) return false;
  return !isVitestTestFile(normalized);
}

function isRelatedSourceFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (!normalized.startsWith('src/')) return false;
  if (!isJavaScriptSourceFile(normalized)) return false;
  return !isVitestTestFile(normalized);
}

function isTypeDefinitionSourceFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (!normalized.startsWith('src/types/')) return false;
  if (!/\.(ts|tsx)$/u.test(normalized)) return false;
  return !isVitestTestFile(normalized);
}

function isDomTestInfraFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  return DOM_TEST_INFRA_EXACT.has(normalized);
}

function isHookTestInfraFile(filePath) {
  return HOOK_TEST_INFRA_EXACT.has(normalizeFilePath(filePath));
}

function isFrontendSmokeFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (FRONTEND_SMOKE_EXACT.has(normalized)) return true;
  return FRONTEND_SMOKE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isDomTestFile(filePath, domTestManifest) {
  const normalized = normalizeFilePath(filePath);
  if (!isVitestTestFile(normalized)) return false;
  if (domTestManifest.exactFiles.has(normalized)) return true;
  return domTestManifest.pathPrefixes.some((prefix) => normalized.startsWith(prefix));
}

module.exports = {
  CLOUD_RUN_ROOT,
  DOM_INFRA_SMOKE_SENTINEL,
  DOM_TEST_INFRA_EXACT,
  HOOK_TEST_INFRA_EXACT,
  FRONTEND_SMOKE_PREFIXES,
  FRONTEND_SMOKE_EXACT,
  loadDomTestManifest,
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
  isTypeDefinitionSourceFile,
  isDomTestInfraFile,
  isHookTestInfraFile,
  isFrontendSmokeFile,
  isDomTestFile,
};
