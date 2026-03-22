#!/usr/bin/env node

const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');

const cwd = path.resolve(__dirname, '../..');
const isWindows = os.platform() === 'win32';
const gitCmd = isWindows ? 'git.exe' : 'git';
const bashCmd = 'bash';
const PRE_COMMIT_STAGED_FILES_OVERRIDE =
  process.env.PRE_COMMIT_STAGED_FILES || '';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: options.shell ?? false,
    env: options.env || process.env,
  });

  if (options.capture) {
    return {
      ok: result.status === 0,
      stdout: result.stdout ? result.stdout.trim() : '',
      stderr: result.stderr ? result.stderr.trim() : '',
    };
  }

  return result.status === 0;
}

function parseFileList(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((filePath) => filePath.replace(/\\/g, '/'));
}

function getGitFileList(args) {
  const result = run(gitCmd, args, { capture: true });
  if (!result.ok) return [];
  return parseFileList(result.stdout);
}

function getStagedFiles() {
  if (PRE_COMMIT_STAGED_FILES_OVERRIDE.trim()) {
    return parseFileList(PRE_COMMIT_STAGED_FILES_OVERRIDE);
  }

  return getGitFileList(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
}

function getUnstagedFiles() {
  return getGitFileList(['diff', '--name-only', '--diff-filter=ACMR']);
}

function main() {
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log('ℹ️  No staged files for pre-commit formatting');
    process.exit(0);
  }

  const unstagedSet = new Set(getUnstagedFiles());
  const partiallyStagedFiles = stagedFiles.filter((filePath) =>
    unstagedSet.has(filePath)
  );

  const biomeBaseArgs = [
    'scripts/dev/biome-wrapper.sh',
    'check',
    '--write',
    '--no-errors-on-unmatched',
    '--files-ignore-unknown=true',
  ];

  if (partiallyStagedFiles.length > 0) {
    console.log(
      `ℹ️  Partial staging detected in ${partiallyStagedFiles.length} file(s); using staged-only Biome mode`
    );

    const ok = run(bashCmd, [...biomeBaseArgs, '--staged']);
    process.exit(ok ? 0 : 1);
  }

  console.log(
    `🔍 Running Biome on ${stagedFiles.length} staged file(s) and syncing index`
  );

  const biomeOk = run(bashCmd, [...biomeBaseArgs, '--', ...stagedFiles]);
  if (!biomeOk) {
    process.exit(1);
  }

  const addOk = run(gitCmd, ['add', '--', ...stagedFiles]);
  process.exit(addOk ? 0 : 1);
}

main();
