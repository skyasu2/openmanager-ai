#!/usr/bin/env node
/**
 * 🔧 TypeScript 컴파일러 래퍼
 * tsc 명령어 안전 실행 및 종료 시그널 전파
 */

const { spawn } = require('node:child_process');

const SIGNAL_EXIT_CODES = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143,
};

const TIMEOUT_EXIT_CODE = 124;
const DEFAULT_KILL_GRACE_MS = 1000;

function resolveTscPath() {
  if (process.env.TSC_WRAPPER_BIN) {
    return process.env.TSC_WRAPPER_BIN;
  }

  try {
    return require.resolve('typescript/bin/tsc');
  } catch {
    console.error('❌ TypeScript 패키지를 찾을 수 없습니다.');
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const startedAt = Date.now();
const tscPath = resolveTscPath();
let forwardedSignal = null;
let timeoutTriggered = false;
let timeoutHandle = null;
let killHandle = null;

console.log('🔧 TypeScript 컴파일러 실행 중...');

const tsc = spawn(process.execPath, [tscPath, ...args], {
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: false,
  windowsHide: true,
});

function elapsedSeconds() {
  return ((Date.now() - startedAt) / 1000).toFixed(1);
}

function parsePositiveIntEnv(name, fallback = 0) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function forwardSignal(signal) {
  if (forwardedSignal || tsc.exitCode !== null || tsc.killed) {
    return;
  }

  forwardedSignal = signal;
  console.error(
    `⚠️  TypeScript 컴파일이 ${signal} 시그널로 중단되었습니다. 자식 프로세스도 함께 종료합니다.`
  );
  try {
    tsc.kill(signal);
  } catch {}
}

function triggerTimeout(timeoutMs, killGraceMs) {
  if (timeoutTriggered || tsc.exitCode !== null || tsc.killed) {
    return;
  }

  timeoutTriggered = true;
  console.error(
    `⚠️  TypeScript 컴파일 timeout (${timeoutMs}ms). SIGTERM 후 ${killGraceMs}ms grace period를 적용합니다.`
  );
  forwardSignal('SIGTERM');

  killHandle = setTimeout(() => {
    if (tsc.exitCode !== null || tsc.killed) {
      return;
    }
    console.error('⚠️  TypeScript 컴파일러가 SIGTERM에 응답하지 않아 SIGKILL로 종료합니다.');
    try {
      tsc.kill('SIGKILL');
    } catch {}
  }, killGraceMs);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    forwardSignal(signal);
  });
}

const timeoutMs = parsePositiveIntEnv('TSC_WRAPPER_TIMEOUT_MS');
const killGraceMs = parsePositiveIntEnv(
  'TSC_WRAPPER_KILL_GRACE_MS',
  DEFAULT_KILL_GRACE_MS
);
if (timeoutMs > 0) {
  timeoutHandle = setTimeout(() => {
    triggerTimeout(timeoutMs, killGraceMs);
  }, timeoutMs);
}

tsc.on('close', (code, signal) => {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }
  if (killHandle) {
    clearTimeout(killHandle);
  }

  const effectiveSignal = forwardedSignal || signal || null;

  if (timeoutTriggered) {
    console.error(`❌ TypeScript 컴파일 시간 초과 (${elapsedSeconds()}s)`);
    process.exit(TIMEOUT_EXIT_CODE);
  }

  if (effectiveSignal) {
    console.error(
      `❌ TypeScript 컴파일 중단 (${effectiveSignal}, ${elapsedSeconds()}s)`
    );
    process.exit(SIGNAL_EXIT_CODES[effectiveSignal] || 1);
  }

  if (code === 0) {
    console.log(`✅ TypeScript 컴파일 성공 (${elapsedSeconds()}s)`);
  } else {
    console.error(`❌ TypeScript 컴파일 실패 (${elapsedSeconds()}s)`);
  }
  process.exit(code ?? 1);
});

tsc.on('error', (error) => {
  console.error('❌ TypeScript 컴파일러 실행 오류:', error.message);
  process.exit(1);
});
