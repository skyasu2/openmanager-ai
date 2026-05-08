import { describe, expect, it, vi } from 'vitest';

vi.mock('./context-store', () => ({
  appendAffectedServers: vi.fn(),
  appendAnomalies: vi.fn(),
  appendMetrics: vi.fn(),
  updateSessionContext: vi.fn(),
}));

vi.mock('./vision-agent', () => ({
  isVisionQuery: vi.fn((query: string) =>
    /스크린샷|이미지|대시보드|screenshot|image|dashboard/i.test(query)
  ),
}));

import { preFilterQuery } from './orchestrator-context';

describe('preFilterQuery', () => {
  it('returns direct response for greetings', () => {
    const result = preFilterQuery('안녕하세요');
    expect(result.shouldHandoff).toBe(false);
    expect(result.directResponse).toContain('서버 모니터링 AI');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('returns generic NLQ suggestion for simple server metric query', () => {
    const result = preFilterQuery('서버 상태 알려줘');
    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('NLQ Agent');
    expect(result.confidence).toBe(0.86);
  });

  it('routes attached visual intent to Vision Agent when image/file is attached', () => {
    const result = preFilterQuery('CPU 차트 첨부해서 확인해줘', { hasImageAttachments: true });

    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Vision Agent');
    expect(result.confidence).toBe(0.92);
  });

  it('prefers analyst/reporter/advisor with high confidence for clear intent', () => {
    expect(preFilterQuery('CPU 급증 원인 분석해줘').suggestedAgent).toBe('Analyst Agent');
    expect(preFilterQuery('장애 보고서 작성해줘').suggestedAgent).toBe('Reporter Agent');
    expect(preFilterQuery('메모리 부족 해결 방법 알려줘').suggestedAgent).toBe('Advisor Agent');
  });

  it('answers clear service command questions directly without generic metric handoff', () => {
    const result = preFilterQuery(
      'HAProxy에서 현재 연결된 백엔드 서버 목록이랑 상태 확인하는 명령어 알려줘'
    );

    expect(result.shouldHandoff).toBe(false);
    expect(result.directResponse).toContain('echo "show stat"');
    expect(result.directResponse).toContain('systemctl status haproxy');
    expect(result.directResponse).not.toMatch(/mysql|redis-cli|nginx\s+-t/i);
  });

  it('answers Nginx and NFS command guidance directly from the command catalog', () => {
    const nginx = preFilterQuery(
      'Nginx 액세스 로그에서 5xx 에러가 많이 나는 경로 분석하는 방법 알려줘'
    );
    const nfs = preFilterQuery(
      'NFS 마운트가 끊겼을 때 확인하고 재마운트하는 순서 알려줘'
    );

    expect(nginx.shouldHandoff).toBe(false);
    expect(nginx.directResponse).toContain('/var/log/nginx/access.log');
    expect(nginx.directResponse).toContain("awk '$9 ~ /^5/");
    expect(nfs.shouldHandoff).toBe(false);
    expect(nfs.directResponse).toContain('findmnt -t nfs');
    expect(nfs.directResponse).toContain('showmount -e <nfs-server>');
    expect(nfs.directResponse).toContain('mount -t nfs');
  });

  it('does not send formatting-only report rewrites to Reporter Agent', () => {
    const result = preFilterQuery(
      '방금 CPU 상위 3개 서버 결과를 운영 보고서용 2문장으로 다시 작성해줘'
    );

    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('NLQ Agent');
    expect(result.confidence).toBe(0.86);
  });

  it('routes topology queries to Advisor Agent with high confidence', () => {
    const result = preFilterQuery('현재 인프라 토폴로지 알려줘. 관련된 운영 가이드도 연결해줘');
    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('Advisor Agent');
    expect(result.confidence).toBe(0.9);
  });

  it('provides fallback agent hint for composite infra query', () => {
    const result = preFilterQuery('서버 상태와 원인 분석을 비교하고 해결 방법도 알려줘');
    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBeDefined();
    expect(result.confidence).toBe(0.68);
  });
});
