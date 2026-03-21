#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const QA_ROOT = path.resolve(process.cwd(), 'reports/qa');
const RUNS_ROOT = path.join(QA_ROOT, 'runs');
const TRACKER_PATH = path.join(QA_ROOT, 'qa-tracker.json');
const STATUS_PATH = path.join(QA_ROOT, 'QA_STATUS.md');
const BIOME_WRAPPER_PATH = path.resolve(__dirname, '../dev/biome-wrapper.sh');

const KNOWN_VERIFICATIONS = [
  { pattern: /^랜딩-페이지-v[\d.]+-로드/, baseId: 'landing-page-load-guest-login' },
  { pattern: /^대시보드-15서버-렌더링/, baseId: 'dashboard-15server-render' },
  { pattern: /^서버-모달-종합-상황-탭/, baseId: 'server-modal-overview-tab' },
  { pattern: /^서버-모달-성능-분석-탭/, baseId: 'server-modal-perf-tab' },
  { pattern: /^서버-모달-로그-네트워크-탭/, baseId: 'server-modal-log-network-tab' },
  { pattern: /^리소스-경고-top-5/, baseId: 'resource-warning-top5' },
  { pattern: /^상태-필터-온라인/, baseId: 'dashboard-status-filter-counts' },
  { pattern: /^세션-타이머-정상-카운트다운/, baseId: 'session-timer-countdown' },
  { pattern: /^시스템-리소스-요약/, baseId: 'system-resource-summary' },
  { pattern: /^시스템-시작.*리다이렉트/, baseId: 'system-start-dashboard-redirect' },
  { pattern: /^(esc-모달-닫기|모달-esc-닫기|ui-esc-close)/, baseId: 'modal-esc-close' },
  { pattern: /^(ai-사이드바|ai-sidebar-open|ai-chat-sidebar-open)/, baseId: 'ai-sidebar-toggle' },
  { pattern: /^(프로필-메뉴|profile-menu)/, baseId: 'profile-menu' },
  { pattern: /^서버-모달-3탭-전환/, baseId: 'server-modal-3tab-switch' },
  { pattern: /^프로덕션-대시보드-렌더링/, baseId: 'production-dashboard-render' },
];

const EXPERT_DOMAIN_CATALOG = [
  { id: 'ai-quality-assurance', name: 'AI Quality Assurance Specialist' },
  { id: 'observability-monitoring', name: 'IT Monitoring & Observability SME' },
  { id: 'ai-security-reliability', name: 'AI Security & Reliability Architect' },
  { id: 'sre-devops', name: 'DevOps / SRE Engineer' },
  { id: 'test-automation', name: 'Test Automation Architect' },
  { id: 'data-metrics-quality', name: 'Data Quality & Metrics Analyst' },
];

const RUN_SCOPE_VALUES = new Set(['smoke', 'targeted', 'broad', 'release-gate']);
const USAGE_RESULT_VALUES = new Set(['normal', 'concern', 'unknown']);
const COVERAGE_PACK_VALUES = new Set([
  'core-routes-smoke',
  'dashboard-core',
  'ai-core',
  'ai-advanced-surface',
  'modal-detail-pack',
  'security-pack',
  'observability-pack',
]);
const ARTIFACT_TYPE_VALUES = new Set([
  'playwright-trace',
  'playwright-report',
  'playwright-screenshot',
  'playwright-video',
  'playwright-console',
  'playwright-network',
]);
const LINK_TYPE_VALUES = new Set([
  'general',
  'vercel-deployment',
  'github-actions-run',
  'github-actions-artifact',
  'monitoring',
  'langfuse-trace',
]);
const REQUIRED_VERCEL_BROAD_COVERAGE_PACKS = [
  'core-routes-smoke',
  'dashboard-core',
  'ai-core',
];

function parseArgs(argv) {
  const args = {
    input: '',
  };

  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--input') {
      args.input = argv[index + 1] || '';
      index += 1;
      continue;
    }
  }

  return args;
}

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/qa/record-qa-run.js --input <qa-run-input.json>',
      '',
      'Example:',
      '  node scripts/qa/record-qa-run.js --input reports/qa/templates/qa-run-input.example.json',
    ].join('\n')
  );
}

function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON 읽기 실패: ${filePath}\n${error.message}`);
  }
}

function writeJsonFile(filePath, data) {
  const output = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(filePath, output, 'utf8');
}

function formatGeneratedFiles(filePaths) {
  const uniquePaths = Array.from(
    new Set(
      filePaths
        .filter(Boolean)
        .map((filePath) => path.resolve(filePath))
    )
  );

  if (uniquePaths.length === 0) {
    return;
  }

  const bashCmd = process.platform === 'win32' ? 'bash.exe' : 'bash';

  try {
    execFileSync(
      bashCmd,
      [BIOME_WRAPPER_PATH, 'format', '--write', ...uniquePaths],
      {
        stdio: 'ignore',
      }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Generated QA files written, but Biome format was skipped: ${reason}`);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toSeoulParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const parsed = {};
  for (const part of parts) {
    if (part.type === 'literal') continue;
    parsed[part.type] = part.value;
  }

  return {
    year: parsed.year,
    month: parsed.month,
    day: parsed.day,
    hour: parsed.hour,
    minute: parsed.minute,
    second: parsed.second,
  };
}

function nowInSeoulText(date) {
  const p = toSeoulParts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} KST`;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s._-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
}

function resolveStableId(slugifiedId, originalTitle) {
  for (const entry of KNOWN_VERIFICATIONS) {
    if (entry.pattern.test(slugifiedId)) {
      const parenMatch = originalTitle?.match(/\((.+)\)$/);
      const extractedEvidence = parenMatch ? parenMatch[1] : '';
      return { id: entry.baseId, extractedEvidence };
    }
  }
  return { id: slugifiedId, extractedEvidence: '' };
}

function toNonNegativeInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName}는 0 이상의 정수여야 합니다.`);
  }
  return number;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizePriority(rawValue) {
  const normalized = String(rawValue || 'P2')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  return /^P[0-5]$/.test(normalized) ? normalized : 'P2';
}

function hasOwnField(obj, field) {
  return Object.prototype.hasOwnProperty.call(obj, field);
}

function normalizeItem(rawItem, fallbackPrefix, index) {
  if (!rawItem) {
    throw new Error(`${fallbackPrefix}[${index}] 항목이 비어있습니다.`);
  }

  const item = typeof rawItem === 'string' ? { title: rawItem } : rawItem;
  const title = String(item.title || '').trim();
  if (!title) {
    throw new Error(`${fallbackPrefix}[${index}] title이 필요합니다.`);
  }

  const rawId = slugify(String(item.id || slugify(title)).trim());
  if (!rawId) {
    throw new Error(`${fallbackPrefix}[${index}] id 생성에 실패했습니다.`);
  }
  const { id: resolvedId, extractedEvidence } = resolveStableId(rawId, title);
  const id = resolvedId;

  const priority = normalizePriority(item.priority);
  const hasBlocking = hasOwnField(item, 'isBlocking');
  const blockingDefault = priority === 'P0' || priority === 'P1';
  const isBlocking = hasBlocking
    ? toBoolean(item.isBlocking, blockingDefault)
    : blockingDefault;

  const baseEvidence = item.evidence ? String(item.evidence) : '';
  const mergedEvidence = [baseEvidence, extractedEvidence].filter(Boolean).join('; ');

  return {
    id,
    title,
    priority,
    isBlocking,
    isBlockingExplicit: hasBlocking,
    overengineeringScope: item.overengineeringScope
      ? String(item.overengineeringScope)
      : '',
    evidence: mergedEvidence,
    note: item.note ? String(item.note) : '',
    owner: item.owner ? String(item.owner) : '',
    originalId: rawId !== id ? rawId : undefined,
  };
}

