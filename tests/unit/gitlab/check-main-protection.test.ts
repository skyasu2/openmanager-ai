/**
 * @vitest-environment node
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  loadDotenvIfNeeded,
  parseDotenvAssignments,
} from '../../../scripts/gitlab/check-main-protection.mjs';

const ORIGINAL_ENV = { ...process.env };
const TOKEN_KEYS = [
  'GITLAB_TOKEN',
  'GL_TOKEN',
  'GLAB_TOKEN',
  'GITLAB_PRIVATE_TOKEN',
];

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('check-main-protection dotenv token loading', () => {
  it('parses dotenv assignments and strips surrounding quotes', () => {
    const parsed = parseDotenvAssignments(`
      # ignored
      export GITLAB_TOKEN="glpat-from-file"
      GL_TOKEN='gl-token'
      INVALID LINE
      GITLAB_PRIVATE_TOKEN=private-token
    `);

    expect(parsed.get('GITLAB_TOKEN')).toBe('glpat-from-file');
    expect(parsed.get('GL_TOKEN')).toBe('gl-token');
    expect(parsed.get('GITLAB_PRIVATE_TOKEN')).toBe('private-token');
    expect(parsed.has('INVALID LINE')).toBe(false);
  });

  it('loads a GitLab token from dotenv only when no live token exists', () => {
    for (const key of TOKEN_KEYS) {
      delete process.env[key];
    }

    const tempDir = mkdtempSync(join(tmpdir(), 'openmanager-gitlab-token-'));
    const envPath = join(tempDir, '.env.local');
    writeFileSync(envPath, 'GITLAB_TOKEN="glpat-file-token"\n', 'utf8');

    try {
      expect(loadDotenvIfNeeded(envPath)).toBe(true);
      expect(process.env.GITLAB_TOKEN).toBe('glpat-file-token');

      process.env.GITLAB_TOKEN = 'live-token';
      writeFileSync(envPath, 'GITLAB_TOKEN="new-file-token"\n', 'utf8');

      expect(loadDotenvIfNeeded(envPath)).toBe(false);
      expect(process.env.GITLAB_TOKEN).toBe('live-token');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
