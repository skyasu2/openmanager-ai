function collectChangedFilesFromUpdates({
  updates,
  resolveCommitRef,
  resolveDefaultBaseRef,
  runGit,
  parseChangedFiles,
  isZeroOid,
}) {
  const changedFiles = new Set();

  for (const update of updates) {
    const { localRef, localOid, remoteOid } = update;

    if (
      localRef === '(delete)' ||
      isZeroOid(localOid) ||
      localRef.startsWith('refs/tags/')
    ) {
      continue;
    }

    const localCommit = resolveCommitRef(localOid);
    if (!localCommit) continue;

    let baseCommit = '';
    if (!isZeroOid(remoteOid)) {
      baseCommit = resolveCommitRef(remoteOid);
    } else {
      const defaultBaseRef = resolveDefaultBaseRef();
      if (defaultBaseRef) {
        baseCommit = runGit(['merge-base', localCommit, defaultBaseRef]);
        if (!baseCommit) {
          baseCommit = resolveCommitRef(defaultBaseRef);
        }
      }
    }

    let diffOutput = '';
    if (baseCommit) {
      diffOutput = runGit(['diff', '--name-only', `${baseCommit}..${localCommit}`]);
    } else {
      diffOutput = runGit([
        'diff-tree',
        '--no-commit-id',
        '--name-only',
        '-r',
        localCommit,
      ]);
    }

    for (const file of parseChangedFiles(diffOutput)) {
      changedFiles.add(file);
    }
  }

  return Array.from(changedFiles);
}

function determineChangedFilesForPush({
  overrideText,
  prePushUpdates,
  upstream,
  defaultBaseRef,
  runGit,
  parseChangedFiles,
}) {
  if (String(overrideText || '').trim()) {
    const files = String(overrideText)
      .split(/[,\n]/)
      .map((file) => file.trim())
      .filter(Boolean);
    return { files, isKnown: files.length > 0 };
  }

  if (prePushUpdates.length > 0) {
    return { files: prePushUpdates, isKnown: true };
  }

  if (upstream) {
    const pushedFiles = runGit(['diff', '--name-only', `${upstream}..HEAD`]);
    return { files: parseChangedFiles(pushedFiles), isKnown: true };
  }

  if (defaultBaseRef) {
    const mergeBase = runGit(['merge-base', 'HEAD', defaultBaseRef]);
    if (mergeBase) {
      const branchFiles = runGit(['diff', '--name-only', `${mergeBase}..HEAD`]);
      return { files: parseChangedFiles(branchFiles), isKnown: true };
    }

    const baseDiffFiles = runGit(['diff', '--name-only', `${defaultBaseRef}..HEAD`]);
    if (baseDiffFiles) {
      return { files: parseChangedFiles(baseDiffFiles), isKnown: true };
    }
  }

  const hasPreviousCommit = runGit(['rev-parse', '--verify', 'HEAD~1']);
  if (hasPreviousCommit) {
    const recentFiles = runGit(['diff', '--name-only', 'HEAD~1..HEAD']);
    return { files: parseChangedFiles(recentFiles), isKnown: true };
  }

  return { files: [], isKnown: false };
}

function isKnownNoOpPush(result) {
  return Boolean(result?.isKnown) && Array.isArray(result?.files) && result.files.length === 0;
}

module.exports = {
  collectChangedFilesFromUpdates,
  determineChangedFilesForPush,
  isKnownNoOpPush,
};
