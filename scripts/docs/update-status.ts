#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STATUS_PATH = path.join(ROOT, 'docs/status.md');
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const QA_TRACKER_PATH = path.join(ROOT, 'reports/qa/qa-tracker.json');
const DEFAULT_RELEASE_COUNT = 5;

interface CliOptions {
  write: boolean;
  check: boolean;
  withQa: boolean;
  releaseCount: number;
}

interface PackageJson {
  version?: string;
}

interface ReleaseEntry {
  version: string;
  date: string;
  summary: string;
}

interface QaTrackerSummary {
  latestRecordedRunId?: string;
  lastRunId?: string;
  completionRate?: number;
  completedItems?: number;
  pendingItems?: number;
  wontFixItems?: number;
  expertDomainsOpenGaps?: number;
}

interface QaTracker {
  summary?: QaTrackerSummary;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    write: false,
    check: false,
    withQa: false,
    releaseCount: DEFAULT_RELEASE_COUNT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    if (arg === '--check') {
      options.check = true;
      continue;
    }

    if (arg === '--with-qa') {
      options.withQa = true;
      continue;
    }

    if (arg === '--releases') {
      const rawCount = argv[index + 1] || '';
      const parsed = Number.parseInt(rawCount, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
        throw new Error(`Invalid --releases value: ${rawCount || '(empty)'}`);
      }
      options.releaseCount = parsed;
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.write && options.check) {
    throw new Error('--write and --check cannot be used together');
  }

  return options;
}

function printHelp(): void {
  console.log(`Usage: update-status.ts [--write|--check] [--releases N] [--with-qa]

Updates the generated regions in docs/status.md from package.json and CHANGELOG.md.

Options:
  --write       Write docs/status.md. Without this flag, prints a preview.
  --check       Exit non-zero when docs/status.md is not up to date.
  --releases N  Number of recent CHANGELOG releases to include. Default: ${DEFAULT_RELEASE_COUNT}.
  --with-qa     Also update AUTO:qa-summary when that marker exists.
`);
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readText(filePath)) as T;
}

function kstDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function normalizeChangeText(value: string): string {
  return value
    .replace(/\s+\(\[[0-9a-f]{7,40}\]\([^)]+\)\)$/i, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+):\*\*/g, '$1:')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeChangelogSection(section: string): string {
  const changes: string[] = [];
  let category = '';

  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^###\s+(.+)$/);
    if (heading) {
      category = normalizeChangeText(heading[1] || '');
      continue;
    }

    if (/^_No notable user-facing changes\._$/i.test(line)) {
      changes.push('notable user-facing changes 없음');
      break;
    }

    const bullet = line.match(/^[*-]\s+(.+)$/);
    if (!bullet) continue;

    const text = normalizeChangeText(bullet[1] || '');
    if (!text) continue;
    changes.push(category ? `${category}: ${text}` : text);

    if (changes.length >= 3) break;
  }

  return changes.join('; ') || '릴리스 메타데이터 갱신';
}

function parseChangelog(content: string, releaseCount: number): ReleaseEntry[] {
  const headingPattern = /^##\s+\[(\d+\.\d+\.\d+)\](?:\([^)]+\))?\s+\((\d{4}-\d{2}-\d{2})\)\s*$/gm;
  const headings: Array<{
    version: string;
    date: string;
    index: number;
    bodyStart: number;
  }> = [];

  let match: RegExpExecArray | null = headingPattern.exec(content);
  while (match) {
    headings.push({
      version: match[1] || '',
      date: match[2] || '',
      index: match.index,
      bodyStart: headingPattern.lastIndex,
    });
    match = headingPattern.exec(content);
  }

  return headings.slice(0, releaseCount).map((heading, index) => {
    const nextHeading = headings[index + 1];
    const bodyEnd = nextHeading?.index ?? content.length;
    const body = content.slice(heading.bodyStart, bodyEnd);
    return {
      version: heading.version,
      date: heading.date,
      summary: summarizeChangelogSection(body),
    };
  });
}

function buildReleaseBlock(releases: ReleaseEntry[]): string {
  if (releases.length === 0) {
    throw new Error('CHANGELOG.md has no parseable release sections');
  }

  return releases
    .map((release) => `- **v${release.version}** (${release.date}) — ${release.summary}`)
    .join('\n');
}

function replaceLastReviewed(content: string, date: string): string {
  const pattern = /^> Last reviewed: .+$/m;
  if (!pattern.test(content)) {
    throw new Error('docs/status.md is missing Last reviewed metadata');
  }
  return content.replace(pattern, `> Last reviewed: ${date}`);
}

