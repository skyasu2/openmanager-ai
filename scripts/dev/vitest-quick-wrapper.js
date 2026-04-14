#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '../..');
const DEP_SCAN_FAILURE_MARKER =
  '(!) Failed to run dependency scan. Skipping dependency pre-bundling.';
const DEP_SCAN_OUTDATED_REQUEST_MARKER =
  'The server is being restarted or closed. Request is outdated';
const PASSED_TEST_FILES_MARKER = 'Test Files';

function resolveVitestCli() {
  const pkgPath = require.resolve('vitest/package.json');
  return path.join(path.dirname(pkgPath), 'vitest.mjs');
}

function stripKnownDepScanNoise(text) {
  if (!text) return '';
  const markerIndex = text.indexOf(DEP_SCAN_FAILURE_MARKER);
  if (markerIndex === -1) return text;
  return text.slice(0, markerIndex).trimEnd();
}

function filterVitestQuickOutput(exitCode, stdout, stderr) {
  const combined = `${stdout}\n${stderr}`;
  const shouldSuppress =
    exitCode === 0 &&
    combined.includes(PASSED_TEST_FILES_MARKER) &&
    combined.includes(DEP_SCAN_FAILURE_MARKER) &&
    combined.includes(DEP_SCAN_OUTDATED_REQUEST_MARKER);

  if (!shouldSuppress) {
    return { stdout, stderr, suppressed: false };
  }

  const filteredStdout = stripKnownDepScanNoise(stdout);
  const filteredStderr = stripKnownDepScanNoise(stderr);
  const note =
    '[vitest-quick-wrapper] Suppressed benign Vite dep-scan noise after a successful quick smoke run triggered by generated HTML artifacts.';

  return {
    stdout: filteredStdout,
    stderr: filteredStderr ? `${filteredStderr}\n${note}\n` : `${note}\n`,
    suppressed: true,
  };
}

function main() {
  const vitestCli = resolveVitestCli();
  const child = spawn(
    process.execPath,
    [vitestCli, 'run', '--config', 'config/testing/vitest.config.minimal.ts'],
    {
      cwd: projectRoot,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
      env: process.env,
    }
  );

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('close', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    const { stdout: filteredStdout, stderr: filteredStderr } =
      filterVitestQuickOutput(code ?? 1, stdout, stderr);

    if (filteredStdout) process.stdout.write(filteredStdout);
    if (filteredStderr) process.stderr.write(filteredStderr);
    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error('❌ Vitest quick wrapper execution error:', error.message);
    process.exit(1);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  filterVitestQuickOutput,
  stripKnownDepScanNoise,
};
