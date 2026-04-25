'use strict';

const COMPONENT_SOURCE_PREFIX = 'src/components/';
const APP_COMPONENT_SEGMENT = '/components/';
const COMPONENT_MAP_DOC = 'docs/reference/architecture/system/component-dependency-map.md';
const COMPONENT_MAP_JSON = 'reports/docs/component-dependency-map.json';
const COMPONENT_MAP_GENERATOR = 'scripts/docs/generate-component-dependency-map.ts';
const COMPONENT_MAP_VERIFIER = 'scripts/docs/verify-component-dependency-map.sh';

function normalize(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function isComponentMapRelevantFile(filePath) {
  const normalized = normalize(filePath);
  if (!normalized) return false;

  if (normalized.startsWith(COMPONENT_SOURCE_PREFIX)) return true;
  if (normalized.startsWith('src/app/') && normalized.includes(APP_COMPONENT_SEGMENT)) return true;
  if (normalized === COMPONENT_MAP_DOC) return true;
  if (normalized === COMPONENT_MAP_JSON) return true;
  if (normalized === COMPONENT_MAP_GENERATOR) return true;
  if (normalized === COMPONENT_MAP_VERIFIER) return true;
  return false;
}

function shouldVerifyComponentDependencyMap({ changedFilesResult, force = false }) {
  if (force) {
    return {
      shouldRun: true,
      reason: 'forced',
    };
  }

  if (!changedFilesResult || !changedFilesResult.isKnown) {
    return {
      shouldRun: false,
      reason: 'unknown-changed-files',
    };
  }

  const files = Array.isArray(changedFilesResult.files) ? changedFilesResult.files : [];
  if (files.length === 0) {
    return {
      shouldRun: false,
      reason: 'known-no-op-push',
    };
  }

  const hasRelevantChange = files.some((filePath) => isComponentMapRelevantFile(filePath));
  if (!hasRelevantChange) {
    return {
      shouldRun: false,
      reason: 'not-relevant',
    };
  }

  return {
    shouldRun: true,
    reason: 'relevant-changes',
  };
}

module.exports = {
  isComponentMapRelevantFile,
  shouldVerifyComponentDependencyMap,
};
