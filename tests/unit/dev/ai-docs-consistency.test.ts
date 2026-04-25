/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

const {
  checkContent,
} = require('../../../scripts/docs/check-ai-docs-consistency.ts');

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

  it('flags direct Gemini MCP status guidance that bypasses the project launcher', () => {
    const findings = checkContent(
      'docs/development/vibe-coding/mcp-servers.md',
      'Gemini MCP 확인: gemini mcp list'
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'AI-DOCS-GEMINI-MCP-STATUS-001',
        }),
      ])
    );
  });

  it('allows Gemini MCP status guidance when trust and no-relaunch are explicit', () => {
    const findings = checkContent(
      'docs/development/vibe-coding/mcp-servers.md',
      'Gemini MCP 확인: GEMINI_CLI_TRUST_WORKSPACE=true GEMINI_CLI_NO_RELAUNCH=true gemini mcp list --debug'
    );

    expect(findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'AI-DOCS-GEMINI-MCP-STATUS-001',
        }),
      ])
    );
  });

  it('flags guidance that restores OpenManager MCP into Gemini global settings', () => {
    const findings = checkContent(
      'docs/development/vibe-coding/mcp-servers.md',
      'OpenManager MCP 복구: ~/.gemini/settings.json에 mcpServers 블록을 추가합니다.'
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'AI-DOCS-GEMINI-MCP-SCOPE-001',
        }),
      ])
    );
  });

  it('flags legacy mcp_project_settings global merge guidance', () => {
    const findings = checkContent(
      'docs/development/vibe-coding/mcp-servers.md',
      '~/mcp_project_settings.json 내용을 ~/.gemini/settings.json 전역 설정에 병합하여 저장합니다.'
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'AI-DOCS-GEMINI-MCP-LEGACY-FILE-001',
        }),
      ])
    );
  });

  it('flags direct Gemini skills discovery guidance that is unreliable in headless mode', () => {
    const findings = checkContent(
      'docs/development/vibe-coding/skills.md',
      'Gemini skills 확인: gemini skills list'
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'AI-DOCS-GEMINI-SKILLS-LIST-001',
        }),
      ])
    );
  });

  it('flags copying OpenManager common skills into Gemini overlay or user scope', () => {
    const findings = checkContent(
      'docs/development/vibe-coding/skills.md',
      'qa-state, lint-smoke, git-workflow 같은 프로젝트 맞춤형 스킬을 .gemini/skills 위치로 이동합니다.'
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'AI-DOCS-GEMINI-SKILL-SCOPE-001',
        }),
      ])
    );
  });
});
