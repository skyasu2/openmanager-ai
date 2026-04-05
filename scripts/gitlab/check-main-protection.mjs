#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

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

function printManualChecklist(projectPath) {
  console.log('⚪ GitLab token not found. Manual checklist mode.');
  console.log('');
  console.log('Project: ' + (projectPath || '(unknown)'));
  console.log('URL: https://gitlab.com/' + (projectPath || '<namespace>/<project>'));
  console.log('');
  console.log('[Required baseline]');
  console.log('1. Settings > Repository > Protected branches');
  console.log('   - Branch: main');
  console.log('   - Allowed to push: No one');
  console.log('   - Allowed to merge: Maintainers (or stricter)');
  console.log('   - Allow force push: disabled');
  console.log('2. Settings > Merge requests');
  console.log('   - Pipelines must succeed: enabled');
  console.log('   - All threads must be resolved: enabled');
  console.log('3. Settings > General > Visibility, project features, permissions');
  console.log('   - Restrict write access to Maintainers only (or stricter)');
  console.log('');
  console.log('For API verification, set one of: GITLAB_TOKEN, GL_TOKEN');
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

function hasNoOnePushAccess(pushLevels) {
  if (!Array.isArray(pushLevels) || pushLevels.length === 0) return false;
  return pushLevels.some((level) => {
    const desc = String(level.access_level_description || '').toLowerCase();
    return desc.includes('no one') || Number(level.access_level) === 0;
  });
}

function hasMaintainerOrStricterMergeAccess(mergeLevels) {
  if (!Array.isArray(mergeLevels) || mergeLevels.length === 0) return false;
  return mergeLevels.every((level) => {
    const access = Number(level.access_level);
    if (!Number.isNaN(access)) {
      return access >= 40 || access === 0;
    }
    const desc = String(level.access_level_description || '').toLowerCase();
    return (
      desc.includes('maintainer') ||
      desc.includes('owner') ||
      desc.includes('no one') ||
      desc.includes('group') ||
      desc.includes('user')
    );
  });
}

async function fetchProtectedMain(projectPath, token) {
  const encoded = encodeURIComponent(projectPath);
  const url = `https://gitlab.com/api/v4/projects/${encoded}/protected_branches/main`;
  const response = await fetch(url, {
    headers: {
      'PRIVATE-TOKEN': token,
    },
  });

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

function printApiEvaluation(result) {
  const data = result.data;
  const pushLevels = Array.isArray(data.push_access_levels) ? data.push_access_levels : [];
  const mergeLevels = Array.isArray(data.merge_access_levels) ? data.merge_access_levels : [];
  const allowForcePush = Boolean(data.allow_force_push);

  const checks = [
    {
      id: 'GL-PROT-001',
      ok: hasNoOnePushAccess(pushLevels),
      pass: 'main push access is set to No one',
      fail: 'main push access is not No one',
    },
    {
      id: 'GL-PROT-002',
      ok: hasMaintainerOrStricterMergeAccess(mergeLevels),
      pass: 'main merge access is Maintainers or stricter',
      fail: 'main merge access is wider than Maintainers',
    },
    {
      id: 'GL-PROT-003',
      ok: allowForcePush === false,
      pass: 'force push is disabled',
      fail: 'force push is enabled',
    },
  ];

  console.log('Protected branch: main');
  console.log('Push access:', pushLevels.map(toAccessDescription).join(', ') || '(none)');
  console.log('Merge access:', mergeLevels.map(toAccessDescription).join(', ') || '(none)');
  console.log('Allow force push:', allowForcePush ? 'true' : 'false');
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
  if (failed > 0) {
    console.log('Action: update GitLab protected branch settings for main.');
    process.exitCode = 1;
    return;
  }

  console.log('✅ GitLab main protection baseline satisfied.');
}

async function main() {
  const remote = runGit(['remote', 'get-url', 'gitlab']);
  const projectPath = parseGitLabProjectPath(remote);
  const token = process.env.GITLAB_TOKEN || process.env.GL_TOKEN || '';

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

  const result = await fetchProtectedMain(projectPath, token);
  if (!result.ok) {
    if (result.reason === 'main-not-protected') {
      console.error('FAIL GL-PROT-000 main branch is not protected.');
      process.exit(1);
      return;
    }
    console.error(
      `FAIL GitLab API error (${result.status}): ${result.body || result.reason}`
    );
    process.exit(1);
    return;
  }

  printApiEvaluation(result);
}

main().catch((error) => {
  console.error('FAIL Unexpected error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
