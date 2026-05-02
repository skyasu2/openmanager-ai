/**
 * @vitest-environment node
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const GITHUB_SCHEDULE_GUARD = 'vars.ENABLE_ACTIONS_SCHEDULES';

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('periodic jobs contract', () => {
  it('keeps Vercel cron and background jobs disabled by project config', () => {
    const vercelConfig = JSON.parse(readProjectFile('vercel.json')) as {
      crons?: unknown[];
      env?: Record<string, string>;
    };

    expect(vercelConfig.crons ?? []).toEqual([]);
    expect(vercelConfig.env?.DISABLE_CRON_JOBS).toBe('true');
    expect(vercelConfig.env?.DISABLE_BACKGROUND_JOBS).toBe('true');
  });

  it('requires every GitHub Actions schedule to be gated by explicit opt-in', () => {
    const workflowsDir = path.join(PROJECT_ROOT, '.github/workflows');
    const scheduledWorkflows = readdirSync(workflowsDir)
      .filter(
        (fileName) => fileName.endsWith('.yml') || fileName.endsWith('.yaml')
      )
      .filter((fileName) => {
        const content = readProjectFile(`.github/workflows/${fileName}`);
        return (
          /(^|\n)\s*schedule:\s*\n/.test(content) ||
          /\bcron:\s*['"]/.test(content)
        );
      })
      .sort();

    expect(scheduledWorkflows).toEqual([
      'artifact-cleanup.yml',
      'branch-cleanup.yml',
      'codeql-analysis.yml',
      'dependabot-auto-merge.yml',
      'keep-alive.yml',
    ]);

    for (const fileName of scheduledWorkflows) {
      expect(readProjectFile(`.github/workflows/${fileName}`)).toContain(
        GITHUB_SCHEDULE_GUARD
      );
    }
  });

  it('keeps GitLab scheduled pipelines limited to artifact registry observation', () => {
    const gitlabCi = readProjectFile('.gitlab-ci.yml');
    const scheduleRuleCount =
      gitlabCi.match(/\$CI_PIPELINE_SOURCE == "schedule"/g)?.length ?? 0;

    expect(scheduleRuleCount).toBe(2);
    expect(gitlabCi).toContain('observe_artifact_registry_cleanup');
    expect(gitlabCi).toContain(
      'bash cloud-run/ai-engine/scripts/check-artifact-registry-cleanup.sh'
    );
  });
});
