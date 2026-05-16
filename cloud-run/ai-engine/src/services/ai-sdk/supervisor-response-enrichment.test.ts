import { describe, expect, it } from 'vitest';
import { enrichResponseWithToolResults } from './supervisor-response-enrichment';

describe('enrichResponseWithToolResults', () => {
  it('adds metric evidence and server references from collected tool results', () => {
    const result = enrichResponseWithToolResults(
      '현재 서버 상태 요약입니다.',
      ['MISSING_METRIC_EVIDENCE', 'MISSING_SERVER_REFERENCE'],
      [
        {
          toolName: 'getServerMetricsAdvanced',
          result: {
            globalSummary: {
              cpu_avg: 42.4,
              cpu_max: 91.8,
              memory_avg: 67.2,
            },
            servers: [
              { id: 'api-was-dc1-01', cpu: 92, memory: 78 },
              { id: 'web-nginx-dc2-02', cpu: 76, memory: 61 },
            ],
          },
        },
      ]
    );

    expect(result.enrichmentApplied).toBe(true);
    expect(result.enrichmentSections).toEqual([
      'metric_evidence',
      'server_reference',
    ]);
    expect(result.enrichedResponse).toContain('CPU 평균 42%');
    expect(result.enrichedResponse).toContain('CPU 최대 92%');
    expect(result.enrichedResponse).toContain('api-was-dc1-01');
    expect(result.enrichedResponse).toContain('web-nginx-dc2-02');
  });

  it('uses recommendCommands recommendations and filters mutating commands', () => {
    const result = enrichResponseWithToolResults(
      '디스크 점검이 필요합니다.',
      ['MISSING_ACTION_GUIDANCE'],
      [
        {
          toolName: 'recommendCommands',
          result: {
            recommendations: [
              {
                command: 'df -h',
                description: '파일시스템별 디스크 사용량 확인',
              },
              {
                command: 'du -xhd1 / 2>/dev/null | sort -hr | head -20',
                description: '큰 디렉터리 후보 확인',
              },
              {
                command: 'rm -rf /tmp/old-*',
                description: '임시 파일 삭제',
              },
              {
                command: 'systemctl restart nginx',
                description: 'Nginx 재시작',
              },
            ],
          },
        },
      ]
    );

    expect(result.enrichmentApplied).toBe(true);
    expect(result.enrichmentSections).toEqual(['action_guidance']);
    expect(result.enrichedResponse).toContain('`df -h`');
    expect(result.enrichedResponse).toContain('`du -xhd1 /');
    expect(result.enrichedResponse).toContain('승인된 절차');
    expect(result.enrichedResponse).not.toContain('rm -rf');
    expect(result.enrichedResponse).not.toContain('systemctl restart');
  });

  it('does not fabricate enrichment when matching tool evidence is absent', () => {
    const result = enrichResponseWithToolResults(
      '응답입니다.',
      ['MISSING_METRIC_EVIDENCE'],
      [{ toolName: 'searchKnowledgeBase', result: { results: [] } }]
    );

    expect(result).toEqual({
      enrichedResponse: '응답입니다.',
      enrichmentApplied: false,
      enrichmentSections: [],
    });
  });
});
