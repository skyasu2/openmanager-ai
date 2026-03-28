'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function createTypeCheckStatusFile() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmanager-typecheck-'));
  return { tempDir, filePath: path.join(tempDir, 'status.txt') };
}

function readTypeCheckStatus(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function cleanupTypeCheckStatus(tempDir) {
  if (!tempDir) return;
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore temp cleanup failures in git hook path
  }
}

function analyzeBuildValidation({
  changedFilesResult,
  skipBuild,
  isLimitedMode,
  quickPush,
  isKnownNoOpPush,
  filterTypeCheckRelevantFiles,
  isCloudRunTypeCheckRelevantFile,
}) {
  if (skipBuild) {
    return { mode: 'skip-build' };
  }

  if (isKnownNoOpPush(changedFilesResult)) {
    return { mode: 'known-no-op' };
  }

  if (isLimitedMode) {
    return { mode: 'windows-limited' };
  }

  if (!quickPush) {
    return { mode: 'full-build' };
  }

  const rootTypeCheckRelevantFiles = filterTypeCheckRelevantFiles(
    changedFilesResult.files
  );
  const cloudRunTypeCheckRelevantFiles = changedFilesResult.files.filter((filePath) =>
    isCloudRunTypeCheckRelevantFile(filePath)
  );
  const hasKnownFiles =
    changedFilesResult.isKnown && changedFilesResult.files.length > 0;
  const skipRootTypeCheck =
    hasKnownFiles && rootTypeCheckRelevantFiles.length === 0;
  const skipCloudRunTypeCheck =
    hasKnownFiles && cloudRunTypeCheckRelevantFiles.length === 0;

  return {
    mode: 'quick',
    rootTypeCheckRelevantFiles,
    cloudRunTypeCheckRelevantFiles,
    skipRootTypeCheck,
    skipCloudRunTypeCheck,
    useChangedTypeCheck:
      changedFilesResult.isKnown && rootTypeCheckRelevantFiles.length > 0,
    shouldSkipAll: skipRootTypeCheck && skipCloudRunTypeCheck,
  };
}

module.exports = {
  createTypeCheckStatusFile,
  readTypeCheckStatus,
  cleanupTypeCheckStatus,
  analyzeBuildValidation,
};
