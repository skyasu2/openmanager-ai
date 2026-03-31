#!/usr/bin/env node

const { spawn } = require('node:child_process');

const SIGNAL_EXIT_CODES = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143,
};

const child = spawn('bash', ['scripts/ci/local-docker-ci.sh'], {
  stdio: 'inherit',
  shell: false,
  env: process.env,
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    if (!child.killed && child.exitCode === null) {
      child.kill(signal);
    }
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(SIGNAL_EXIT_CODES[signal] || 1);
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('[run-local-docker-ci] failed to start:', error.message);
  process.exit(1);
});
