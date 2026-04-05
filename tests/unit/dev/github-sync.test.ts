/**
 * @vitest-environment node
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = join(process.cwd(), 'scripts', 'sync', 'github-sync.sh');

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'github-sync-test-'));
  tempDirs.push(dir);
  return dir;
}

function buildChildProcessEnv(
  overrides: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...overrides,
  };

  for (const key of Object.keys(env)) {
    if (
      key === 'NODE_OPTIONS' ||
      key === 'NODE_V8_COVERAGE' ||
      key.startsWith('VITEST') ||
      key.startsWith('npm_')
    ) {
      delete env[key];
    }
  }

  return env;
}

function createFixtureRepo() {
  const dir = createTempDir();
  mkdirSync(join(dir, 'docs'), { recursive: true });
  mkdirSync(join(dir, 'tests'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'src'), { recursive: true });

  writeFileSync(join(dir, 'docs', 'guide.md'), '# docs\n', 'utf8');
  writeFileSync(join(dir, 'tests', 'example.test.ts'), 'export {};\n', 'utf8');
  writeFileSync(
    join(dir, 'scripts', 'internal.sh'),
    '#!/usr/bin/env bash\n',
    'utf8'
  );
  writeFileSync(
    join(dir, 'src', 'keep.ts'),
    'export const keep = true;\n',
    'utf8'
  );
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture',
        scripts: {
          lint: 'echo lint',
        },
      },
      null,
      2
    ),
    'utf8'
  );

  return dir;
}

function createFakeGit(
  binDir: string,
  options: {
    repoRoot: string;
    archiveSource: string;
    branch?: string;
    dirtyOutput?: string;
    remoteExists?: boolean;
    commandLogPath?: string;
    fetchSucceeds?: boolean;
    diffCachedOutput?: string;
  }
) {
  const scriptPath = join(binDir, 'git');
  writeFileSync(
    scriptPath,
    `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const repoRoot = ${JSON.stringify(options.repoRoot)};
const archiveSource = ${JSON.stringify(options.archiveSource)};
const branch = ${JSON.stringify(options.branch ?? 'main')};
const dirtyOutput = ${JSON.stringify(options.dirtyOutput ?? '')};
const remoteExists = ${JSON.stringify(options.remoteExists ?? true)};
const commandLogPath = ${JSON.stringify(options.commandLogPath ?? null)};
const fetchSucceeds = ${JSON.stringify(options.fetchSucceeds ?? true)};
const diffCachedOutput = ${JSON.stringify(options.diffCachedOutput ?? '')};

let args = process.argv.slice(2);
if (args[0] === '-C') {
  args = args.slice(2);
}

const key = args.join(' ');
if (commandLogPath) {
  require('node:fs').appendFileSync(commandLogPath, key + '\\n', 'utf8');
}

function out(value) {
  if (value) process.stdout.write(String(value));
}

if (key === 'rev-parse --show-toplevel') {
  out(repoRoot + '\\n');
  process.exit(0);
}

if (key === 'remote get-url origin') {
  if (!remoteExists) process.exit(2);
  out('git@github.com:skyasu2/openmanager-ai.git\\n');
  process.exit(0);
}

if (key === 'rev-parse --abbrev-ref HEAD') {
  out(branch + '\\n');
  process.exit(0);
}

if (key === 'rev-parse --short HEAD') {
  out('abc1234\\n');
  process.exit(0);
}

if (key.startsWith('log -1 --pretty=format:')) {
  out('fixture commit\\n');
  process.exit(0);
}

if (key === 'status --porcelain') {
  out(dirtyOutput);
  process.exit(0);
}

if (key === 'fetch --depth=1 origin main') {
  process.exit(fetchSucceeds ? 0 : 1);
}

if (key === 'diff --cached --name-only') {
  out(diffCachedOutput);
  process.exit(0);
}

if (key === 'archive HEAD') {
  const result = spawnSync('tar', ['-cf', '-', '-C', archiveSource, '.'], {
    encoding: null,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  process.exit(result.status ?? 0);
}

process.exit(0);
`,
    'utf8'
  );
  chmodSync(scriptPath, 0o755);
}

function runGithubSync(
  pathPrefix: string,
  envOverrides: NodeJS.ProcessEnv = {},
  args: string[] = ['--dry-run']
) {
  return spawnSync('bash', [SCRIPT_PATH, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: buildChildProcessEnv({
      PATH: `${pathPrefix}:${process.env.PATH}`,
      ...envOverrides,
    }),
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('github-sync', () => {
  it('shows excluded paths in dry-run mode', () => {
    const fixtureRepo = createFixtureRepo();
    const binDir = createTempDir();
    createFakeGit(binDir, {
      repoRoot: process.cwd(),
      archiveSource: fixtureRepo,
    });

    const result = runGithubSync(binDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('DRY-RUN 완료');
    expect(result.stdout).toContain('제거 예정: docs');
    expect(result.stdout).toContain('제거 예정: tests');
    expect(result.stdout).toContain('제거 예정: scripts');
  });

  it('fails on non-main branch without explicit override', () => {
    const fixtureRepo = createFixtureRepo();
    const binDir = createTempDir();
    createFakeGit(binDir, {
      repoRoot: process.cwd(),
      archiveSource: fixtureRepo,
      branch: 'feature/sync-test',
    });

    const result = runGithubSync(binDir);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "현재 브랜치 'feature/sync-test'"
    );
  });

  it('fails on dirty worktree without explicit override', () => {
    const fixtureRepo = createFixtureRepo();
    const binDir = createTempDir();
    createFakeGit(binDir, {
      repoRoot: process.cwd(),
      archiveSource: fixtureRepo,
      dirtyOutput: ' M package.json\\n',
    });

    const result = runGithubSync(binDir);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      '워킹 트리가 dirty 상태입니다'
    );
  });

  it('links fetched GitHub history without resetting to an unresolved HEAD', () => {
    const fixtureRepo = createFixtureRepo();
    const binDir = createTempDir();
    const commandLogPath = join(createTempDir(), 'git-commands.log');

    createFakeGit(binDir, {
      repoRoot: process.cwd(),
      archiveSource: fixtureRepo,
      commandLogPath,
      fetchSucceeds: true,
      diffCachedOutput: '',
    });

    const result = runGithubSync(binDir, {}, []);
    const commandLog = readFileSync(commandLogPath, 'utf8');

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      '변경 없음 — GitHub가 이미 최신 상태입니다.'
    );
    expect(commandLog).toContain('fetch --depth=1 origin main');
    expect(commandLog).toContain('update-ref refs/heads/main FETCH_HEAD');
    expect(commandLog).toContain('symbolic-ref HEAD refs/heads/main');
    expect(commandLog).toContain('reset --mixed');
    expect(commandLog).not.toContain('rev-parse FETCH_HEAD');
  });
});
