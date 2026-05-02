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
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = join(
  process.cwd(),
  'scripts',
  'docs',
  'verify-component-dependency-map.sh'
);
const DOC_PATH =
  'docs/reference/architecture/system/component-dependency-map.md';
const JSON_PATH = 'reports/docs/component-dependency-map.json';

const tempDirs: string[] = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'component-map-verify-'));
  tempDirs.push(dir);
  return dir;
}

function runCommand(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
}

function writeWorkspaceFile(
  root: string,
  relativePath: string,
  content: string
) {
  const filePath = join(root, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

function initGitRepo(root: string) {
  runCommand('git', ['init', '-q'], root);
  runCommand('git', ['add', DOC_PATH, JSON_PATH], root);
  runCommand(
    'git',
    [
      '-c',
      'user.email=test@example.com',
      '-c',
      'user.name=Test',
      'commit',
      '-qm',
      'init',
    ],
    root
  );
}

function createFakeNpm(root: string) {
  const binDir = join(root, 'bin');
  mkdirSync(binDir, { recursive: true });
  const npmPath = join(binDir, 'npm');
  writeFileSync(
    npmPath,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'if [[ "$' +
        '{COMPONENT_MAP_FAKE_GENERATE:-unchanged}" == "change" ]]; then',
      `  mkdir -p "${dirname(DOC_PATH)}" "${dirname(JSON_PATH)}"`,
      `  printf '%s\\n' "$COMPONENT_MAP_FAKE_DOC" > "${DOC_PATH}"`,
      `  printf '%s\\n' "$COMPONENT_MAP_FAKE_JSON" > "${JSON_PATH}"`,
      'fi',
      'exit 0',
      '',
    ].join('\n'),
    'utf8'
  );
  chmodSync(npmPath, 0o755);
  return binDir;
}

function runVerify(root: string, env: NodeJS.ProcessEnv = {}) {
  const fakeBin = createFakeNpm(root);
  return spawnSync('bash', [SCRIPT_PATH], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
      PATH: `${fakeBin}:${process.env.PATH || ''}`,
    },
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('component dependency map verifier', () => {
  it('passes when generated files are dirty but already up to date', () => {
    const root = createTempDir();
    writeWorkspaceFile(root, DOC_PATH, 'old doc\n');
    writeWorkspaceFile(root, JSON_PATH, '{"old":true}\n');
    initGitRepo(root);
    writeWorkspaceFile(root, DOC_PATH, 'generated doc\n');
    writeWorkspaceFile(root, JSON_PATH, '{"generated":true}\n');

    const result = runVerify(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      'OK: Component dependency map is up to date.'
    );
    expect(readFileSync(join(root, DOC_PATH), 'utf8')).toBe('generated doc\n');
  });

  it('fails when the generator changes the checked files during verification', () => {
    const root = createTempDir();
    writeWorkspaceFile(root, DOC_PATH, 'old doc\n');
    writeWorkspaceFile(root, JSON_PATH, '{"old":true}\n');
    initGitRepo(root);

    const result = runVerify(root, {
      COMPONENT_MAP_FAKE_GENERATE: 'change',
      COMPONENT_MAP_FAKE_DOC: 'new doc',
      COMPONENT_MAP_FAKE_JSON: '{"new":true}',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Component dependency map is out of date.');
    expect(result.stdout).toContain('Run: npm run docs:components:map');
  });
});
