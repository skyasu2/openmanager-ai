import { describe, expect, it } from 'vitest';
import { ADVISOR_INSTRUCTIONS } from './advisor';

describe('ADVISOR_INSTRUCTIONS', () => {
  it('requires evidence-backed read-only guidance before mutating operations', () => {
    expect(ADVISOR_INSTRUCTIONS).toContain('읽기 전용');
    expect(ADVISOR_INSTRUCTIONS).toContain('근거 없는 변경 금지');
    expect(ADVISOR_INSTRUCTIONS).toContain('패키지 설치');
    expect(ADVISOR_INSTRUCTIONS).toContain('서비스 재시작');
    expect(ADVISOR_INSTRUCTIONS).toContain('실행을 보류');
    expect(ADVISOR_INSTRUCTIONS).toContain('getServerMetrics(serverId)');
  });

  it('does not instruct Advisor to call Analyst-owned RCA tools directly', () => {
    expect(ADVISOR_INSTRUCTIONS).not.toContain('detectAnomalies');
    expect(ADVISOR_INSTRUCTIONS).not.toContain('correlateMetrics');
    expect(ADVISOR_INSTRUCTIONS).not.toContain('findRootCause');
    expect(ADVISOR_INSTRUCTIONS).toContain('Analyst Agent');
  });
});