function replaceMarkedBlock(content: string, marker: string, body: string): string {
  const startMarker = `<!-- AUTO:${marker} -->`;
  const endMarker = `<!-- /AUTO:${marker} -->`;
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`docs/status.md is missing ${startMarker} / ${endMarker}`);
  }

  const before = content.slice(0, startIndex + startMarker.length);
  const after = content.slice(endIndex);
  return `${before}\n${body.trimEnd()}\n${after}`;
}

function buildQaBlock(): string {
  if (!fs.existsSync(QA_TRACKER_PATH)) {
    throw new Error('reports/qa/qa-tracker.json does not exist');
  }

  const tracker = readJson<QaTracker>(QA_TRACKER_PATH);
  const summary = tracker.summary || {};
  const latestRun = summary.latestRecordedRunId || summary.lastRunId || 'unknown';
  const completionRate =
    typeof summary.completionRate === 'number' ? summary.completionRate : 0;
  const completedItems =
    typeof summary.completedItems === 'number' ? summary.completedItems : 0;
  const pendingItems =
    typeof summary.pendingItems === 'number' ? summary.pendingItems : 0;
  const wontFixItems =
    typeof summary.wontFixItems === 'number' ? summary.wontFixItems : 0;
  const openGaps =
    typeof summary.expertDomainsOpenGaps === 'number'
      ? summary.expertDomainsOpenGaps
      : 0;

  return [
    `- latest run: ${latestRun}`,
    `- completion: ${completionRate}% (${completedItems} completed, ${pendingItems} pending, ${wontFixItems} wont-fix)`,
    `- expert open gaps: ${openGaps}`,
  ].join('\n');
}

function maybeReplaceQaBlock(content: string, withQa: boolean): string {
  if (!withQa) return content;

  const startMarker = '<!-- AUTO:qa-summary -->';
  if (!content.includes(startMarker)) {
    console.warn('docs/status.md has no AUTO:qa-summary marker; skipped QA summary update');
    return content;
  }

  return replaceMarkedBlock(content, 'qa-summary', buildQaBlock());
}

function buildNextStatus(content: string, options: CliOptions): string {
  const date = kstDate();
  const rootPackage = readJson<PackageJson>(PACKAGE_PATH);
  const version = String(rootPackage.version || '').trim();
  if (!version) {
    throw new Error('package.json version is empty');
  }

  const changelog = readText(CHANGELOG_PATH);
  const releases = parseChangelog(changelog, options.releaseCount);

  let next = replaceLastReviewed(content, date);
  next = replaceMarkedBlock(
    next,
    'version-header',
    `**상태 스냅샷 기준일**: ${date} | **현재 버전 스냅샷**: v${version}`
  );
  next = replaceMarkedBlock(next, 'releases', buildReleaseBlock(releases));
  next = maybeReplaceQaBlock(next, options.withQa);
  return next;
}

function printPreview(next: string, releaseCount: number): void {
  const date = kstDate();
  const rootPackage = readJson<PackageJson>(PACKAGE_PATH);
  const version = String(rootPackage.version || '').trim();
  const releases = parseChangelog(readText(CHANGELOG_PATH), releaseCount);

  console.log('docs/status.md update preview');
  console.log(`snapshot: ${date}`);
  console.log(`version: v${version}`);
  console.log('releases:');
  for (const release of releases) {
    console.log(`  - v${release.version} (${release.date})`);
  }
  console.log('');
  console.log('generated version block:');
  console.log(
    `**상태 스냅샷 기준일**: ${date} | **현재 버전 스냅샷**: v${version}`
  );
  console.log('');
  console.log('generated releases block:');
  console.log(next.match(/<!-- AUTO:releases -->\n([\s\S]*?)\n<!-- \/AUTO:releases -->/)?.[1] || '');
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const current = readText(STATUS_PATH);
  const next = buildNextStatus(current, options);

  if (current === next) {
    console.log('docs/status.md is already up to date');
    return;
  }

  if (options.check) {
    console.error('docs/status.md is not up to date. Run npm run docs:status:update.');
    process.exit(1);
  }

  if (options.write) {
    fs.writeFileSync(STATUS_PATH, next, 'utf8');
    console.log('updated docs/status.md');
    return;
  }

  printPreview(next, options.releaseCount);
  console.log('');
  console.log('dry-run only; pass --write to update docs/status.md');
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`update-status: ${message}`);
  process.exit(1);
}
