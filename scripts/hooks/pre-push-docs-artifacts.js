'use strict';

const fs = require('fs');
const path = require('path');

function isLightweightArtifactFile(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  if (!normalized) return false;
  if (normalized.endsWith('.md')) return true;
  if (normalized.endsWith('.json')) {
    return normalized.startsWith('docs/') || normalized.startsWith('reports/');
  }
  return false;
}

function isDocsArtifactOnlyPush(changedFilesResult) {
  if (!changedFilesResult.isKnown || changedFilesResult.files.length === 0) return false;
  return changedFilesResult.files.every((filePath) => isLightweightArtifactFile(filePath));
}

function validateChangedJsonArtifacts(changedFiles, cwd, deps = {}) {
  const existsSync = deps.existsSync || fs.existsSync;
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const jsonFiles = changedFiles.filter((filePath) => filePath.endsWith('.json'));

  if (jsonFiles.length === 0) {
    return { ok: true, skipped: true, jsonFiles: [] };
  }

  for (const relativePath of jsonFiles) {
    const absolutePath = path.join(cwd, relativePath);
    if (!existsSync(absolutePath)) {
      return {
        ok: false,
        reason: 'missing-json-artifact',
        file: relativePath,
      };
    }

    try {
      JSON.parse(readFileSync(absolutePath, 'utf8'));
    } catch (error) {
      return {
        ok: false,
        reason: 'invalid-json-artifact',
        file: relativePath,
        message: error.message,
      };
    }
  }

  return {
    ok: true,
    skipped: false,
    jsonFiles,
  };
}

module.exports = {
  isLightweightArtifactFile,
  isDocsArtifactOnlyPush,
  validateChangedJsonArtifacts,
};
