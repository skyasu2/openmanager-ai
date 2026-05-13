#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gitlabUrl = 'https://gitlab.com/skyasu2/openmanager-ai';

const defaultTypes = [
  { type: 'feat', section: 'Features' },
  { type: 'fix', section: 'Bug Fixes' },
  { type: 'perf', section: 'Performance Improvements' },
  { type: 'refactor', section: 'Code Refactoring' },
  { type: 'test', section: 'Tests' },
  { type: 'chore', hidden: true },
  { type: 'docs', hidden: true },
  { type: 'style', hidden: true },
  { type: 'ci', hidden: true },
];

function parseArgs(argv) {
  const options = {
    dryRun: false,
    firstRelease: false,
    releaseAs: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--first-release') {
      options.firstRelease = true;
      continue;
    }

    if (arg === '--release-as') {
      options.releaseAs = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (['major', 'minor', 'patch'].includes(arg) || /^\d+\.\d+\.\d+$/.test(arg)) {
      options.releaseAs = arg;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function readText(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function writeText(relativePath, content) {
  writeFileSync(path.join(root, relativePath), content, 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function writeJson(relativePath, value) {
  writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function maybeReadJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) {
    return null;
  }
  return readJson(relativePath);
}

function git(args, options = {}) {
  const output = execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  });

  if (typeof output === 'string') {
    return output.trim();
  }
  if (Buffer.isBuffer(output)) {
    return output.toString('utf8').trim();
  }
  return '';
}

function ensureCleanWorktree() {
  const dirty = git(['status', '--porcelain']);
  if (dirty) {
    throw new Error(
      `Release requires a clean worktree. Commit or stash changes first.\n${dirty}`
    );
  }
}

function parseVersion(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Unsupported semver version: ${version}`);
  }
  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

function bumpVersion(version, releaseAs) {
  if (/^\d+\.\d+\.\d+$/.test(releaseAs)) {
    return releaseAs;
  }

  const [major, minor, patch] = parseVersion(version);

  if (releaseAs === 'major') {
    return `${major + 1}.0.0`;
  }
  if (releaseAs === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  if (releaseAs === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  }

  throw new Error(`Unsupported release type: ${releaseAs}`);
}

function latestSemverTag() {
  const tags = git(['tag', '--list', 'v[0-9]*.[0-9]*.[0-9]*', '--sort=-v:refname']);
  return tags.split('\n').find(Boolean) || '';
}

function loadReleaseConfig() {
  const config = maybeReadJson('.versionrc.json') || {};
  return {
    types: Array.isArray(config.types) ? config.types : defaultTypes,
    commitUrlFormat:
      config.commitUrlFormat || `${gitlabUrl}/-/commit/{{hash}}`,
    compareUrlFormat:
      config.compareUrlFormat ||
      `${gitlabUrl}/-/compare/{{previousTag}}...{{currentTag}}`,
  };
}

function commitsSince(previousTag) {
  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
  const raw = git(['log', '--format=%H%x1f%s%x1f%b%x1e', range]);
  if (!raw) {
    return [];
  }

  return raw
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body = ''] = entry.split('\x1f');
      return { hash, subject, body };
    })
    .filter((commit) => !/^chore\(release\):\s+\d+\.\d+\.\d+$/.test(commit.subject));
}

function recommendedBump(commits) {
  let bump = 'patch';
  for (const commit of commits) {
    if (
      /^[a-z]+(?:\([^)]+\))?!:/.test(commit.subject) ||
      /^BREAKING CHANGE:/m.test(commit.body)
    ) {
      return 'major';
    }
    if (/^feat(?:\([^)]+\))?:/.test(commit.subject)) {
      bump = 'minor';
    }
  }
  return bump;
}

function kstDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function sectionForCommit(commit, typeConfig) {
  const match = commit.subject.match(/^([a-z]+)(?:\(([^)]+)\))?!?:\s+(.+)$/);
  if (!match) {
    return {
      section: 'Miscellaneous',
      text: commit.subject,
    };
  }

  const [, type, scope, description] = match;
  const config = typeConfig.find((item) => item.type === type);
  if (config?.hidden) {
    return null;
  }

  return {
    section: config?.section || 'Miscellaneous',
    text: scope ? `**${scope}:** ${description}` : description,
  };
}

function formatUrl(template, replacements) {
  return Object.entries(replacements).reduce(
    (value, [key, replacement]) => value.replaceAll(`{{${key}}}`, replacement),
    template
  );
}

function changelogSection({ version, previousTag, commits, config }) {
  const currentTag = `v${version}`;
  const compareUrl = previousTag
    ? formatUrl(config.compareUrlFormat, { previousTag, currentTag })
    : `${gitlabUrl}/-/tags/${currentTag}`;
  const groups = new Map();

  for (const commit of commits) {
    const parsed = sectionForCommit(commit, config.types);
    if (!parsed) {
      continue;
    }
    const shortHash = commit.hash.slice(0, 7);
    const commitUrl = formatUrl(config.commitUrlFormat, { hash: commit.hash });
    const entry = `* ${parsed.text} ([${shortHash}](${commitUrl}))`;
    if (!groups.has(parsed.section)) {
      groups.set(parsed.section, []);
    }
    groups.get(parsed.section).push(entry);
  }

  const lines = [`## [${version}](${compareUrl}) (${kstDate()})`, '', ''];

  if (groups.size === 0) {
    lines.push('_No notable user-facing changes._', '', '');
    return lines.join('\n');
  }

  for (const [section, entries] of groups) {
    lines.push(`### ${section}`, '', ...entries, '', '');
  }

  return lines.join('\n');
}

function updateChangelog(version, section) {
  const changelogPath = path.join(root, 'CHANGELOG.md');
  const existing = existsSync(changelogPath)
    ? readText('CHANGELOG.md')
    : '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';

  if (new RegExp(`^## \\[${version.replaceAll('.', '\\.')}\\]`, 'm').test(existing)) {
    throw new Error(`CHANGELOG.md already has a ${version} section`);
  }

  const firstReleaseIndex = existing.search(/\n## \[/);
  if (firstReleaseIndex === -1) {
    return `${existing.trimEnd()}\n\n${section}`;
  }

  const prefix = existing.slice(0, firstReleaseIndex + 1);
  const rest = existing.slice(firstReleaseIndex + 1);
  return `${prefix}${section}${rest}`;
}

function updatePackageFiles(version) {
  const files = [
    'package.json',
    'package-lock.json',
    'cloud-run/ai-engine/package.json',
    'cloud-run/ai-engine/package-lock.json',
  ];
  const changed = [];

  for (const file of files) {
    const value = maybeReadJson(file);
    if (!value) {
      continue;
    }

    value.version = version;
    if (value.packages?.['']) {
      value.packages[''].version = version;
    }

    writeJson(file, value);
    changed.push(file);
  }

  return changed;
}

function updateStatusSnapshot() {
  execFileSync(
    'node',
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      'node_modules/ts-node/dist/bin.js',
      'scripts/docs/update-status.ts',
      '--write',
    ],
    { cwd: root, stdio: 'inherit' }
  );
}

function printDryRun({ currentVersion, newVersion, releaseAs, previousTag, section }) {
  console.log('Release dry-run');
  console.log(`current: ${currentVersion}`);
  console.log(`next: ${newVersion}`);
  console.log(`release-as: ${releaseAs}`);
  console.log(`previous-tag: ${previousTag || '(none)'}`);
  console.log('');
  console.log(section.trimEnd());
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootPkg = readJson('package.json');
  const currentVersion = String(rootPkg.version || '').trim();
  if (!currentVersion) {
    throw new Error('package.json version is empty');
  }

  const previousTag = options.firstRelease ? '' : latestSemverTag();
  const commits = commitsSince(previousTag);
  const releaseAs =
    options.releaseAs || (options.firstRelease ? currentVersion : recommendedBump(commits));
  const newVersion = options.firstRelease
    ? currentVersion
    : bumpVersion(currentVersion, releaseAs);
  const tag = `v${newVersion}`;
  const config = loadReleaseConfig();
  const section = changelogSection({
    version: newVersion,
    previousTag,
    commits,
    config,
  });

  if (options.dryRun) {
    printDryRun({ currentVersion, newVersion, releaseAs, previousTag, section });
    return;
  }

  ensureCleanWorktree();
  if (git(['tag', '--list', tag]) === tag) {
    throw new Error(`Tag ${tag} already exists`);
  }

  const changed = updatePackageFiles(newVersion);
  writeText('CHANGELOG.md', updateChangelog(newVersion, section));
  changed.push('CHANGELOG.md');
  updateStatusSnapshot();
  changed.push('docs/status.md');

  git(['add', ...changed], { stdio: 'inherit' });
  git(['commit', '-m', `chore(release): ${newVersion}`], { stdio: 'inherit' });
  git(['tag', '-a', tag, '-m', `chore(release): ${newVersion}`], {
    stdio: 'inherit',
  });

  console.log(`Release commit and tag created: ${tag}`);
}

try {
  main();
} catch (error) {
  console.error(`release: ${error.message}`);
  process.exit(1);
}
