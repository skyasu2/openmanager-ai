import { describe, expect, it } from 'vitest';
import {
  classifyChatArtifactIntent,
  shouldUseLLMChatArtifactIntent,
} from './chat-artifact-intent';

describe('classifyChatArtifactIntent', () => {
  it('routes explicit incident report creation requests to incident-report artifact', () => {
    expect(classifyChatArtifactIntent('장애 보고서 작성해줘')).toMatchObject({
      kind: 'incident-report',
    });
    expect(classifyChatArtifactIntent('장애보고서')).toMatchObject({
      kind: 'incident-report',
      reason: 'incident_report_implicit_keyword',
    });
    expect(classifyChatArtifactIntent('장애 보고서 부탁')).toMatchObject({
      kind: 'incident-report',
      reason: 'incident_report_action_pattern',
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
    expect(classifyChatArtifactIntent('추세 분석')).toMatchObject({
      kind: 'monitoring-analysis',
      reason: 'monitoring_implicit_artifact_keyword',
    });
    expect(classifyChatArtifactIntent('이상감지')).toMatchObject({
      kind: 'monitoring-analysis',
      reason: 'monitoring_implicit_artifact_keyword',
    });
    expect(classifyChatArtifactIntent('장애 예측 추세 분석')).toMatchObject({
      kind: 'monitoring-analysis',
      reason: 'monitoring_implicit_artifact_keyword',
    });
    expect(classifyChatArtifactIntent('추세 분석 기능 실행해줘')).toMatchObject(
      {
        kind: 'monitoring-analysis',
      }
    );
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
      reason: 'monitoring_guidance_pattern',
    });
    expect(classifyChatArtifactIntent('추세 분석 기능 설명해줘')).toMatchObject(
      {
        kind: 'guidance',
        target: 'monitoring-analysis',
      }
    );
    expect(
      classifyChatArtifactIntent('장애 보고서 기능 설명해줘')
    ).toMatchObject({
      kind: 'guidance',
      target: 'incident-report',
    });
    expect(
      classifyChatArtifactIntent('장애 보고서 작성 방법 알려줘')
    ).toMatchObject({
      kind: 'guidance',
      target: 'incident-report',
    });
    expect(
      classifyChatArtifactIntent('장애 보고서 파일 형식 설명해줘')
    ).toMatchObject({
      kind: 'guidance',
      target: 'incident-report',
    });
    expect(
      classifyChatArtifactIntent('추세 보고서 기능 설명해줘')
    ).toMatchObject({
      kind: 'guidance',
      target: 'monitoring-analysis',
    });
  });

  it('does not capture normal operational chat questions', () => {
    expect(classifyChatArtifactIntent('CPU 높은 서버 알려줘')).toEqual({
      kind: 'none',
    });
    expect(classifyChatArtifactIntent('추세')).toEqual({
      kind: 'none',
    });
    expect(classifyChatArtifactIntent('최근 추세가 어때?')).toEqual({
      kind: 'none',
    });
  });

  it('blocks artifact execution when query has a question mark (implicit path)', () => {
    // 물음표가 있으면 isImplicitKeywordRequest = false → none으로 폴백
    expect(classifyChatArtifactIntent('이상감지?')).toEqual({ kind: 'none' });
    expect(classifyChatArtifactIntent('추세 분석?')).toEqual({ kind: 'none' });
    expect(classifyChatArtifactIntent('장애보고서?')).toEqual({ kind: 'none' });
    // 예측 단독은 artifact 형태 구문이 아니므로 none
    expect(classifyChatArtifactIntent('예측')).toEqual({ kind: 'none' });
  });

  it('keeps LLM fallback behind an artifact candidate gate', () => {
    expect(shouldUseLLMChatArtifactIntent('CPU 높은 서버 알려줘')).toBe(false);
    expect(shouldUseLLMChatArtifactIntent('최근 추세가 어때?')).toBe(false);
    expect(shouldUseLLMChatArtifactIntent('추세 분석?')).toBe(false);
    expect(shouldUseLLMChatArtifactIntent('장애 리포트 만들어줘')).toBe(true);
    expect(shouldUseLLMChatArtifactIntent('트렌드 분석 좀 해줘')).toBe(true);
  });
});
