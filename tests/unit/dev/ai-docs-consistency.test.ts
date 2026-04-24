/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

const {
  checkContent,
} = require('../../../scripts/docs/check-ai-docs-consistency');

describe('AI docs consistency check', () => {
  it('flags legacy .mcp.json token-bearing guidance without printing secrets', () => {
    const findings = checkContent(
      '.mcp.json.README.md',
      [
        '# MCP 설정',
        '',
        '이 파일에는 하드코딩된 API 토큰이 포함되어 있습니다.',
      ].join('\n')
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'AI-DOCS-MCP-SECRET-001',
          file: '.mcp.json.README.md',
          line: 3,
        }),
      ])
    );
    expect(findings[0]).not.toHaveProperty('lineText');
  });

  it('allows current no-direct-token MCP policy wording', () => {
    const findings = checkContent(
      'docs/development/vibe-coding/mcp-servers.md',
      [
        '- MCP 설정 파일에는 실제 토큰을 커밋하지 않습니다.',
        '- `.mcp.json`은 더 이상 gitignored secret 파일이 아닙니다.',
        '- 실제 토큰은 `.env.local` 또는 shell env에 둡니다.',
      ].join('\n')
    );

    expect(findings).toEqual([]);
  });

  it('flags Gemini same-name symlink skill guidance', () => {
    const findings = checkContent(
      'docs/development/vibe-coding/skills.md',
      'Gemini symlink 추가: ln -sf ../../.claude/skills/name .gemini/skills/name'
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'AI-DOCS-SKILL-SYMLINK-001',
        }),
      ])
    );
  });
});
