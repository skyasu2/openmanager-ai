function resolveDefaultBaseRefFromGit(runGit, branchName = '') {
  const preferredRemotes = [];

  if (branchName && branchName !== 'HEAD') {
    preferredRemotes.push(runGit(['config', '--get', `branch.${branchName}.remote`]));
  }

  preferredRemotes.push(runGit(['config', '--get', 'remote.pushDefault']));
  preferredRemotes.push('gitlab', 'origin');

  const remoteCandidates = Array.from(
    new Set(preferredRemotes.map((remote) => String(remote || '').trim()).filter(Boolean))
  );

  for (const remote of remoteCandidates) {
    const remoteHead = runGit([
      'symbolic-ref',
      '--quiet',
      `refs/remotes/${remote}/HEAD`,
    ]);
    if (remoteHead) {
      const normalized = remoteHead.replace(/^refs\/remotes\//, '');
      if (normalized) return normalized;
    }
  }

  for (const remote of remoteCandidates) {
    for (const branch of ['main', 'master']) {
      const candidate = `${remote}/${branch}`;
      const exists = runGit(['rev-parse', '--verify', candidate]);
      if (exists) return candidate;
    }
  }

  for (const candidate of ['main', 'master']) {
    const exists = runGit(['rev-parse', '--verify', candidate]);
    if (exists) return candidate;
  }

  return '';
}

module.exports = {
  resolveDefaultBaseRefFromGit,
};