function normalizeDodCheck(rawItem, fallbackPrefix, index) {
  const item =
    typeof rawItem === 'string'
      ? { title: rawItem }
      : rawItem && typeof rawItem === 'object'
        ? rawItem
        : null;

  if (!item) {
    throw new Error(`${fallbackPrefix}[${index}] 항목이 비어있거나 객체가 아닙니다.`);
  }
  const title = String(item.title || '').trim();
  if (!title) {
    throw new Error(`${fallbackPrefix}[${index}] title이 필요합니다.`);
  }

  const rawId = slugify(String(item.id || slugify(title)).trim());
  if (!rawId) {
    throw new Error(`${fallbackPrefix}[${index}] id 생성에 실패했습니다.`);
  }
  const { id: resolvedId, extractedEvidence } = resolveStableId(rawId, title);
  const id = resolvedId;

  const statusRaw = String(item.status || 'pending').trim().toLowerCase();
  const status = statusRaw === 'completed' ? 'completed' : 'pending';

  const priority = normalizePriority(item.priority);
  const hasBlocking = hasOwnField(item, 'isBlocking');
  const blockingDefault = priority === 'P0' || priority === 'P1';
  const isBlocking = hasBlocking
    ? toBoolean(item.isBlocking, blockingDefault)
    : blockingDefault;

  const baseEvidence = item.evidence || item.evidencePath ? String(item.evidence || item.evidencePath) : '';
  const mergedEvidence = [baseEvidence, extractedEvidence].filter(Boolean).join('; ');

  return {
    id,
    title,
    priority,
    evidence: mergedEvidence,
    note: item.note ? String(item.note) : '',
    isBlocking,
    isBlockingExplicit: hasBlocking,
    overengineeringScope: item.overengineeringScope
      ? String(item.overengineeringScope)
      : '',
    owner: item.owner ? String(item.owner) : '',
    originalId: rawId !== id ? rawId : undefined,
    status,
  };
}

function normalizePendingPolicy(item, sourceStatus) {
  if (sourceStatus !== 'pending') {
    return {
      status: sourceStatus,
      policyNote: '',
    };
  }

  if (item.isBlocking) {
    return {
      status: 'pending',
      policyNote: '',
    };
  }

  return {
    status: 'pending',
    policyNote:
      '명시적인 reviewer 결정 전에는 pending 상태를 유지해 릴리즈 리스크를 숨기지 않습니다.',
  };
}

function normalizeDodChecks(rawDodChecks) {
  const source = Array.isArray(rawDodChecks) ? rawDodChecks : [];
  const flatten = [];

  source.forEach((groupItem, index) => {
    if (!groupItem || typeof groupItem !== 'object') return;

    const isGrouped = Array.isArray(groupItem.items);
    if (isGrouped) {
      const items = groupItem.items;
      for (const [itemIndex, item] of items.entries()) {
        flatten.push(normalizeDodCheck(item, `dodChecks[${index}].items`, itemIndex));
      }
      return;
    }

    flatten.push(normalizeDodCheck(groupItem, 'dodChecks', index));
  });

  return flatten;
}

function normalizeExpertAssessment(rawItem, index) {
  if (!rawItem || typeof rawItem !== 'object') {
    throw new Error(`expertAssessments[${index}] 항목이 비어있거나 객체가 아닙니다.`);
  }

  const domainId = slugify(rawItem.domainId || rawItem.id || '');
  if (!domainId) {
    throw new Error(`expertAssessments[${index}] domainId가 필요합니다.`);
  }

  const catalogMatch = EXPERT_DOMAIN_CATALOG.find((entry) => entry.id === domainId);
  const domainName = String(rawItem.domainName || rawItem.name || catalogMatch?.name || '').trim();
  if (!domainName) {
    throw new Error(`expertAssessments[${index}] domainName이 필요합니다.`);
  }

  const fitRaw = String(rawItem.fit || 'appropriate').trim().toLowerCase();
  const fit =
    fitRaw === 'appropriate' ||
    fitRaw === 'partially-appropriate' ||
    fitRaw === 'inappropriate'
      ? fitRaw
      : 'partially-appropriate';

  const improvementNeeded = toBoolean(
    rawItem.improvementNeeded,
    fit !== 'appropriate'
  );

  return {
    domainId,
    domainName,
    fit,
    improvementNeeded,
    rationale: rawItem.rationale ? String(rawItem.rationale) : '',
    nextAction: rawItem.nextAction ? String(rawItem.nextAction) : '',
  };
}

function normalizeUsageCheck(rawItem, index) {
  if (!rawItem || typeof rawItem !== 'object') {
    throw new Error(`usageChecks[${index}] 항목이 비어있거나 객체가 아닙니다.`);
  }

  const platform = String(rawItem.platform || '').trim().toLowerCase();
  if (!platform) {
    throw new Error(`usageChecks[${index}] platform이 필요합니다.`);
  }

  const method = String(rawItem.method || 'manual-dashboard').trim().toLowerCase();
  const statusRaw = String(rawItem.status || 'checked').trim().toLowerCase();
  const status = ['checked', 'skipped', 'failed'].includes(statusRaw)
    ? statusRaw
    : 'checked';
  const resultRaw = String(
    rawItem.result || (status === 'checked' ? 'unknown' : 'unknown')
  )
    .trim()
    .toLowerCase();
  const result = USAGE_RESULT_VALUES.has(resultRaw) ? resultRaw : 'unknown';

  return {
    platform,
    method,
    status,
    result,
    checkedAt: rawItem.checkedAt ? String(rawItem.checkedAt) : '',
    summary: rawItem.summary ? String(rawItem.summary) : '',
    evidence: rawItem.evidence ? String(rawItem.evidence) : '',
    url: rawItem.url ? String(rawItem.url) : '',
  };
}

function normalizeRunScope(rawValue, environment) {
  const normalized = String(rawValue || '')
    .trim()
    .toLowerCase();

  if (RUN_SCOPE_VALUES.has(normalized)) {
    return normalized;
  }

  // Backward-compatible default: historical production QA runs were typically broad.
  if (isVercelProductionEnvironment(environment)) {
    return 'broad';
  }

  return 'targeted';
}

function normalizeStringList(rawValue) {
  if (!Array.isArray(rawValue)) return [];

  const items = rawValue
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  return Array.from(new Set(items));
}

function readTrimmedEnvValue(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (!value) continue;
    const trimmed = String(value).trim();
    if (trimmed) return trimmed;
  }

  return '';
}

