#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

const rootPkg = readJson('package.json');
const enginePkg = readJson('cloud-run/ai-engine/package.json');
const changelog = read('CHANGELOG.md');
const versionRoute = read('src/app/api/version/route.ts');

const expectedVersion = String(rootPkg.version || '').trim();
const tagMode = String(process.env.RELEASE_CHECK_TAG || 'required').toLowerCase();
const freshnessMode = String(
  process.env.RELEASE_CHECK_FRESHNESS || 'warn'
).toLowerCase();
const rawMaxCommits = Number.parseInt(
  String(process.env.RELEASE_CHECK_MAX_COMMITS || '30'),
  10
);
const maxCommitsSinceTag =
  Number.isFinite(rawMaxCommits) && rawMaxCommits > 0 ? rawMaxCommits : 30;
const checks = [];

function pass(id, msg) {
  checks.push({ level: 'PASS', id, msg });
}
function warn(id, msg) {
  checks.push({ level: 'WARN', id, msg });
}
function fail(id, msg) {
  checks.push({ level: 'FAIL', id, msg });
}

if (!expectedVersion) {
  fail('REL-001', 'package.json version is empty');
} else {
  pass('REL-001', `package version=${expectedVersion}`);
}

if (enginePkg.version === expectedVersion) {
  pass('REL-002', 'cloud-run/ai-engine/package.json version matches');
} else {
  fail(
    'REL-002',
    `ai-engine version mismatch (root=${expectedVersion}, ai-engine=${enginePkg.version})`
  );
}

const changelogPattern = new RegExp(
  `^## \\[${expectedVersion.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\]`,
  'm'
);
if (changelogPattern.test(changelog)) {
  pass('REL-003', `CHANGELOG has ${expectedVersion} section`);
} else {
  fail('REL-003', `CHANGELOG is missing ${expectedVersion} section`);
}

let localTags = '';
try {
  localTags = execSync(`git tag --list v${expectedVersion}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  localTags = '';
}
if (tagMode === 'off') {
  warn('REL-004', 'tag check disabled (RELEASE_CHECK_TAG=off)');
} else if (localTags === `v${expectedVersion}`) {
  pass('REL-004', `local tag v${expectedVersion} exists`);
} else if (tagMode === 'warn') {
  warn('REL-004', `local tag v${expectedVersion} is missing (warn mode)`);
} else {
  fail('REL-004', `local tag v${expectedVersion} is missing`);
}

function getRevCount(rangeExpr) {
  try {
    const out = execSync(`git rev-list --count ${rangeExpr}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const parsed = Number.parseInt(out, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

if (freshnessMode === 'off') {
  warn('REL-007', 'release freshness check disabled (RELEASE_CHECK_FRESHNESS=off)');
} else if (localTags === `v${expectedVersion}`) {
  const commitsSinceTag = getRevCount(`v${expectedVersion}..HEAD`);
  if (commitsSinceTag === null) {
    warn('REL-007', `unable to calculate commits since v${expectedVersion}`);
  } else if (commitsSinceTag <= maxCommitsSinceTag) {
    pass(
      'REL-007',
      `release freshness OK (${commitsSinceTag} commits since v${expectedVersion}, threshold=${maxCommitsSinceTag})`
    );
  } else if (freshnessMode === 'required') {
    fail(
      'REL-007',
      `release metadata is stale (${commitsSinceTag} commits since v${expectedVersion}, threshold=${maxCommitsSinceTag})`
    );
  } else {
    warn(
      'REL-007',
      `release metadata drift detected (${commitsSinceTag} commits since v${expectedVersion}, threshold=${maxCommitsSinceTag})`
    );
  }
} else {
  warn(
    'REL-007',
    `release freshness skipped (tag v${expectedVersion} missing)`
  );
}

if (versionRoute.includes('NEXT_PUBLIC_APP_VERSION')) {
  pass('REL-005', 'version route uses NEXT_PUBLIC_APP_VERSION');
} else {
  const match = versionRoute.match(/version:\s*['"]([^'"]+)['"]/);
  if (match?.[1] === expectedVersion) {
    warn('REL-005', 'version route uses hardcoded version (matches current version)');
  } else {
    fail('REL-005', 'version route is not env-synced and version does not match');
  }
}

if (versionRoute.includes('NEXT_PUBLIC_NEXTJS_VERSION')) {
  pass('REL-006', 'version route uses NEXT_PUBLIC_NEXTJS_VERSION');
} else {
  warn('REL-006', 'version route nextjs_version is hardcoded');
}

for (const item of checks) {
  console.log(`${item.level} ${item.id} ${item.msg}`);
}

const hasFail = checks.some((c) => c.level === 'FAIL');
process.exit(hasFail ? 1 : 0);
