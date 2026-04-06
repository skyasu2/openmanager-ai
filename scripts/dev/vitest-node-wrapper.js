#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '../..');
const DEFAULT_NODE_CONFIG = 'config/testing/vitest.config.node.ts';
const DEV_NODE_CONFIG = 'config/testing/vitest.config.dev.ts';
const DEV_TEST_PREFIX = 'tests/unit/dev/';

function resolveVitestCli() {
  const pkgPath = require.resolve('vitest/package.json');
  return path.join(path.dirname(pkgPath), 'vitest.mjs');
}

function normalizeArgPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function extractTargetFiles(argv) {
  const files = [];

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current || current === '--') continue;

    if (current === '--config' || current === '-c') {
      index += 1;
      continue;
    }

    if (current.startsWith('-')) continue;
    files.push(normalizeArgPath(current));
  }

  return files;
}

function shouldUseDevNodeConfig(targetFiles) {
  return (
    targetFiles.length > 0 &&
    targetFiles.every((filePath) => filePath.startsWith(DEV_TEST_PREFIX))
  );
}

function buildVitestArgs(subcommand, passthroughArgs) {
  const targetFiles = extractTargetFiles(passthroughArgs);
  const config = shouldUseDevNodeConfig(targetFiles)
    ? DEV_NODE_CONFIG
    : DEFAULT_NODE_CONFIG;

  return [subcommand, '--config', config, ...passthroughArgs];
}

function main() {
  const [subcommand = 'run', ...passthroughArgs] = process.argv.slice(2);
  const vitestCli = resolveVitestCli();
  const child = spawn(process.execPath, [vitestCli, ...buildVitestArgs(subcommand, passthroughArgs)], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_NODE_CONFIG,
  DEV_NODE_CONFIG,
  DEV_TEST_PREFIX,
  extractTargetFiles,
  shouldUseDevNodeConfig,
  buildVitestArgs,
};
