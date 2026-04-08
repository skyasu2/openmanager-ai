#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REQUIRED_VARIABLES = ['VERCEL_TOKEN', 'GCP_SERVICE_KEY', 'GCP_PROJECT_ID'];
const REQUIRED_TAG_PATTERN = 'v*.*.*';
const API_BASE = (process.env.GITLAB_API_BASE_URL || 'https://gitlab.com/api/v4').replace(
  /\/$/,
  ''
);

function runGit(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    const stdout =
      error && typeof error === 'object' && 'stdout' in error ? String(error.stdout || '') : '';
    if (stdout.trim()) return stdout.trim();
    return '';
  }
}

function parseGitLabProjectPath(remoteUrl) {
  if (!remoteUrl) return '';

  const sshMatch = remoteUrl.match(/^git@gitlab\.com:(.+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];

  const httpsMatch = remoteUrl.match(/^https?:\/\/gitlab\.com\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];

  return '';
}

function tokenFromEnv() {
  return (
    process.env.GITLAB_TOKEN ||
    process.env.GL_TOKEN ||
    process.env.GLAB_TOKEN ||
    process.env.GITLAB_PRIVATE_TOKEN ||
    ''
  );
}

export function buildManualChecklist(projectPath) {
  return [
    '⚪ GitLab token not found. Manual checklist mode.',
    '',
    `Project: ${projectPath || '(unknown)'}`,
    `URL: https://gitlab.com/${projectPath || '<namespace>/<project>'}`,
    '',
    '[Required baseline]',
    '1. Settings > Repository > Protected branches',
    '   - Branch: main',
    '   - Allowed to push: Maintainers (or stricter)',
    '   - Allowed to merge: Maintainers (or stricter)',
    '   - Allow force push: disabled',
    '2. Settings > Repository > Protected tags',
    `   - Tag pattern: ${REQUIRED_TAG_PATTERN}`,
    '   - Allowed to create: Maintainers (or stricter)',
    '3. Settings > CI/CD > Variables',
    ...REQUIRED_VARIABLES.map((variable) => `   - ${variable}: present`),
    `   - If deploy secrets are Protected, ${REQUIRED_TAG_PATTERN} must also be a protected tag pattern`,
    '',
    'For API verification, set one of: GITLAB_TOKEN, GL_TOKEN, GLAB_TOKEN',
  ].join('\n');
}

function printManualChecklist(projectPath) {
  console.log(buildManualChecklist(projectPath));
}

function toAccessDescription(level) {
  if (typeof level.access_level_description === 'string') {
    return level.access_level_description;
  }

  if (level.group_id) return `group:${level.group_id}`;
  if (level.user_id) return `user:${level.user_id}`;
  if (typeof level.deploy_key_id === 'number') return `deploy-key:${level.deploy_key_id}`;
  return `access:${String(level.access_level ?? 'unknown')}`;
}

export function hasMaintainerOrStricterAccess(levels) {
  if (!Array.isArray(levels) || levels.length === 0) return false;
  return levels.every((level) => {
    const rawAccess = level?.access_level;
    const access = Number(rawAccess);
    if (rawAccess !== undefined && rawAccess !== null && !Number.isNaN(access)) {
      return access >= 40 || access === 0;
    }
    const desc = String(level.access_level_description || '').toLowerCase();
    return desc.includes('maintainer') || desc.includes('owner') || desc.includes('no one');
  });
}

async function fetchGitLab(path, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'PRIVATE-TOKEN': token,
    },
  });

  return response;
}

async function fetchProtectedMain(projectPath, token) {
  const encoded = encodeURIComponent(projectPath);
  const response = await fetchGitLab(`/projects/${encoded}/protected_branches/main`, token);

  if (response.status === 404) {
    return { ok: false, reason: 'main-not-protected', status: response.status };
  }

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      reason: 'api-error',
      status: response.status,
      body: body.slice(0, 500),
    };
  }

  const data = await response.json();
  return { ok: true, data };
}

async function fetchProtectedTag(projectPath, token) {
  const encoded = encodeURIComponent(projectPath);
  const tagPattern = encodeURIComponent(REQUIRED_TAG_PATTERN);
  const response = await fetchGitLab(`/projects/${encoded}/protected_tags/${tagPattern}`, token);

  if (response.status === 404) {
    return { ok: false, reason: 'tag-not-protected', status: response.status };
  }

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      reason: 'api-error',
      status: response.status,
      body: body.slice(0, 500),
    };
  }

  const data = await response.json();
  return { ok: true, data };
}

async function fetchProjectVariables(projectPath, token) {
  const encoded = encodeURIComponent(projectPath);
  const variables = [];
  let page = 1;

  while (true) {
    const response = await fetchGitLab(
      `/projects/${encoded}/variables?per_page=100&page=${page}`,
      token
    );

    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        reason: 'api-error',
        status: response.status,
        body: body.slice(0, 500),
      };
    }

    const data = await response.json();
    variables.push(...data);

    const nextPage = response.headers.get('x-next-page');
    if (!nextPage) {
      break;
    }

    page = Number(nextPage);
    if (!Number.isFinite(page) || page <= 0) {
      break;
    }
  }

  return { ok: true, data: variables };
}