function readGitValue(args) {
  try {
    return execFileSync('git', args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

function buildHttpsUrl(hostname) {
  const normalized = String(hostname || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
}

function inferRuntimeEnvironmentFields() {
  const vercelTarget =
    readTrimmedEnvValue('VERCEL_TARGET_ENV') || readTrimmedEnvValue('VERCEL_ENV');
  const vercelDeploymentUrl = buildHttpsUrl(
    readTrimmedEnvValue('VERCEL_BRANCH_URL') || readTrimmedEnvValue('VERCEL_URL')
  );
  const vercelProductionUrl = buildHttpsUrl(
    readTrimmedEnvValue('VERCEL_PROJECT_PRODUCTION_URL')
  );
  const gitBranch =
    readTrimmedEnvValue('VERCEL_GIT_COMMIT_REF') ||
    readGitValue(['branch', '--show-current']);
  const gitCommitSha =
    readTrimmedEnvValue('VERCEL_GIT_COMMIT_SHA') || readGitValue(['rev-parse', 'HEAD']);

  return {
    target: vercelTarget ? `vercel-${vercelTarget}` : '',
    url:
      vercelTarget === 'production'
        ? vercelProductionUrl || vercelDeploymentUrl
        : vercelDeploymentUrl || vercelProductionUrl,
    branch: gitBranch,
    deploymentId: readTrimmedEnvValue('VERCEL_DEPLOYMENT_ID'),
    deploymentUrl: vercelDeploymentUrl,
    commitSha: gitCommitSha,
  };
}

function normalizeEnvironment(rawValue) {
  const source = rawValue && typeof rawValue === 'object' ? rawValue : {};
  const inferred = inferRuntimeEnvironmentFields();

  return {
    target: source.target ? String(source.target).trim() : inferred.target,
    url: source.url ? String(source.url).trim() : inferred.url,
    frontend: source.frontend ? String(source.frontend).trim() : '',
    backend: source.backend ? String(source.backend).trim() : '',
    branch: source.branch ? String(source.branch).trim() : inferred.branch,
    deploymentId: source.deploymentId
      ? String(source.deploymentId).trim()
      : inferred.deploymentId,
    deploymentUrl: source.deploymentUrl
      ? String(source.deploymentUrl).trim()
      : inferred.deploymentUrl,
    commitSha: source.commitSha ? String(source.commitSha).trim() : inferred.commitSha,
  };
}

function normalizeCoveragePacks(rawValue) {
  const items = normalizeStringList(rawValue).map((entry) => entry.toLowerCase());
  const invalid = items.filter((entry) => !COVERAGE_PACK_VALUES.has(entry));

  if (invalid.length > 0) {
    throw new Error(
      `coveragePacks 값이 올바르지 않습니다: ${invalid.join(', ')}. 허용 값: ${Array.from(COVERAGE_PACK_VALUES).join(', ')}`
    );
  }

  return Array.from(new Set(items));
}

function normalizeUrl(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  let parsed;
  try {
    parsed = new URL(text);
  } catch (error) {
    throw new Error(`${fieldName} URL이 올바르지 않습니다.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${fieldName} URL은 http 또는 https 여야 합니다.`);
  }

  return parsed.toString();
}

function buildPlaywrightTraceViewerUrl(traceUrl) {
  return `https://trace.playwright.dev/?trace=${encodeURIComponent(traceUrl)}`;
}

function inferGitHubRepository() {
  const repoEnv = readTrimmedEnvValue('GITHUB_REPOSITORY');
  if (/^[^/\s]+\/[^/\s]+$/.test(repoEnv)) {
    const [owner, repo] = repoEnv.split('/');
    return { owner, repo };
  }

  const remoteUrl = readGitValue(['config', '--get', 'remote.origin.url']);
  const match = remoteUrl.match(
    /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/
  );
  if (!match) {
    return { owner: '', repo: '' };
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

function buildGitHubActionsRunUrl(owner, repo, runId) {
  if (!owner || !repo || !runId) {
    return '';
  }

  return `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
}

function toPosixRelativePath(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

function collectFilesRecursively(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilesRecursively(fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function isRecentFile(filePath, cutoffMs) {
  const stats = fs.statSync(filePath);
  return stats.mtimeMs >= cutoffMs;
}

function normalizeOptionalDir(rawValue, fallbackValue) {
  if (rawValue === false) {
    return '';
  }

  if (rawValue == null) {
    return fallbackValue;
  }

  return String(rawValue).trim();
}

function normalizePlaywrightArtifactOptions(rawValue, source) {
  const sourceText = String(source || '').trim().toLowerCase();
  const shouldAutoDetectBySource = sourceText.includes('playwright');
  const defaults = {
    reportDir: 'playwright-report',
    resultsDir: 'test-results',
    screenshotsDir: '.playwright-mcp/screenshots',
    recentMinutes: 180,
    pathIncludes: [],
  };

  if (rawValue === false) {
    return null;
  }

  if (!rawValue || typeof rawValue !== 'object') {
    if (!shouldAutoDetectBySource) {
      return null;
    }

    return defaults;
  }

  return {
    reportDir: normalizeOptionalDir(rawValue.reportDir, defaults.reportDir),
    resultsDir: normalizeOptionalDir(rawValue.resultsDir, defaults.resultsDir),
    screenshotsDir: normalizeOptionalDir(
      rawValue.screenshotsDir,
      defaults.screenshotsDir
    ),
    recentMinutes:
      Number.isFinite(Number(rawValue.recentMinutes)) && Number(rawValue.recentMinutes) > 0
        ? Number(rawValue.recentMinutes)
        : defaults.recentMinutes,
    pathIncludes: normalizeStringList(rawValue.pathIncludes),
  };
}

function matchesArtifactPathIncludes(relativePath, pathIncludes) {
  if (!Array.isArray(pathIncludes) || pathIncludes.length === 0) {
    return true;
  }

  const normalizedPath = String(relativePath || '').trim().toLowerCase();
  if (!normalizedPath) {
    return false;
  }

  return pathIncludes.some((entry) =>
    normalizedPath.includes(String(entry || '').trim().toLowerCase())
  );
}

function detectPlaywrightArtifacts(options, now) {
  if (!options) {
    return [];
  }

  const cutoffMs = now.getTime() - options.recentMinutes * 60 * 1000;
  const artifacts = [];
  const reportIndexPath = options.reportDir
    ? path.resolve(process.cwd(), options.reportDir, 'index.html')
    : '';

  if (reportIndexPath && fs.existsSync(reportIndexPath) && isRecentFile(reportIndexPath, cutoffMs)) {
    artifacts.push({
      type: 'playwright-report',
      label: 'Playwright HTML report',
      path: toPosixRelativePath(reportIndexPath),
    });
  }

  if (options.resultsDir) {
    const resultsRoot = path.resolve(process.cwd(), options.resultsDir);
    for (const filePath of collectFilesRecursively(resultsRoot)) {
      if (!isRecentFile(filePath, cutoffMs)) {
        continue;
      }

      const ext = path.extname(filePath).toLowerCase();
      const relativePath = toPosixRelativePath(filePath);
      if (!matchesArtifactPathIncludes(relativePath, options.pathIncludes)) {
        continue;
      }

      if (path.basename(filePath) === 'trace.zip') {
        artifacts.push({
          type: 'playwright-trace',
          label: path.basename(path.dirname(filePath)) || 'Playwright trace',
          path: relativePath,
        });
        continue;
      }

      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        artifacts.push({
          type: 'playwright-screenshot',
          label: path.basename(filePath),
          path: relativePath,
        });
        continue;
      }

      if (['.webm', '.mp4'].includes(ext)) {
        artifacts.push({
          type: 'playwright-video',
          label: path.basename(filePath),
          path: relativePath,
        });
      }
    }
  }

  if (options.screenshotsDir) {
    const screenshotsRoot = path.resolve(process.cwd(), options.screenshotsDir);
    for (const filePath of collectFilesRecursively(screenshotsRoot)) {
      if (!isRecentFile(filePath, cutoffMs)) {
        continue;
      }

      const ext = path.extname(filePath).toLowerCase();
      if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
        continue;
      }

      const relativePath = toPosixRelativePath(filePath);
      if (!matchesArtifactPathIncludes(relativePath, options.pathIncludes)) {
        continue;
      }

      artifacts.push({
        type: 'playwright-screenshot',
        label: path.basename(filePath),
        path: relativePath,
      });
    }
  }

  return artifacts.sort((a, b) => {
    const aKey = `${a.type}|${a.path || a.url || ''}`;
    const bKey = `${b.type}|${b.path || b.url || ''}`;
    return aKey.localeCompare(bKey);
  });
}

function normalizeArtifacts(rawValue) {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue.map((rawArtifact, index) => {
    if (!rawArtifact || typeof rawArtifact !== 'object') {
      throw new Error(`artifacts[${index}] 항목이 비어있거나 객체가 아닙니다.`);
    }

    const type = String(rawArtifact.type || '')
      .trim()
      .toLowerCase();
    if (!ARTIFACT_TYPE_VALUES.has(type)) {
      throw new Error(
        `artifacts[${index}].type 값이 올바르지 않습니다: ${type || '(empty)'}. 허용 값: ${Array.from(ARTIFACT_TYPE_VALUES).join(', ')}`
      );
    }

    const label = String(rawArtifact.label || type).trim();
    const url = rawArtifact.url
      ? normalizeUrl(rawArtifact.url, `artifacts[${index}].url`)
      : '';
    const filePath = rawArtifact.path ? String(rawArtifact.path).trim() : '';

    if (!url && !filePath) {
      throw new Error(`artifacts[${index}]에는 url 또는 path가 필요합니다.`);
    }

    const normalizedArtifact = {
      type,
      label,
      ...(url ? { url } : {}),
      ...(filePath ? { path: filePath } : {}),
      ...(rawArtifact.note ? { note: String(rawArtifact.note) } : {}),
    };

    if (type === 'playwright-trace' && url) {
      normalizedArtifact.viewerUrl = buildPlaywrightTraceViewerUrl(url);
    }

    return normalizedArtifact;
  });
}

function mergeArtifacts(manualArtifacts, detectedArtifacts) {
  const merged = [];
  const seen = new Set();

  for (const artifact of [...manualArtifacts, ...detectedArtifacts]) {
    const key = `${artifact.type}|${artifact.url || ''}|${artifact.path || ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(artifact);
  }

  return merged;
}

function normalizeLinks(rawValue) {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue.map((rawLink, index) => {
    if (!rawLink || typeof rawLink !== 'object') {
      throw new Error(`links[${index}] 항목이 비어있거나 객체가 아닙니다.`);
    }

    const label = String(rawLink.label || '').trim();
    if (!label) {
      throw new Error(`links[${index}].label이 필요합니다.`);
    }

    const type = String(rawLink.type || 'general')
      .trim()
      .toLowerCase();
    if (!LINK_TYPE_VALUES.has(type)) {
      throw new Error(
        `links[${index}].type 값이 올바르지 않습니다: ${type || '(empty)'}. 허용 값: ${Array.from(LINK_TYPE_VALUES).join(', ')}`
      );
    }

    return {
      type,
      label,
      url: normalizeUrl(rawLink.url, `links[${index}].url`),
      ...(rawLink.note ? { note: String(rawLink.note).trim() } : {}),
    };
  });
}

function normalizeCiEvidence(rawValue) {
  if (!rawValue) {
    return [];
  }

  if (typeof rawValue !== 'object') {
    throw new Error('ciEvidence는 객체여야 합니다.');
  }

  const provider = String(rawValue.provider || 'github-actions')
    .trim()
    .toLowerCase();
  if (provider !== 'github-actions') {
    throw new Error('ciEvidence.provider는 github-actions만 지원합니다.');
  }

  const runId = String(rawValue.runId || '').trim();
  if (!/^\d+$/.test(runId)) {
    throw new Error('ciEvidence.runId는 숫자 문자열이어야 합니다.');
  }

  const inferredRepo = inferGitHubRepository();
  const owner = String(rawValue.owner || inferredRepo.owner || '').trim();
  const repo = String(rawValue.repo || inferredRepo.repo || '').trim();
  const runUrl = rawValue.runUrl
    ? normalizeUrl(rawValue.runUrl, 'ciEvidence.runUrl')
    : buildGitHubActionsRunUrl(owner, repo, runId);

  if (!runUrl) {
    throw new Error(
      'ciEvidence.runUrl이 없으면 ciEvidence.owner/repo 또는 git origin/GITHUB_REPOSITORY에서 저장소를 추론할 수 있어야 합니다.'
    );
  }

  const workflowName = String(rawValue.workflowName || 'GitHub Actions').trim();
  const branch = String(rawValue.branch || '').trim();
  const commitSha = String(rawValue.commitSha || '').trim();
  const runLinkNote = [branch ? `branch=${branch}` : '', commitSha ? `sha=${commitSha}` : '']
    .filter(Boolean)
    .join(', ');

  const links = [
    {
      type: 'github-actions-run',
      label: `GitHub Actions: ${workflowName} #${runId}`,
      url: runUrl,
      ...(runLinkNote ? { note: runLinkNote } : {}),
    },
  ];

  const ciArtifacts = Array.isArray(rawValue.artifacts) ? rawValue.artifacts : [];
  ciArtifacts.forEach((rawArtifact, index) => {
    const artifact =
      typeof rawArtifact === 'string' ? { name: rawArtifact } : rawArtifact;

    if (!artifact || typeof artifact !== 'object') {
      throw new Error(`ciEvidence.artifacts[${index}] 항목이 비어있거나 객체가 아닙니다.`);
    }

    const name = String(artifact.name || '').trim();
    if (!name) {
      throw new Error(`ciEvidence.artifacts[${index}].name이 필요합니다.`);
    }

    const artifactUrl = artifact.url
      ? normalizeUrl(artifact.url, `ciEvidence.artifacts[${index}].url`)
      : runUrl;
    const artifactNote = artifact.url
      ? String(artifact.note || '').trim()
      : [
          `artifact=${name}`,
          'download/open from the workflow run page',
          artifact.note ? String(artifact.note).trim() : '',
        ]
          .filter(Boolean)
          .join('; ');

    links.push({
      type: 'github-actions-artifact',
      label: String(artifact.label || `GitHub Artifact: ${name}`).trim(),
      url: artifactUrl,
      ...(artifactNote ? { note: artifactNote } : {}),
    });
  });

  return links;
}

function mergeLinks(manualLinks, detectedLinks) {
  const merged = [];
  const seen = new Set();

  for (const link of [...manualLinks, ...detectedLinks]) {
    const key = `${link.type}|${link.label}|${link.url}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(link);
  }

  return merged.sort((a, b) => {
    const aKey = `${a.type}|${a.label}|${a.url}`;
    const bKey = `${b.type}|${b.label}|${b.url}`;
    return aKey.localeCompare(bKey);
  });
}

function isVercelProductionEnvironment(environment) {
  if (!environment || typeof environment !== 'object') return false;

  const target = String(environment.target || '').trim().toLowerCase();
  const url = String(environment.url || '').trim().toLowerCase();

  return (
    target === 'vercel-production' ||
    url.includes('.vercel.app') ||
    url.includes('vercel.com')
  );
}

function inferReleaseFacing(rawValue, environment, scope) {
  if (rawValue !== undefined) {
    return toBoolean(rawValue, false);
  }

  if (!isVercelProductionEnvironment(environment)) {
    return false;
  }

  return scope === 'broad' || scope === 'release-gate';
}

function requiresVercelUsageCheck(environment, scope, releaseFacing) {
  if (!isVercelProductionEnvironment(environment)) {
    return false;
  }

  return releaseFacing || scope === 'broad' || scope === 'release-gate';
}

function requiresExpertAssessments(environment, scope, releaseFacing) {
  return requiresVercelUsageCheck(environment, scope, releaseFacing);
}

function requiresStructuredDeploymentEvidence(environment, scope, releaseFacing) {
  if (!isVercelProductionEnvironment(environment)) {
    return false;
  }

  return releaseFacing || scope === 'broad' || scope === 'release-gate';
}

function requiresBroadCoveragePacks(environment, scope) {
  if (!isVercelProductionEnvironment(environment)) {
    return false;
  }

  return scope === 'broad' || scope === 'release-gate';
}

function initializeTracker(nowIso) {
  return {
    version: '1.0.0',
    meta: {
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    sequence: {
      nextRunNumber: 1,
    },
    summary: {
      totalRuns: 0,
      totalChecks: 0,
      totalPassed: 0,
      totalFailed: 0,
      completionRate: 0,
      completedItems: 0,
      pendingItems: 0,
      wontFixItems: 0,
      expertDomainsTracked: 0,
      expertDomainsOpenGaps: 0,
      lastRunId: null,
      lastRecordedAt: null,
    },
    items: {},
    experts: {},
    runs: [],
  };
}

function loadTracker(nowIso) {
  if (!fs.existsSync(TRACKER_PATH)) {
    return initializeTracker(nowIso);
  }

  const tracker = readJsonFile(TRACKER_PATH);
  if (!tracker || typeof tracker !== 'object') {
    throw new Error('qa-tracker.json 형식이 올바르지 않습니다.');
  }
  tracker.items = tracker.items || {};
  tracker.runs = tracker.runs || [];
  tracker.sequence = tracker.sequence || { nextRunNumber: tracker.runs.length + 1 };
  tracker.meta = tracker.meta || { createdAt: nowIso, updatedAt: nowIso };
  tracker.summary = tracker.summary || initializeTracker(nowIso).summary;
  tracker.experts = tracker.experts || {};
  return tracker;
}

function upsertTrackerItem({
  tracker,
  runId,
  recordedAt,
  normalizedItem,
  status,
}) {
  const existing = tracker.items[normalizedItem.id];
  const next = existing
    ? { ...existing }
    : {
        id: normalizedItem.id,
        title: normalizedItem.title,
        priority: normalizedItem.priority,
        status,
        firstSeenRunId: runId,
        firstSeenAt: recordedAt,
        lastSeenRunId: runId,
        lastSeenAt: recordedAt,
        seenCount: 0,
        completedCount: 0,
        pendingCount: 0,
        deferredCount: 0,
        wontFixCount: 0,
        aliases: [],
        owner: normalizedItem.owner || '',
        lastEvidence: '',
        lastNote: '',
        isBlocking: false,
        isBlockingExplicit: false,
        overengineeringScope: '',
        lastPolicyNote: '',
      };

  if (!next.aliases) next.aliases = [];
  if (!next.deferredCount) next.deferredCount = 0;

  if (normalizedItem.originalId && !next.aliases.includes(normalizedItem.originalId)) {
    next.aliases.push(normalizedItem.originalId);
  }

  next.title = normalizedItem.title;
  next.priority = normalizedItem.priority || next.priority || 'P2';
  if (normalizedItem.owner) next.owner = normalizedItem.owner;
  next.lastSeenRunId = runId;
  next.lastSeenAt = recordedAt;
  next.seenCount += 1;
  next.status = status;
  if (status === 'completed') next.completedCount += 1;
  if (status === 'pending') next.pendingCount += 1;
  if (status === 'deferred') next.deferredCount += 1;
  if (status === 'wont-fix') next.wontFixCount += 1;
  if (normalizedItem.evidence) next.lastEvidence = normalizedItem.evidence;
  if (normalizedItem.note) next.lastNote = normalizedItem.note;
  next.isBlocking =
    normalizedItem.isBlocking === true
      ? true
      : normalizedItem.isBlocking === false
        ? false
        : next.isBlocking || false;
  next.isBlockingExplicit = normalizedItem.isBlockingExplicit === true;
  if (normalizedItem.overengineeringScope) {
    next.overengineeringScope = normalizedItem.overengineeringScope;
  }
  next.lastPolicyNote = normalizedItem.policyNote || '';
  next.lastStatusChangeAt = recordedAt;

  tracker.items[normalizedItem.id] = next;
}

function upsertTrackerExpert({
  tracker,
  runId,
  recordedAt,
  assessment,
}) {
  const existing = tracker.experts[assessment.domainId];
  const next = existing
    ? { ...existing }
    : {
        domainId: assessment.domainId,
        domainName: assessment.domainName,
        firstSeenRunId: runId,
        firstSeenAt: recordedAt,
        seenCount: 0,
        appropriateCount: 0,
        partialCount: 0,
        inappropriateCount: 0,
        improvementNeededCount: 0,
      };

  next.domainName = assessment.domainName;
  next.seenCount += 1;
  next.lastRunId = runId;
  next.lastSeenAt = recordedAt;
  next.lastFit = assessment.fit;
  next.lastImprovementNeeded = assessment.improvementNeeded;
  next.lastRationale = assessment.rationale;
  next.lastNextAction = assessment.nextAction;

  if (assessment.fit === 'appropriate') next.appropriateCount += 1;
  if (assessment.fit === 'partially-appropriate') next.partialCount += 1;
  if (assessment.fit === 'inappropriate') next.inappropriateCount += 1;
  if (assessment.improvementNeeded) next.improvementNeededCount += 1;

  tracker.experts[assessment.domainId] = next;
}

function recalculateSummary(tracker) {
  const totalRuns = tracker.runs.length;
  const totalChecks = tracker.runs.reduce(
    (sum, run) => sum + (run.checks?.total || 0),
    0
  );
  const totalPassed = tracker.runs.reduce(
    (sum, run) => sum + (run.checks?.passed || 0),
    0
  );
  const totalFailed = tracker.runs.reduce(
    (sum, run) => sum + (run.checks?.failed || 0),
    0
  );

  const itemList = Object.values(tracker.items);
  const completedItems = itemList.filter((item) => item.status === 'completed').length;
  const pendingItems = itemList.filter((item) => item.status === 'pending').length;
  const deferredItems = itemList.filter((item) => item.status === 'deferred').length;
  const wontFixItems = itemList.filter((item) => item.status === 'wont-fix').length;
  const completionRateBase = completedItems + pendingItems + deferredItems;
  const completionRate =
    completionRateBase === 0
      ? 0
      : Number(((completedItems / completionRateBase) * 100).toFixed(2));

  const expertList = Object.values(tracker.experts || {});
  const expertDomainsTracked = expertList.length;
  const expertDomainsOpenGaps = expertList.filter(
    (expert) => expert.lastImprovementNeeded
  ).length;

  const lastRun = tracker.runs[tracker.runs.length - 1] || null;
  tracker.summary = {
    totalRuns,
    totalChecks,
    totalPassed,
    totalFailed,
    completionRate,
    completedItems,
    pendingItems,
    deferredItems,
    wontFixItems,
    expertDomainsTracked,
    expertDomainsOpenGaps,
    lastRunId: lastRun ? lastRun.runId : null,
    lastRecordedAt: lastRun ? lastRun.recordedAt : null,
  };
}

function statusMarkdown(tracker) {
  const lines = [];
  const generatedAt = nowInSeoulText(new Date());
  const itemList = Object.values(tracker.items);
  const completed = itemList
    .filter((item) => item.status === 'completed')
    .sort((a, b) => a.id.localeCompare(b.id));
  const pending = itemList
    .filter((item) => item.status === 'pending')
    .sort((a, b) => {
      if (a.priority === b.priority) return a.id.localeCompare(b.id);
      return a.priority.localeCompare(b.priority);
    });
  const deferred = itemList
    .filter((item) => item.status === 'deferred')
    .sort((a, b) => {
      if (a.priority === b.priority) return a.id.localeCompare(b.id);
      return a.priority.localeCompare(b.priority);
    });
  const wontFix = itemList
    .filter((item) => item.status === 'wont-fix')
    .sort((a, b) => {
      if (a.priority === b.priority) return a.id.localeCompare(b.id);
      return a.priority.localeCompare(b.priority);
    });
  const recentRuns = tracker.runs.slice(-20).reverse();
  const expertList = Object.values(tracker.experts || {}).sort((a, b) =>
    a.domainId.localeCompare(b.domainId)
  );
  const latestRun = tracker.runs[tracker.runs.length - 1] || null;
  const latestRunExperts = latestRun?.expertAssessments || [];
  const latestRunUsageChecks = latestRun?.usageChecks || [];
  const latestRunScope = latestRun?.scope || 'legacy';
  const latestRunReleaseFacing = latestRun?.releaseFacing === true;
  const latestRunCoveragePacks = latestRun?.coveragePacks || [];
  const latestRunCoveredSurfaces = latestRun?.coveredSurfaces || [];
  const latestRunSkippedSurfaces = latestRun?.skippedSurfaces || [];
  const latestRunLinks = latestRun?.links || [];
  const latestRunArtifacts = latestRun?.artifacts || [];
  const latestRunEnvironment =
    latestRun && typeof latestRun.environment === 'object' ? latestRun.environment : {};

  lines.push('# QA Status Dashboard');
  lines.push('');
  lines.push('> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.');
  lines.push(`> Generated at: ${generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  lines.push(`| Total Runs | ${tracker.summary.totalRuns} |`);
  lines.push(`| Total Checks | ${tracker.summary.totalChecks} |`);
  lines.push(`| Passed | ${tracker.summary.totalPassed} |`);
  lines.push(`| Failed | ${tracker.summary.totalFailed} |`);
  lines.push(`| Completed Items | ${tracker.summary.completedItems} |`);
  lines.push(`| Pending Items | ${tracker.summary.pendingItems} |`);
  lines.push(`| Deferred Items | ${tracker.summary.deferredItems || deferred.length} |`);
  lines.push(`| Wont-Fix Items | ${tracker.summary.wontFixItems || wontFix.length} |`);
  lines.push(`| Expert Domains Tracked | ${tracker.summary.expertDomainsTracked || 0} |`);
  lines.push(`| Expert Open Gaps | ${tracker.summary.expertDomainsOpenGaps || 0} |`);
  lines.push(`| Completion Rate | ${tracker.summary.completionRate}% |`);
  lines.push(
    `| Last Run | ${tracker.summary.lastRunId || '-'} (${tracker.summary.lastRecordedAt || '-'}) |`
  );
  lines.push('');
  lines.push('## Expert Domain Assessment (Latest Run)');
  lines.push('');
  lines.push(
    `Latest run: ${latestRun ? `${latestRun.runId} (${latestRun.recordedAt})` : '-'}`
  );
  lines.push('');
  lines.push('| Domain | Fit | Improvement Needed | Next Action |');
  lines.push('|---|---|---|---|');
  if (latestRunExperts.length === 0) {
    lines.push('| - | - | - | - |');
  } else {
    for (const expert of latestRunExperts) {
      lines.push(
        `| ${expert.domainName} | ${expert.fit} | ${expert.improvementNeeded ? 'yes' : 'no'} | ${expert.nextAction || '-'} |`
      );
    }
  }
  lines.push('');
  lines.push('## Usage Checks (Latest Run)');
  lines.push('');
  lines.push('| Platform | Method | Collection | Result | Summary |');
  lines.push('|---|---|---|---|---|');
  if (latestRunUsageChecks.length === 0) {
    lines.push('| - | - | - | - | - |');
  } else {
    for (const usageCheck of latestRunUsageChecks) {
      lines.push(
        `| ${usageCheck.platform} | ${usageCheck.method} | ${usageCheck.status} | ${usageCheck.result || 'unknown'} | ${usageCheck.summary || '-'} |`
      );
    }
  }
  lines.push('');
  lines.push('## Coverage (Latest Run)');
  lines.push('');
  lines.push(`- Scope: ${latestRunScope}`);
  lines.push(`- Release-Facing: ${latestRunReleaseFacing ? 'yes' : 'no'}`);
  if (latestRunEnvironment.deploymentId || latestRunEnvironment.commitSha) {
    const deploymentParts = [];
    if (latestRunEnvironment.deploymentId) {
      deploymentParts.push(latestRunEnvironment.deploymentId);
    }
    if (latestRunEnvironment.commitSha) {
      deploymentParts.push(`SHA ${latestRunEnvironment.commitSha.slice(0, 8)}`);
    }
    lines.push(`- Deployment: ${deploymentParts.join(' / ')}`);
  }
  if (latestRunCoveragePacks.length > 0) {
    lines.push(`- Coverage Packs: ${latestRunCoveragePacks.join(', ')}`);
  }
  lines.push(
    `- Covered Surfaces: ${latestRunCoveredSurfaces.length > 0 ? latestRunCoveredSurfaces.join(', ') : '-'}`
  );
  lines.push(
    `- Skipped Surfaces: ${latestRunSkippedSurfaces.length > 0 ? latestRunSkippedSurfaces.join(', ') : '-'}`
  );
  lines.push('');
  lines.push('## Links (Latest Run)');
  lines.push('');
  lines.push('| Type | Label | URL | Note |');
  lines.push('|---|---|---|---|');
  if (latestRunLinks.length === 0) {
    lines.push('| - | - | - | - |');
  } else {
    for (const link of latestRunLinks) {
      lines.push(
        `| ${link.type || 'general'} | ${link.label || '-'} | [link](${link.url}) | ${link.note || '-'} |`
      );
    }
  }
  lines.push('');
  lines.push('## Artifacts (Latest Run)');
  lines.push('');
  lines.push('| Type | Label | Location | Viewer |');
  lines.push('|---|---|---|---|');
  if (latestRunArtifacts.length === 0) {
    lines.push('| - | - | - | - |');
  } else {
    for (const artifact of latestRunArtifacts) {
      const location = artifact.url
        ? `[link](${artifact.url})`
        : artifact.path
          ? `\`${artifact.path}\``
          : '-';
      const viewer = artifact.viewerUrl ? `[trace viewer](${artifact.viewerUrl})` : '-';
      lines.push(`| ${artifact.type} | ${artifact.label || '-'} | ${location} | ${viewer} |`);
    }
  }
  lines.push('');
  lines.push('## Expert Domain Open Gaps');
  lines.push('');
  const openExpertGaps = expertList.filter((expert) => expert.lastImprovementNeeded);
  if (openExpertGaps.length === 0) {
    lines.push('- None');
  } else {
    for (const expert of openExpertGaps) {
      lines.push(
        `- ${expert.domainId}: ${expert.domainName} (last ${expert.lastRunId})`
      );
      if (expert.lastNextAction) {
        lines.push(`  next: ${expert.lastNextAction}`);
      }
    }
  }
  lines.push('');
  lines.push('## Pending Improvements');
  lines.push('');
  if (pending.length === 0) {
    lines.push('- None');
  } else {
    for (const item of pending) {
      lines.push(
        `- [${item.priority}] ${item.id}: ${item.title} (seen ${item.seenCount}회, last ${item.lastSeenRunId})`
      );
    }
  }
  lines.push('');
  lines.push('## Deferred Improvements');
  lines.push('');
  if (deferred.length === 0) {
    lines.push('- None');
  } else {
    for (const item of deferred) {
      lines.push(
        `- [${item.priority}] ${item.id}: ${item.title} (seen ${item.seenCount}회, last ${item.lastSeenRunId})`
      );
      if (item.lastPolicyNote) {
        lines.push(`  - note: ${item.lastPolicyNote}`);
      }
    }
  }
  lines.push('');
  lines.push('## Wont-Fix Improvements');
  lines.push('');
  if (wontFix.length === 0) {
    lines.push('- None');
  } else {
    for (const item of wontFix) {
      lines.push(
        `- [${item.priority}] ${item.id}: ${item.title} (seen ${item.seenCount}회, last ${item.lastSeenRunId})`
      );
      if (item.lastPolicyNote) {
        lines.push(`  - note: ${item.lastPolicyNote}`);
      }
    }
  }
  lines.push('');
  lines.push('## Completed Improvements');
  lines.push('');
  if (completed.length === 0) {
    lines.push('- None');
  } else {
    for (const item of completed) {
      lines.push(
        `- ${item.id}: ${item.title} (completed ${item.completedCount}회, last ${item.lastSeenRunId})`
      );
    }
  }
  lines.push('');
  lines.push('## Recent Runs');
  lines.push('');
  lines.push('| Run ID | Time (UTC) | Scope | Release-Facing | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |');
  lines.push('|---|---|---|---|---|---:|---:|---:|---:|---:|---:|');
  if (recentRuns.length === 0) {
    lines.push('| - | - | - | - | - | 0 | 0 | 0 | 0 | 0 | 0 |');
  } else {
    for (const run of recentRuns) {
      lines.push(
        `| ${run.runId} | ${run.recordedAt} | ${run.scope || 'legacy'} | ${run.releaseFacing ? 'yes' : 'no'} | ${run.title} | ${run.checks.total} | ${run.completedCount} | ${run.pendingCount || 0} | ${run.deferredCount || 0} | ${run.wontFixCount || 0} | ${run.expertNeedsImprovementCount || 0} |`
      );
    }
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function run() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    usage();
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  const payload = readJsonFile(inputPath);
  const now = new Date();
  const nowIso = now.toISOString();
  const source = payload.source ? String(payload.source).trim() : '';
  const environment = normalizeEnvironment(payload.environment);
  const scope = normalizeRunScope(payload.scope, environment);
  const releaseFacing = inferReleaseFacing(payload.releaseFacing, environment, scope);
  const coveredSurfaces = normalizeStringList(payload.coveredSurfaces);
  const skippedSurfaces = normalizeStringList(payload.skippedSurfaces);
  const coveragePacks = normalizeCoveragePacks(payload.coveragePacks);
  const playwrightArtifactOptions = normalizePlaywrightArtifactOptions(
    payload.playwrightArtifacts,
    source
  );
  const artifacts = mergeArtifacts(
    normalizeArtifacts(payload.artifacts),
    detectPlaywrightArtifacts(playwrightArtifactOptions, now)
  );
  const links = mergeLinks(
    normalizeLinks(payload.links),
    normalizeCiEvidence(payload.ciEvidence)
  );

  const runTitle = String(payload.runTitle || '').trim();
  const owner = String(payload.owner || '').trim();
  if (!runTitle) throw new Error('runTitle은 필수입니다.');
  if (!owner) throw new Error('owner는 필수입니다.');

  const checks = payload.checks || {};
  const passed = toNonNegativeInteger(checks.passed || 0, 'checks.passed');
  const failed = toNonNegativeInteger(checks.failed || 0, 'checks.failed');
  const total = toNonNegativeInteger(
    checks.total != null ? checks.total : passed + failed,
    'checks.total'
  );
  if (passed + failed > total) {
    throw new Error('checks.passed + checks.failed 는 checks.total 보다 클 수 없습니다.');
  }

  const completedRaw = Array.isArray(payload.completedImprovements)
    ? payload.completedImprovements
    : [];
  const pendingRaw = Array.isArray(payload.pendingImprovements)
    ? payload.pendingImprovements
    : [];
  const dodChecksRaw = Array.isArray(payload.dodChecks)
    ? payload.dodChecks
    : [];

  const completedImprovements = completedRaw.map((item, index) =>
    normalizeItem(item, 'completedImprovements', index)
  );
  const pendingImprovements = pendingRaw.map((item, index) =>
    normalizeItem(item, 'pendingImprovements', index)
  );
  const dodChecks = normalizeDodChecks(dodChecksRaw);
  const expertAssessmentsRaw = Array.isArray(payload.expertAssessments)
    ? payload.expertAssessments
    : [];
  const expertAssessments = expertAssessmentsRaw.map((item, index) =>
    normalizeExpertAssessment(item, index)
  );
  const usageChecksRaw = Array.isArray(payload.usageChecks) ? payload.usageChecks : [];
  const usageChecks = usageChecksRaw.map((item, index) =>
    normalizeUsageCheck(item, index)
  );
  const requiresUsageEvidence = requiresVercelUsageCheck(
    environment,
    scope,
    releaseFacing
  );
  const hasVercelUsageCheck = usageChecks.some((item) => item.platform === 'vercel');

  if (requiresUsageEvidence && !hasVercelUsageCheck) {
    throw new Error(
      'Vercel production broad/release-facing run에는 usageChecks에 platform="vercel" 항목이 최소 1건 필요합니다. npm run check:usage:vercel 또는 수동 대시보드 확인 결과를 기록하세요.'
    );
  }

  if (requiresExpertAssessments(environment, scope, releaseFacing) && expertAssessments.length === 0) {
    throw new Error(
      'Vercel production broad/release-facing run에는 expertAssessments가 최소 1건 필요합니다.'
    );
  }

  if (requiresStructuredDeploymentEvidence(environment, scope, releaseFacing)) {
    if (!environment.commitSha) {
      throw new Error(
        'Vercel production broad/release-facing run에는 environment.commitSha가 필요합니다.'
      );
    }

    if (!environment.deploymentId) {
      throw new Error(
        'Vercel production broad/release-facing run에는 environment.deploymentId가 필요합니다.'
      );
    }
  }

  if (requiresBroadCoveragePacks(environment, scope)) {
    const missingCoveragePacks = REQUIRED_VERCEL_BROAD_COVERAGE_PACKS.filter(
      (pack) => !coveragePacks.includes(pack)
    );

    if (missingCoveragePacks.length > 0) {
      throw new Error(
        `Vercel production broad/release-gate run에는 coveragePacks에 ${missingCoveragePacks.join(', ')} 가 필요합니다.`
      );
    }
  }

  const finalItemMap = new Map();
  const addItem = (item, sourceStatus) => {
    const { status, policyNote } = normalizePendingPolicy(item, sourceStatus);
    const normalizedItem = { ...item, status, policyNote };
    const priorityMap = {
      completed: 3,
      pending: 2,
      deferred: 1,
      'wont-fix': 0,
    };
    const existing = finalItemMap.get(item.id);
    const existingPriority = existing ? priorityMap[existing.status] : -1;
    const incomingPriority = priorityMap[status];

    if (existing && existingPriority >= incomingPriority) {
      return;
    }
    finalItemMap.set(item.id, normalizedItem);
  };

  for (const item of completedImprovements) {
    addItem(item, 'completed');
  }
  for (const item of pendingImprovements) {
    addItem(item, 'pending');
  }
  for (const item of dodChecks) {
    addItem(item, item.status);
  }

  const finalCompletedImprovements = [];
  const finalPendingImprovements = [];
  const finalDeferredImprovements = [];
  const finalWontFixImprovements = [];
  for (const item of finalItemMap.values()) {
    if (item.status === 'completed') {
      finalCompletedImprovements.push(item);
    } else if (item.status === 'pending') {
      finalPendingImprovements.push(item);
    } else if (item.status === 'deferred') {
      finalDeferredImprovements.push(item);
    } else {
      finalWontFixImprovements.push(item);
    }
  }

  ensureDir(QA_ROOT);
  ensureDir(RUNS_ROOT);

  const tracker = loadTracker(nowIso);
  const runNumber = Number(tracker.sequence.nextRunNumber || tracker.runs.length + 1);
  const p = toSeoulParts(now);
  const dateStamp = `${p.year}${p.month}${p.day}`;
  const runId = `QA-${dateStamp}-${String(runNumber).padStart(4, '0')}`;
  const runYearDir = path.join(RUNS_ROOT, p.year);
  ensureDir(runYearDir);

  const runFileName = `qa-run-${runId}.json`;
  const runFilePath = path.join(runYearDir, runFileName);
  const runFileRelative = path
    .relative(process.cwd(), runFilePath)
    .split(path.sep)
    .join('/');

  const runRecord = {
    runId,
    recordedAt: nowIso,
    recordedAtKst: nowInSeoulText(now),
    runTitle,
    owner,
    source,
    environment,
    scope,
    releaseFacing,
    coveragePacks,
    coveredSurfaces,
    skippedSurfaces,
    checks: {
      total,
      passed,
      failed,
    },
    expertAssessments,
    usageChecks,
    artifacts,
    completedImprovements: finalCompletedImprovements,
    pendingImprovements: finalPendingImprovements,
    deferredImprovements: finalDeferredImprovements,
    wontFixImprovements: finalWontFixImprovements,
    notes: Array.isArray(payload.notes) ? payload.notes.map(String) : [],
    links,
  };

  writeJsonFile(runFilePath, runRecord);

  for (const completedItem of finalCompletedImprovements) {
    upsertTrackerItem({
      tracker,
      runId,
      recordedAt: nowIso,
      normalizedItem: completedItem,
      status: 'completed',
    });
  }
  for (const pendingItem of finalPendingImprovements) {
    upsertTrackerItem({
      tracker,
      runId,
      recordedAt: nowIso,
      normalizedItem: pendingItem,
      status: 'pending',
    });
  }
  for (const deferredItem of finalDeferredImprovements) {
    upsertTrackerItem({
      tracker,
      runId,
      recordedAt: nowIso,
      normalizedItem: deferredItem,
      status: 'deferred',
    });
  }
  for (const wontFixItem of finalWontFixImprovements) {
    upsertTrackerItem({
      tracker,
      runId,
      recordedAt: nowIso,
      normalizedItem: wontFixItem,
      status: 'wont-fix',
    });
  }
  for (const expertAssessment of expertAssessments) {
    upsertTrackerExpert({
      tracker,
      runId,
      recordedAt: nowIso,
      assessment: expertAssessment,
    });
  }

  const expertNeedsImprovementCount = expertAssessments.filter(
    (entry) => entry.improvementNeeded
  ).length;

  tracker.runs.push({
    runId,
    recordedAt: nowIso,
    recordedAtKst: nowInSeoulText(now),
    title: runTitle,
    owner,
    source: runRecord.source,
    file: runFileRelative,
    environment,
    scope,
    releaseFacing,
    coveragePacks,
    coveredSurfaces,
    skippedSurfaces,
    checks: runRecord.checks,
    expertAssessments,
    usageChecks,
    artifacts,
    links,
    expertCount: expertAssessments.length,
    expertNeedsImprovementCount,
    completedCount: finalCompletedImprovements.length,
    pendingCount: finalPendingImprovements.length,
    deferredCount: finalDeferredImprovements.length,
    wontFixCount: finalWontFixImprovements.length,
  });
  tracker.sequence.nextRunNumber = runNumber + 1;
  tracker.meta.updatedAt = nowIso;
  if (!tracker.meta.createdAt) tracker.meta.createdAt = nowIso;
  recalculateSummary(tracker);

  writeJsonFile(TRACKER_PATH, tracker);
  fs.writeFileSync(STATUS_PATH, statusMarkdown(tracker), 'utf8');
  formatGeneratedFiles([runFilePath, TRACKER_PATH, STATUS_PATH]);

  console.log(`✅ QA run recorded: ${runId}`);
  console.log(`- run file: ${runFileRelative}`);
  console.log(
    `- summary: runs=${tracker.summary.totalRuns}, completed=${tracker.summary.completedItems}, pending=${tracker.summary.pendingItems}, deferred=${tracker.summary.deferredItems || 0}, wont-fix=${tracker.summary.wontFixItems || 0}`
  );
  console.log(
    `- expert domains: tracked=${tracker.summary.expertDomainsTracked || 0}, open-gaps=${tracker.summary.expertDomainsOpenGaps || 0}`
  );
}

module.exports = {
  statusMarkdown,
};

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}
