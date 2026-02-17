#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const SERVICE_NAME = process.env.CLOUD_RUN_SERVICE || 'ai-engine';
const REGION = process.env.CLOUD_RUN_REGION || 'asia-northeast1';

const EXPECTED = {
  maxScale: 1,
  concurrency: 80,
  cpu: '1',
  memory: '512Mi',
  timeoutSeconds: 300,
  cpuThrottling: 'true',
};

function runGcloud(args) {
  const result = spawnSync('gcloud', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || '(no stderr)';
    throw new Error(`gcloud ${args.join(' ')} failed: ${stderr}`);
  }
  return result.stdout;
}

function parseService() {
  const raw = runGcloud([
    'run',
    'services',
    'describe',
    SERVICE_NAME,
    '--region',
    REGION,
    '--format=json',
  ]);
  return JSON.parse(raw);
}

function asString(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function check(label, ok, detail) {
  const prefix = ok ? 'PASS' : 'FAIL';
  console.log(`${prefix} ${label} ${detail}`);
  return ok;
}

function main() {
  let service;
  try {
    service = parseService();
  } catch (error) {
    console.error(
      `FAIL CLOUD-RUN-DESCRIBE ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  const template = service?.spec?.template || {};
  const annotations = template?.metadata?.annotations || {};
  const spec = template?.spec || {};
  const container = spec?.containers?.[0] || {};
  const limits = container?.resources?.limits || {};

  const maxScale = Number.parseInt(
    asString(annotations['autoscaling.knative.dev/maxScale'] || '0'),
    10
  );
  const concurrency = Number.parseInt(asString(spec.containerConcurrency || '0'), 10);
  const timeoutSeconds = Number.parseInt(asString(spec.timeoutSeconds || '0'), 10);
  const cpu = asString(limits.cpu);
  const memory = asString(limits.memory);
  const cpuThrottling = asString(annotations['run.googleapis.com/cpu-throttling']);

  const checks = [];
  checks.push(
    check(
      'CR-001 maxScale',
      maxScale === EXPECTED.maxScale,
      `(actual=${maxScale}, expected=${EXPECTED.maxScale})`
    )
  );
  checks.push(
    check(
      'CR-002 concurrency',
      concurrency === EXPECTED.concurrency,
      `(actual=${concurrency}, expected=${EXPECTED.concurrency})`
    )
  );
  checks.push(
    check(
      'CR-003 timeoutSeconds',
      timeoutSeconds === EXPECTED.timeoutSeconds,
      `(actual=${timeoutSeconds}, expected=${EXPECTED.timeoutSeconds})`
    )
  );
  checks.push(
    check(
      'CR-004 cpu',
      cpu === EXPECTED.cpu,
      `(actual=${cpu || 'unknown'}, expected=${EXPECTED.cpu})`
    )
  );
  checks.push(
    check(
      'CR-005 memory',
      memory === EXPECTED.memory,
      `(actual=${memory || 'unknown'}, expected=${EXPECTED.memory})`
    )
  );
  checks.push(
    check(
      'CR-006 cpu-throttling',
      cpuThrottling === EXPECTED.cpuThrottling,
      `(actual=${cpuThrottling || 'unknown'}, expected=${EXPECTED.cpuThrottling})`
    )
  );

  const latestReady = service?.status?.latestReadyRevisionName || 'unknown';
  const url = service?.status?.url || 'unknown';
  console.log(`INFO CR-REV latestReadyRevision=${latestReady}`);
  console.log(`INFO CR-URL ${url}`);

  if (checks.every(Boolean)) {
    console.log('PASS CR-SUMMARY free-tier guardrails intact');
    process.exit(0);
  }

  console.log('FAIL CR-SUMMARY free-tier guardrail drift detected');
  process.exit(1);
}

main();