export function evaluateDeployReadiness(branch, tag, variables) {
  const pushLevels = Array.isArray(branch.push_access_levels) ? branch.push_access_levels : [];
  const mergeLevels = Array.isArray(branch.merge_access_levels) ? branch.merge_access_levels : [];
  const allowForcePush = Boolean(branch.allow_force_push);
  const createLevels = Array.isArray(tag.create_access_levels) ? tag.create_access_levels : [];

  const variableMap = new Map();
  for (const variable of variables) {
    if (!variable || typeof variable !== 'object') continue;
    if (typeof variable.key !== 'string') continue;
    variableMap.set(variable.key, variable);
  }

  const checks = [
    {
      id: 'GL-DEPLOY-001',
      ok: hasMaintainerOrStricterAccess(pushLevels),
      pass: 'main push access is Maintainers or stricter',
      fail: 'main push access is wider than Maintainers',
    },
    {
      id: 'GL-DEPLOY-002',
      ok: hasMaintainerOrStricterAccess(mergeLevels),
      pass: 'main merge access is Maintainers or stricter',
      fail: 'main merge access is wider than Maintainers',
    },
    {
      id: 'GL-DEPLOY-003',
      ok: allowForcePush === false,
      pass: 'force push is disabled on main',
      fail: 'force push is enabled on main',
    },
    {
      id: 'GL-DEPLOY-004',
      ok: hasMaintainerOrStricterAccess(createLevels),
      pass: `${REQUIRED_TAG_PATTERN} protected tag create access is Maintainers or stricter`,
      fail: `${REQUIRED_TAG_PATTERN} protected tag create access is wider than Maintainers`,
    },
  ];

  for (const key of REQUIRED_VARIABLES) {
    checks.push({
      id: `GL-DEPLOY-VAR-${key}`,
      ok: variableMap.has(key),
      pass: `${key} exists`,
      fail: `${key} is missing`,
    });
  }

  const warnings = [];
  for (const key of REQUIRED_VARIABLES) {
    const variable = variableMap.get(key);
    if (!variable) continue;
    if (variable.protected !== true) {
      warnings.push({
        id: `GL-DEPLOY-PROT-${key}`,
        message: `${key} is unprotected. It will work, but the secret is exposed to non-protected pipelines.`,
      });
    }
  }

  return {
    pushLevels,
    mergeLevels,
    allowForcePush,
    createLevels,
    variableMap,
    checks,
    warnings,
  };
}

function printApiEvaluation(branchResult, tagResult, variableResult) {
  const branch = branchResult.data;
  const tag = tagResult.data;
  const variables = variableResult.data;
  const { pushLevels, mergeLevels, allowForcePush, createLevels, variableMap, checks, warnings } =
    evaluateDeployReadiness(branch, tag, variables);

  console.log('Protected branch: main');
  console.log('Push access:', pushLevels.map(toAccessDescription).join(', ') || '(none)');
  console.log('Merge access:', mergeLevels.map(toAccessDescription).join(', ') || '(none)');
  console.log('Allow force push:', allowForcePush ? 'true' : 'false');
  console.log('');
  console.log(`Protected tag: ${REQUIRED_TAG_PATTERN}`);
  console.log('Create access:', createLevels.map(toAccessDescription).join(', ') || '(none)');
  console.log('');
  console.log('Project variables:');
  for (const key of REQUIRED_VARIABLES) {
    const variable = variableMap.get(key);
    if (!variable) {
      console.log(`- ${key}: missing`);
      continue;
    }
    const protectedFlag = variable.protected === true ? 'true' : 'false';
    const maskedFlag = variable.masked === true ? 'true' : 'false';
    console.log(`- ${key}: present (protected=${protectedFlag}, masked=${maskedFlag})`);
  }
  console.log('');

  let failed = 0;
  for (const check of checks) {
    if (check.ok) {
      console.log(`PASS ${check.id} ${check.pass}`);
    } else {
      console.log(`FAIL ${check.id} ${check.fail}`);
      failed += 1;
    }
  }

  console.log('');
  for (const warning of warnings) {
    console.log(`WARN ${warning.id} ${warning.message}`);
  }

  if (failed > 0) {
    console.log('');
    console.log(
      `Action: fix GitLab protected branch/tag settings and required deploy variables before the next semver release.`
    );
    process.exitCode = 1;
    return;
  }

  console.log('✅ GitLab deploy readiness baseline satisfied.');
}

async function main() {
  const remote = runGit(['remote', 'get-url', 'gitlab']);
  const projectPath = parseGitLabProjectPath(remote);
  const token = tokenFromEnv();

  if (!projectPath) {
    console.error('FAIL Unable to infer gitlab project path from remote URL.');
    console.error('      Expected remote "gitlab" in ssh/https GitLab format.');
    process.exit(1);
    return;
  }

  if (!token) {
    printManualChecklist(projectPath);
    return;
  }

  const [branchResult, tagResult, variableResult] = await Promise.all([
    fetchProtectedMain(projectPath, token),
    fetchProtectedTag(projectPath, token),
    fetchProjectVariables(projectPath, token),
  ]);

  if (!branchResult.ok) {
    if (branchResult.reason === 'main-not-protected') {
      console.error('FAIL GL-DEPLOY-000 main branch is not protected.');
      process.exit(1);
      return;
    }
    console.error(
      `FAIL GitLab branch API error (${branchResult.status}): ${branchResult.body || branchResult.reason}`
    );
    process.exit(1);
    return;
  }

  if (!tagResult.ok) {
    if (tagResult.reason === 'tag-not-protected') {
      console.error(`FAIL GL-DEPLOY-005 protected tag ${REQUIRED_TAG_PATTERN} is missing.`);
      process.exit(1);
      return;
    }
    console.error(
      `FAIL GitLab tag API error (${tagResult.status}): ${tagResult.body || tagResult.reason}`
    );
    process.exit(1);
    return;
  }

  if (!variableResult.ok) {
    console.error(
      `FAIL GitLab variable API error (${variableResult.status}): ${variableResult.body || variableResult.reason}`
    );
    process.exit(1);
    return;
  }

  printApiEvaluation(branchResult, tagResult, variableResult);
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error('FAIL Unexpected error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
