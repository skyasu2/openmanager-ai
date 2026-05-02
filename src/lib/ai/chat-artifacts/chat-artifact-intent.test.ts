import { describe, expect, it } from 'vitest';
import { classifyChatArtifactIntent } from './chat-artifact-intent';

describe('classifyChatArtifactIntent', () => {
  it('routes explicit incident report creation requests to incident-report artifact', () => {
    expect(classifyChatArtifactIntent('장애 보고서 작성해줘')).toMatchObject({
      kind: 'incident-report',
    });
    expect(
      classifyChatArtifactIntent(
        '현재 장애 리포트를 md 파일로 다운로드하게 만들어줘'
      )
    ).toMatchObject({
      kind: 'incident-report',
    });
  });

  it('routes explicit trend analysis requests to monitoring-analysis artifact', () => {
    expect(
      classifyChatArtifactIntent('최근 추세 기준으로 리스크 분석해줘')
    ).toMatchObject({
      kind: 'monitoring-analysis',
    });
    expect(
      classifyChatArtifactIntent('전체 서버 이상감지 돌려줘')
    ).toMatchObject({
      kind: 'monitoring-analysis',
    });
  });

  it('keeps ambiguous feature questions as local guidance without API execution', () => {
    expect(
      classifyChatArtifactIntent('장애 보고는 어떻게 하면 돼?')
    ).toMatchObject({
      kind: 'guidance',
      target: 'incident-report',
    });
    expect(classifyChatArtifactIntent('추세 기능 어디서 봐?')).toMatchObject({
      kind: 'guidance',
      target: 'monitoring-analysis',
    });
    expect(classifyChatArtifactIntent('추세 분석 기능 설명해줘')).toMatchObject(
      {
        kind: 'guidance',
        target: 'monitoring-analysis',
      }
    );
  });

  it('does not capture normal operational chat questions', () => {
    expect(classifyChatArtifactIntent('CPU 높은 서버 알려줘')).toEqual({
      kind: 'none',
    });
  });
});
