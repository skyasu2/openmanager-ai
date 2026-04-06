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
  isTypeDefinitionFile,
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
  const rootTypeDefinitionOnly =
    rootTypeCheckRelevantFiles.length > 0 &&
    rootTypeCheckRelevantFiles.every((filePath) => isTypeDefinitionFile(filePath));
  const cloudRunTypeCheckRelevantFiles = changedFilesResult.files.filter((filePath) =>
    isCloudRunTypeCheckRelevantFile(filePath)
  );
  const hasKnownFiles =
    changedFilesResult.isKnown && changedFilesResult.files.length > 0;
  const skipRootTypeCheck =
    hasKnownFiles &&
    (rootTypeCheckRelevantFiles.length === 0 || rootTypeDefinitionOnly);
  const skipCloudRunTypeCheck =
    hasKnownFiles && cloudRunTypeCheckRelevantFiles.length === 0;
  const rootTypeCheckStrategy =
    rootTypeCheckRelevantFiles.length === 0
      ? 'skip-no-relevant'
      : rootTypeDefinitionOnly
        ? 'skip-type-definition-only'
        : 'changed';

  return {
    mode: 'quick',
    rootTypeCheckRelevantFiles,
    cloudRunTypeCheckRelevantFiles,
    rootTypeCheckStrategy,
    skipRootTypeCheck,
    skipCloudRunTypeCheck,
    useChangedTypeCheck:
      changedFilesResult.isKnown &&
      rootTypeCheckRelevantFiles.length > 0 &&
      !rootTypeDefinitionOnly,
    shouldSkipAll: skipRootTypeCheck && skipCloudRunTypeCheck,
  };
}

function describeQuickBuildValidationSkip(buildValidation) {
  if (buildValidation?.mode !== 'quick' || !buildValidation.shouldSkipAll) {
    return null;
  }

  if (buildValidation.rootTypeCheckStrategy === 'skip-type-definition-only') {
    return {
      typeCheckStatus: 'delegated-type-definition-only',
      message: '⚪ Root TypeScript 검증 위임 (src/types type-definition-only push)',
    };
  }

  return {
    typeCheckStatus: 'skipped-no-relevant-ts',
    message: '⚪ TypeScript 검증 스킵 (push 범위에 관련 TS 파일 없음)',
  };
}

module.exports = {
  createTypeCheckStatusFile,
  readTypeCheckStatus,
  cleanupTypeCheckStatus,
  analyzeBuildValidation,
  describeQuickBuildValidationSkip,
};
