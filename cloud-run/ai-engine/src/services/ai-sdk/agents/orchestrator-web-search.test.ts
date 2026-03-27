import { describe, expect, it } from 'vitest';
import {
  shouldEnableWebSearch,
  resolveWebSearchSetting,
  filterToolsByWebSearch,
  filterToolsByRAG,
} from './orchestrator-web-search';

describe('shouldEnableWebSearch', () => {
  it('enables for external indicator keywords', () => {
    expect(shouldEnableWebSearch('최신 kubernetes 패치 버전')).toBe(true);
    expect(shouldEnableWebSearch('CVE-2024-1234 대응')).toBe(true);
    expect(shouldEnableWebSearch('2026 nginx update')).toBe(true);
  });

  it('enables for technology + problem solving combo', () => {
    expect(shouldEnableWebSearch('kubernetes 문제 해결 방법')).toBe(true);
    expect(shouldEnableWebSearch('redis bug fix')).toBe(true);
    expect(shouldEnableWebSearch('docker 공식 문서 확인')).toBe(true);
  });

  it('disables for internal monitoring queries', () => {
    expect(shouldEnableWebSearch('서버 상태 확인')).toBe(false);
    expect(shouldEnableWebSearch('CPU 사용률 높음')).toBe(false);
    expect(shouldEnableWebSearch('현재 상태 대시보드')).toBe(false);
  });

  it('disables for ambiguous queries (conservative default)', () => {
    expect(shouldEnableWebSearch('안녕하세요')).toBe(false);
    expect(shouldEnableWebSearch('뭔가 잘 안돼')).toBe(false);
  });

  it('external indicators override internal-only', () => {
    // "서버 상태" is internal, but "최신" is external → external wins
    expect(shouldEnableWebSearch('최신 서버 상태 업데이트')).toBe(true);
  });
});

describe('resolveWebSearchSetting', () => {
  it('returns true when explicitly enabled', () => {
    expect(resolveWebSearchSetting(true, 'anything')).toBe(true);
  });

  it('returns false when explicitly disabled', () => {
    expect(resolveWebSearchSetting(false, '최신 kubernetes 패치')).toBe(false);
  });

  it('auto-detects for undefined', () => {
    expect(resolveWebSearchSetting(undefined, '최신 nginx 버전')).toBe(true);
    expect(resolveWebSearchSetting(undefined, 'CPU 사용률')).toBe(false);
  });

  it('auto-detects for "auto" string', () => {
    expect(resolveWebSearchSetting('auto', 'CVE 보안 취약점')).toBe(true);
    expect(resolveWebSearchSetting('auto', '서버 목록 조회')).toBe(false);
  });
});

describe('filterToolsByWebSearch', () => {
  it('returns all tools when web search enabled', () => {
    const tools = { searchWeb: 'mock', analyze: 'mock' };
    const filtered = filterToolsByWebSearch(tools, true);
    expect(filtered).toHaveProperty('searchWeb');
    expect(filtered).toHaveProperty('analyze');
  });

  it('removes searchWeb when web search disabled', () => {
    const tools = { searchWeb: 'mock', analyze: 'mock' };
    const filtered = filterToolsByWebSearch(tools, false);
    expect(filtered).not.toHaveProperty('searchWeb');
    expect(filtered).toHaveProperty('analyze');
  });

  it('returns unchanged tools when no searchWeb present', () => {
    const tools = { analyze: 'mock', report: 'mock' };
    const filtered = filterToolsByWebSearch(tools, false);
    expect(Object.keys(filtered)).toEqual(['analyze', 'report']);
  });
});

describe('filterToolsByRAG', () => {
  it('returns all tools when RAG enabled', () => {
    const tools = { searchKnowledgeBase: 'mock', analyze: 'mock' };
    const filtered = filterToolsByRAG(tools, true);
    expect(filtered).toHaveProperty('searchKnowledgeBase');
    expect(filtered).toHaveProperty('analyze');
  });

  it('removes searchKnowledgeBase when RAG disabled', () => {
    const tools = { searchKnowledgeBase: 'mock', analyze: 'mock' };
    const filtered = filterToolsByRAG(tools, false);
    expect(filtered).not.toHaveProperty('searchKnowledgeBase');
    expect(filtered).toHaveProperty('analyze');
  });

  it('returns unchanged tools when no searchKnowledgeBase present', () => {
    const tools = { analyze: 'mock', report: 'mock' };
    const filtered = filterToolsByRAG(tools, false);
    expect(Object.keys(filtered)).toEqual(['analyze', 'report']);
  });
});
