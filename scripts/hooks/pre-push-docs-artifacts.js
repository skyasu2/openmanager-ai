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

function isQaEvidenceIntegrityFile(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  return (
    normalized.startsWith('reports/qa/evidence/') ||
    normalized.startsWith('reports/qa/runs/')
  );
}

function shouldRunQaEvidenceIntegrityValidation(changedFilesResult) {
  if (!changedFilesResult.isKnown || changedFilesResult.files.length === 0) {
    return false;
  }
  return changedFilesResult.files.some((filePath) =>
    isQaEvidenceIntegrityFile(filePath)
  );
}

function isQaRunRecordFile(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  return /^reports\/qa\/runs\/.*\/qa-run-QA-.*\.json$/i.test(normalized);
}

function normalizeArtifactPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function collectRunRecordFiles(rootDir, deps = {}) {
  const existsSync = deps.existsSync || fs.existsSync;
  const readdirSync = deps.readdirSync || fs.readdirSync;
  const files = [];
  const runsRoot = path.join(rootDir, 'reports', 'qa', 'runs');
  if (!existsSync(runsRoot)) return files;

  const queue = [runsRoot];
  while (queue.length > 0) {
    const current = queue.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile() && /^qa-run-QA-.*\.json$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

function collectEvidenceArtifactRefsFromRecord(record) {
  const artifacts = Array.isArray(record?.artifacts) ? record.artifacts : [];
  return artifacts
    .map((artifact) => normalizeArtifactPath(artifact?.path))
    .filter((artifactPath) => artifactPath.startsWith('reports/qa/evidence/'));
}

function readJsonStrictIfPresent(absolutePath, deps = {}) {
  const existsSync = deps.existsSync || fs.existsSync;
  const readFileSync = deps.readFileSync || fs.readFileSync;
  if (!existsSync(absolutePath)) return { exists: false, record: null };
  try {
    return {
      exists: true,
      record: JSON.parse(readFileSync(absolutePath, 'utf8')),
    };
  } catch (error) {
    return { exists: true, record: null, error };
  }
}

function readJsonIfPresent(absolutePath, deps = {}) {
  return readJsonStrictIfPresent(absolutePath, deps).record;
}

function collectEvidenceRefsByPath(rootDir, deps = {}) {
  const refsByPath = new Map();
  for (const runFile of collectRunRecordFiles(rootDir, deps)) {
    const record = readJsonIfPresent(runFile, deps);
    if (!record) continue;

    const runId = record.runId || path.basename(runFile, '.json');
    for (const artifactPath of collectEvidenceArtifactRefsFromRecord(record)) {
      const refs = refsByPath.get(artifactPath) || [];
      refs.push(runId);
      refsByPath.set(artifactPath, refs);
    }
  }
  return refsByPath;
}

function validateQaEvidenceIntegrityChanges(changedFiles, rootDir, deps = {}) {
  const existsSync = deps.existsSync || fs.existsSync;
  const normalizedChangedFiles = Array.isArray(changedFiles) ? changedFiles : [];
  const evidenceChanges = normalizedChangedFiles
    .map(normalizeArtifactPath)
    .filter((filePath) => filePath.startsWith('reports/qa/evidence/'));
  const runRecordChanges = normalizedChangedFiles
    .map(normalizeArtifactPath)
    .filter(isQaRunRecordFile);

  if (evidenceChanges.length === 0 && runRecordChanges.length === 0) {
    return { ok: true, skipped: true };
  }

  const refsByPath = collectEvidenceRefsByPath(rootDir, deps);

  for (const relativePath of evidenceChanges) {
    const absolutePath = path.join(rootDir, relativePath);
    if (existsSync(absolutePath)) continue;

    const referencingRunIds = refsByPath.get(relativePath) || [];
    if (referencingRunIds.length > 0) {
      return {
        ok: false,
        reason: 'referenced-evidence-deleted',
        file: relativePath,
        runIds: referencingRunIds,
      };
    }
  }

  for (const relativePath of runRecordChanges) {
    const absolutePath = path.join(rootDir, relativePath);
    const recordResult = readJsonStrictIfPresent(absolutePath, deps);
    if (!recordResult.exists) {
      return {
        ok: false,
        reason: 'qa-run-deleted',
        file: relativePath,
      };
    }
    if (recordResult.error) {
      return {
        ok: false,
        reason: 'invalid-run-json',
        file: relativePath,
        message: recordResult.error.message,
      };
    }
    const record = recordResult.record;

    for (const artifactPath of collectEvidenceArtifactRefsFromRecord(record)) {
      if (existsSync(path.join(rootDir, artifactPath))) continue;
      return {
        ok: false,
        reason: 'run-references-missing-evidence',
        file: relativePath,
        artifactPath,
      };
    }
  }

  return {
    ok: true,
    skipped: false,
    checkedFiles: [...evidenceChanges, ...runRecordChanges],
  };
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
  isQaEvidenceIntegrityFile,
  isQaRunRecordFile,
  shouldRunQaEvidenceIntegrityValidation,
  validateQaEvidenceIntegrityChanges,
  validateChangedJsonArtifacts,
};
