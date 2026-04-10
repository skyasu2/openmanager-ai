#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  OUTPUT_PATH: VALIDATION_EVIDENCE_OUTPUT_PATH,
  shouldWriteValidationEvidenceSnapshot,
  writeValidationEvidenceSnapshot,
} = require('./build-validation-evidence');
const {
  repairTrackerDerivedFields,
} = require('./qa-tracker-utils');
const {
  normalizeDodChecks,
  normalizeExpertAssessment,
  normalizeItem,
  normalizePendingPolicy,
  normalizeUsageCheck,
  toBoolean,
} = require('./qa-record-normalizers');
const { statusMarkdown } = require('./qa-status-markdown');
const { nowInSeoulText, toSeoulParts } = require('./qa-time-utils');
const { applyRunToTracker } = require('./qa-tracker-run-apply');

const QA_ROOT = path.resolve(process.cwd(), 'reports/qa');
const RUNS_ROOT = path.join(QA_ROOT, 'runs');
const TRACKER_PATH = path.join(QA_ROOT, 'qa-tracker.json');
const STATUS_PATH = path.join(QA_ROOT, 'QA_STATUS.md');
const BIOME_WRAPPER_PATH = path.resolve(__dirname, '../dev/biome-wrapper.sh');

const RUN_SCOPE_VALUES = new Set(['smoke', 'targeted', 'broad', 'release-gate']);
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
const NON_DURABLE_ARTIFACT_PATH_PREFIXES = [
  'artifacts/',
  'tmp/playwright/',
  'playwright-report/',
  'test-results/',
  '.playwright-mcp/screenshots/',
  'screenshots/',
];
const DURABLE_ARTIFACT_PATH_PREFIXES = [
  'reports/qa/evidence/',
];
const LOCAL_PLAYWRIGHT_REPORT_DIR = 'tmp/playwright/e2e/report';
const LOCAL_PLAYWRIGHT_RESULTS_DIR = 'tmp/playwright/e2e/test-results';
const LOCAL_PLAYWRIGHT_MCP_SCREENSHOTS_DIR = 'tmp/playwright/mcp/screenshots';
const LEGACY_PLAYWRIGHT_REPORT_DIR = 'playwright-report';
const LEGACY_PLAYWRIGHT_RESULTS_DIR = 'test-results';
const LEGACY_PLAYWRIGHT_MCP_SCREENSHOTS_DIR = '.playwright-mcp/screenshots';
const NON_DURABLE_ARTIFACT_BASENAME_PATTERNS = [
  /^openmanager-.*\.png$/i,
  /^playwright-.*\.png$/i,
  /^mobile-.*\.png$/i,
  /^gradient-verify-.*\.png$/i,
  /^step.*\.png$/i,
];

function buildDurableArtifactBasenamePattern(dateStamp) {
  return new RegExp(
    `^qa-${dateStamp}-[a-z0-9]+(?:-[a-z0-9]+)*\\.[a-z0-9]{2,10}$`,
    'i'
  );
}

function parseArgs(argv) {
  const args = {
    input: '',
    syncPublic: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--input') {
      args.input = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (current === '--sync-public') {
      args.syncPublic = true;
      continue;
    }
  }

  return args;
}

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/qa/record-qa-run.js --input <qa-run-input.json> [--sync-public]',
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

function toNonNegativeInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName}는 0 이상의 정수여야 합니다.`);
  }
  return number;
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

  const remoteNames = [
    'github-public',
    'origin',
    ...readGitValue(['remote'])
      .split(/\r?\n/u)
      .map((entry) => entry.trim())
      .filter(Boolean),
  ];

  for (const remoteName of Array.from(new Set(remoteNames))) {
    const remoteUrl = readGitValue(['config', '--get', `remote.${remoteName}.url`]);
    const match = remoteUrl.match(
      /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/
    );
    if (!match) {
      continue;
    }

    return {
      owner: match[1],
      repo: match[2],
    };
  }

  return { owner: '', repo: '' };
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
    reportDir: LOCAL_PLAYWRIGHT_REPORT_DIR,
    resultsDir: LOCAL_PLAYWRIGHT_RESULTS_DIR,
    screenshotsDir: LOCAL_PLAYWRIGHT_MCP_SCREENSHOTS_DIR,
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

function toUniqueDirCandidates(primaryDir, fallbackDirs = []) {
  const normalized = [primaryDir, ...fallbackDirs]
    .filter((entry) => typeof entry === 'string')
    .map((entry) => String(entry).trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
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
  const seen = new Set();
  const reportDirCandidates = toUniqueDirCandidates(
    options.reportDir,
    options.reportDir === LOCAL_PLAYWRIGHT_REPORT_DIR ? [LEGACY_PLAYWRIGHT_REPORT_DIR] : []
  );

  for (const reportDir of reportDirCandidates) {
    const reportIndexPath = path.resolve(process.cwd(), reportDir, 'index.html');
    if (
      reportIndexPath &&
      fs.existsSync(reportIndexPath) &&
      isRecentFile(reportIndexPath, cutoffMs)
    ) {
      const relativePath = toPosixRelativePath(reportIndexPath);
      const key = `playwright-report|${relativePath}`;
      if (!seen.has(key)) {
        seen.add(key);
        artifacts.push({
          type: 'playwright-report',
          label: 'Playwright HTML report',
          path: relativePath,
        });
      }
    }
  }

  const resultsDirCandidates = toUniqueDirCandidates(
    options.resultsDir,
    options.resultsDir === LOCAL_PLAYWRIGHT_RESULTS_DIR ? [LEGACY_PLAYWRIGHT_RESULTS_DIR] : []
  );

  for (const resultsDir of resultsDirCandidates) {
    const resultsRoot = path.resolve(process.cwd(), resultsDir);
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
        const key = `playwright-trace|${relativePath}`;
        if (!seen.has(key)) {
          seen.add(key);
          artifacts.push({
            type: 'playwright-trace',
            label: path.basename(path.dirname(filePath)) || 'Playwright trace',
            path: relativePath,
          });
        }
        continue;
      }

      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        const key = `playwright-screenshot|${relativePath}`;
        if (!seen.has(key)) {
          seen.add(key);
          artifacts.push({
            type: 'playwright-screenshot',
            label: path.basename(filePath),
            path: relativePath,
          });
        }
        continue;
      }

      if (['.webm', '.mp4'].includes(ext)) {
        const key = `playwright-video|${relativePath}`;
        if (!seen.has(key)) {
          seen.add(key);
          artifacts.push({
            type: 'playwright-video',
            label: path.basename(filePath),
            path: relativePath,
          });
        }
      }
    }
  }

  const screenshotDirCandidates = toUniqueDirCandidates(
    options.screenshotsDir,
    options.screenshotsDir === LOCAL_PLAYWRIGHT_MCP_SCREENSHOTS_DIR
      ? [LEGACY_PLAYWRIGHT_MCP_SCREENSHOTS_DIR]
      : []
  );

  for (const screenshotsDir of screenshotDirCandidates) {
    const screenshotsRoot = path.resolve(process.cwd(), screenshotsDir);
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

      const key = `playwright-screenshot|${relativePath}`;
      if (!seen.has(key)) {
        seen.add(key);
        artifacts.push({
          type: 'playwright-screenshot',
          label: path.basename(filePath),
          path: relativePath,
        });
      }
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

function normalizeArtifactPathForPolicy(filePath) {
  return String(filePath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function findNonDurableArtifactPathReason(filePath) {
  const normalizedPath = normalizeArtifactPathForPolicy(filePath);
  if (!normalizedPath) {
    return '';
  }

  for (const prefix of NON_DURABLE_ARTIFACT_PATH_PREFIXES) {
    if (normalizedPath.startsWith(prefix)) {
      return prefix;
    }
  }

  const baseName = path.posix.basename(normalizedPath);
  if (!normalizedPath.includes('/') && /^qa.*\.png$/i.test(baseName)) {
    return baseName;
  }

  for (const pattern of NON_DURABLE_ARTIFACT_BASENAME_PATTERNS) {
    if (pattern.test(baseName)) {
      return baseName;
    }
  }

  return '';
}

function requiresDurableArtifactEvidence(releaseFacing, countsTowardSummary) {
  return releaseFacing === true || countsTowardSummary === true;
}

function validateArtifactPathExists(artifacts) {
  const missingArtifacts = artifacts
    .filter((artifact) => artifact && artifact.path)
    .map((artifact) => {
      const normalizedPath = normalizeArtifactPathForPolicy(artifact.path);
      const resolvedPath = path.resolve(process.cwd(), normalizedPath);
      return {
        artifact,
        normalizedPath,
        resolvedPath,
        exists: fs.existsSync(resolvedPath),
      };
    })
    .filter((entry) => !entry.exists);

  if (missingArtifacts.length === 0) {
    return;
  }

  const details = missingArtifacts
    .map(
      ({ artifact, normalizedPath }) =>
        `${artifact.label || artifact.type}: ${normalizedPath}`
    )
    .join('; ');

  throw new Error(
    'artifacts.path는 기록 시점에 실제 파일이어야 합니다. ' +
      `누락 경로: ${details}. 파일을 먼저 생성/복사하거나 URL evidence를 사용하세요.`
  );
}

function assertDurableArtifactPathsAreTracked(artifacts) {
  const pathArtifacts = artifacts.filter((artifact) => artifact && artifact.path);
  if (pathArtifacts.length === 0) {
    return;
  }

  try {
    const gitResult = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (gitResult !== 'true') {
      throw new Error('not-inside-work-tree');
    }
  } catch {
    throw new Error(
      'durable artifact path 검증은 Git work tree 안에서만 수행할 수 있습니다. ' +
        'releaseFacing/counting run은 저장소 루트에서 실행하거나 URL evidence를 사용하세요.'
    );
  }

  const untrackedArtifacts = pathArtifacts.filter((artifact) => {
    const normalizedPath = normalizeArtifactPathForPolicy(artifact.path);
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', '--', normalizedPath], {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
      return false;
    } catch {
      return true;
    }
  });

  if (untrackedArtifacts.length === 0) {
    return;
  }

  const details = untrackedArtifacts
    .map((artifact) => `${artifact.label || artifact.type}: ${normalizeArtifactPathForPolicy(artifact.path)}`)
    .join('; ');

  throw new Error(
    'releaseFacing=true 또는 countsTowardSummary=true 런의 artifact.path는 Git tracked path여야 합니다. ' +
      `미추적 경로: ${details}. 파일을 git add 한 뒤 기록하거나 URL evidence를 사용하세요.`
  );
}

function assertDurableArtifactPathsUseEvidenceRoot(artifacts) {
  const invalidArtifacts = artifacts
    .filter((artifact) => artifact && artifact.path)
    .map((artifact) => ({
      artifact,
      normalizedPath: normalizeArtifactPathForPolicy(artifact.path),
    }))
    .filter(
      ({ normalizedPath }) =>
        !DURABLE_ARTIFACT_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
    );

  if (invalidArtifacts.length === 0) {
    return;
  }

  const details = invalidArtifacts
    .map(
      ({ artifact, normalizedPath }) =>
        `${artifact.label || artifact.type}: ${normalizedPath}`
    )
    .join('; ');

  throw new Error(
    'releaseFacing=true 또는 countsTowardSummary=true 런의 로컬 artifact.path는 reports/qa/evidence/ 아래만 허용됩니다. ' +
      `허용되지 않은 경로: ${details}. 파일을 reports/qa/evidence/... 로 이동하거나 URL evidence를 사용하세요.`
  );
}

function assertDurableArtifactPathNames(artifacts, dateStamp) {
  const expectedPattern = buildDurableArtifactBasenamePattern(dateStamp);
  const invalidArtifacts = artifacts
    .filter((artifact) => artifact && artifact.path)
    .map((artifact) => {
      const normalizedPath = normalizeArtifactPathForPolicy(artifact.path);
      return {
        artifact,
        normalizedPath,
        baseName: path.posix.basename(normalizedPath),
      };
    })
    .filter(({ baseName }) => !expectedPattern.test(baseName));

  if (invalidArtifacts.length === 0) {
    return;
  }

  const details = invalidArtifacts
    .map(
      ({ artifact, normalizedPath }) =>
        `${artifact.label || artifact.type}: ${normalizedPath}`
    )
    .join('; ');

  throw new Error(
    'releaseFacing=true 또는 countsTowardSummary=true 런의 로컬 artifact.path 파일명은 ' +
      `qa-${dateStamp}-<slug>.<ext> 형식이어야 합니다. ` +
      `잘못된 파일명: ${details}. 예: reports/qa/evidence/qa-${dateStamp}-dashboard-landing.png`
  );
}

function assertDurableArtifactPathsAreRunUnique(tracker, artifacts) {
  const existingPathToRunId = new Map();
  const previousRuns = Array.isArray(tracker?.runs) ? tracker.runs : [];

  for (const run of previousRuns) {
    const runArtifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
    for (const artifact of runArtifacts) {
      if (!artifact?.path) {
        continue;
      }

      const normalizedPath = normalizeArtifactPathForPolicy(artifact.path);
      if (!existingPathToRunId.has(normalizedPath)) {
        existingPathToRunId.set(normalizedPath, run.runId || 'unknown-run');
      }
    }
  }

  const reusedArtifacts = artifacts
    .filter((artifact) => artifact && artifact.path)
    .map((artifact) => {
      const normalizedPath = normalizeArtifactPathForPolicy(artifact.path);
      return {
        artifact,
        normalizedPath,
        previousRunId: existingPathToRunId.get(normalizedPath) || '',
      };
    })
    .filter(({ previousRunId }) => Boolean(previousRunId));

  if (reusedArtifacts.length === 0) {
    return;
  }

  const details = reusedArtifacts
    .map(
      ({ artifact, normalizedPath, previousRunId }) =>
        `${artifact.label || artifact.type}: ${normalizedPath} (already used by ${previousRunId})`
    )
    .join('; ');

  throw new Error(
    'releaseFacing=true 또는 countsTowardSummary=true 런의 로컬 artifact.path는 run별 고유 evidence여야 합니다. ' +
      `재사용된 경로: ${details}. 기존 파일을 덮어쓰지 말고 새 slug로 복사한 뒤 기록하세요.`
  );
}

function validateArtifactEvidencePolicy(
  tracker,
  artifacts,
  releaseFacing,
  countsTowardSummary,
  dateStamp
) {
  validateArtifactPathExists(artifacts);

  if (!requiresDurableArtifactEvidence(releaseFacing, countsTowardSummary)) {
    return;
  }

  const invalidArtifacts = artifacts
    .filter((artifact) => artifact && artifact.path)
    .map((artifact) => ({
      artifact,
      reason: findNonDurableArtifactPathReason(artifact.path),
    }))
    .filter((entry) => entry.reason);

  if (invalidArtifacts.length === 0) {
    assertDurableArtifactPathsAreTracked(artifacts);
    assertDurableArtifactPathsUseEvidenceRoot(artifacts);
    assertDurableArtifactPathNames(artifacts, dateStamp);
    assertDurableArtifactPathsAreRunUnique(tracker, artifacts);
    return;
  }

  const details = invalidArtifacts
    .map(
      ({ artifact, reason }) =>
        `${artifact.label || artifact.type}: ${artifact.path} (ephemeral pattern: ${reason})`
    )
    .join('; ');

  throw new Error(
    'releaseFacing=true 또는 countsTowardSummary=true 런에는 durable artifact evidence가 필요합니다. ' +
      'tmp/playwright/**/playwright-report/test-results/.playwright-mcp/screenshots/artifacts/root qa*.png 같은 로컬 임시 경로는 사용할 수 없습니다. ' +
      `문제 경로: ${details}. URL을 사용하거나 추적 가능한 repo 경로(예: reports/qa/evidence/... )로 복사한 뒤 기록하세요.`
  );
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

function normalizeArtifactDebt(rawValue) {
  if (!rawValue) {
    return null;
  }

  if (typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    throw new Error('artifactDebt는 객체여야 합니다.');
  }

  const status = String(rawValue.status || '').trim().toLowerCase();
  if (!status) {
    throw new Error('artifactDebt.status가 필요합니다.');
  }
  if (status !== 'acknowledged') {
    throw new Error('artifactDebt.status는 acknowledged만 지원합니다.');
  }

  const kind = String(rawValue.kind || '').trim();
  const reason = String(rawValue.reason || '').trim();
  if (!kind) {
    throw new Error('artifactDebt.kind가 필요합니다.');
  }
  if (!reason) {
    throw new Error('artifactDebt.reason가 필요합니다.');
  }

  const recordedAt = String(rawValue.recordedAt || '').trim();
  const recordedBy = String(rawValue.recordedBy || '').trim();

  return {
    status,
    kind,
    reason,
    ...(recordedAt ? { recordedAt } : {}),
    ...(recordedBy ? { recordedBy } : {}),
  };
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

function inferCountsTowardSummary(rawValue, totalChecks) {
  if (rawValue === undefined) {
    return totalChecks > 0;
  }

  return toBoolean(rawValue, true);
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
  const seoulParts = toSeoulParts(now);
  const dateStamp = `${seoulParts.year}${seoulParts.month}${seoulParts.day}`;
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
  const artifactDebt = normalizeArtifactDebt(payload.artifactDebt);

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
  const countsTowardSummary = inferCountsTowardSummary(
    payload.countsTowardSummary,
    total
  );
  if (total === 0 && countsTowardSummary) {
    throw new Error(
      'checks.total=0 런은 countsTowardSummary=true 로 기록할 수 없습니다. 상태 검증/운영 기록 런이면 countsTowardSummary=false 로 기록하세요.'
    );
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
  // Warn when targeted scope is combined with releaseFacing=true.
  // Such a run will pass validation gates but will NOT be promoted to the
  // public snapshot baseline (build-validation-evidence.js enforces this).
  if (
    scope === 'targeted' &&
    releaseFacing === true &&
    payload.releaseFacing === true
  ) {
    console.warn(
      '⚠️  [QA record] scope=targeted + releaseFacing=true: 이 런은 production validation gate를 통과하지만,\n' +
        '   public snapshot 대표(validation-evidence.json latestRun)로는 승격되지 않습니다.\n' +
        '   전체 표면 증거가 필요하면 scope=broad 런을 별도로 실행하세요.'
    );
  }

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
  validateArtifactEvidencePolicy(
    tracker,
    artifacts,
    releaseFacing,
    countsTowardSummary,
    dateStamp
  );
  const runNumber = Number(tracker.sequence.nextRunNumber || tracker.runs.length + 1);
  const runId = `QA-${dateStamp}-${String(runNumber).padStart(4, '0')}`;
  const runYearDir = path.join(RUNS_ROOT, seoulParts.year);
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
    countsTowardSummary,
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
    ...(artifactDebt ? { artifactDebt } : {}),
    completedImprovements: finalCompletedImprovements,
    pendingImprovements: finalPendingImprovements,
    deferredImprovements: finalDeferredImprovements,
    wontFixImprovements: finalWontFixImprovements,
    notes: Array.isArray(payload.notes) ? payload.notes.map(String) : [],
    links,
  };

  writeJsonFile(runFilePath, runRecord);

  applyRunToTracker({
    tracker,
    runId,
    runNumber,
    recordedAt: nowIso,
    recordedAtKst: nowInSeoulText(now),
    runTitle,
    owner,
    runRecord,
    runFileRelative,
    environment,
    scope,
    releaseFacing,
    countsTowardSummary,
    coveragePacks,
    coveredSurfaces,
    skippedSurfaces,
    expertAssessments,
    usageChecks,
    artifacts,
    artifactDebt,
    links,
    finalCompletedImprovements,
    finalPendingImprovements,
    finalDeferredImprovements,
    finalWontFixImprovements,
  });

  writeJsonFile(TRACKER_PATH, tracker);
  fs.writeFileSync(STATUS_PATH, statusMarkdown(tracker), 'utf8');
  const generatedFiles = [runFilePath, TRACKER_PATH, STATUS_PATH];
  if (args.syncPublic && shouldWriteValidationEvidenceSnapshot(TRACKER_PATH)) {
    writeValidationEvidenceSnapshot({ trackerPath: TRACKER_PATH });
    generatedFiles.push(VALIDATION_EVIDENCE_OUTPUT_PATH);
  }
  formatGeneratedFiles([
    ...generatedFiles,
  ]);

  console.log(`✅ QA run recorded: ${runId}`);
  console.log(`- run file: ${runFileRelative}`);
  console.log(
    `- summary: runs=${tracker.summary.totalRuns}, completed=${tracker.summary.completedItems}, pending=${tracker.summary.pendingItems}, deferred=${tracker.summary.deferredItems || 0}, wont-fix=${tracker.summary.wontFixItems || 0}`
  );
  console.log(
    `- expert domains: tracked=${tracker.summary.expertDomainsTracked || 0}, open-gaps=${tracker.summary.expertDomainsOpenGaps || 0}`
  );
  if (!args.syncPublic) {
    console.log(
      '- public evidence: skipped by default (reports only). Run `npm run qa:evidence:build` or `npm run qa:status -- --write --sync-public` to publish the snapshot.'
    );
  }
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
