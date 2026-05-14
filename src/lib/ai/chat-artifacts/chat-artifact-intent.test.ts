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
    expect(
      classifyChatArtifactIntent('장애 보고서 기능 실행해줘')
    ).toMatchObject({
      kind: 'incident-report',
      reason: 'incident_report_action_pattern',
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

  it('routes explicit server-id anomaly requests to server-monitoring-analysis artifacts', () => {
    expect(
      classifyChatArtifactIntent('api-was-dc1-01 이상감지 분석해줘')
    ).toMatchObject({
      kind: 'server-monitoring-analysis',
      serverId: 'api-was-dc1-01',
      serverName: 'api-was-dc1-01',
      reason: 'server_monitoring_action_pattern',
    });
    expect(
      classifyChatArtifactIntent('db-mysql-dc1-primary 추세 분석')
    ).toMatchObject({
      kind: 'server-monitoring-analysis',
      serverId: 'db-mysql-dc1-primary',
      reason: 'server_monitoring_action_pattern',
    });
    expect(
      classifyChatArtifactIntent('web-server-01 이상감지 분석해줘')
    ).toMatchObject({
      kind: 'server-monitoring-analysis',
      serverId: 'web-nginx-dc1-01',
      serverName: 'web-nginx-dc1-01',
      reason: 'server_monitoring_action_pattern',
    });
    expect(
      classifyChatArtifactIntent('api-was-dc1-01 이상감지 기능 설명해줘')
    ).toMatchObject({
      kind: 'guidance',
      target: 'monitoring-analysis',
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
    expect(classifyChatArtifactIntent('CPU 높은 서버 알려줘')).toMatchObject({
      kind: 'none',
    });
    expect(classifyChatArtifactIntent('추세')).toMatchObject({
      kind: 'none',
    });
    expect(classifyChatArtifactIntent('최근 추세가 어때?')).toMatchObject({
      kind: 'none',
    });
    expect(classifyChatArtifactIntent('현재 서버 상태 분석해줘')).toMatchObject(
      {
        kind: 'none',
      }
    );
    expect(classifyChatArtifactIntent('서버 분석해줘')).toMatchObject({
      kind: 'none',
    });
    expect(
      classifyChatArtifactIntent('CPU 높은 서버 원인 분석해줘')
    ).toMatchObject({
      kind: 'none',
    });
    expect(
      classifyChatArtifactIntent(
        '방금 CPU 상위 3개 서버 결과를 운영 보고서용 2문장으로 다시 작성해줘'
      )
    ).toMatchObject({
      kind: 'none',
    });
    expect(
      classifyChatArtifactIntent(
        '이상감지 결과를 보고서용 문장으로 다시 작성해줘'
      )
    ).toMatchObject({
      kind: 'none',
    });
  });

  it('routes operational script, alert rule, runbook, and follow-up edit requests to ops-procedure artifacts', () => {
    expect(
      classifyChatArtifactIntent(
        'CPU 80% 이상 서버 슬랙 알림 bash 스크립트 짜줘'
      )
    ).toMatchObject({
      kind: 'ops-procedure',
      procedureType: 'script',
      reason: 'ops_procedure_action_pattern',
    });

    expect(
      classifyChatArtifactIntent(
        'CPU 80% 이상 서버 Slack 알림 Alertmanager 설정 만들어줘'
      )
    ).toMatchObject({
      kind: 'ops-procedure',
      procedureType: 'alert-rule',
      reason: 'ops_procedure_action_pattern',
    });

    expect(
      classifyChatArtifactIntent(
        '로그 중 에러/경고 보고 원인과 대응 순서 알려줘'
      )
    ).toMatchObject({
      kind: 'ops-procedure',
      procedureType: 'runbook',
      reason: 'ops_procedure_action_pattern',
    });

    expect(
      classifyChatArtifactIntent('이 스크립트에서 임계치를 90%로 바꿔줘')
    ).toMatchObject({
      kind: 'ops-procedure',
      procedureType: 'script',
      reason: 'ops_procedure_followup_edit_pattern',
    });
  });

  it('does not promote metric lookups or general coding guard cases to ops-procedure artifacts', () => {
    expect(
      classifyChatArtifactIntent('지금 CPU 높은 서버 TOP 3')
    ).toMatchObject({
      kind: 'none',
    });
    expect(
      classifyChatArtifactIntent('파이썬 피보나치 코드 짜줘')
    ).toMatchObject({
      kind: 'none',
    });
    expect(
      shouldUseLLMChatArtifactIntent(
        'CPU 80% 이상 서버 슬랙 알림 bash 스크립트 짜줘'
      )
    ).toBe(false);
  });

  it('blocks artifact execution when query has a question mark (implicit path)', () => {
    // 물음표가 있으면 isImplicitKeywordRequest = false → none으로 폴백
    expect(classifyChatArtifactIntent('이상감지?')).toMatchObject({
      kind: 'none',
    });
    expect(classifyChatArtifactIntent('추세 분석?')).toMatchObject({
      kind: 'none',
    });
    expect(classifyChatArtifactIntent('장애보고서?')).toMatchObject({
      kind: 'none',
    });
    // 예측 단독은 artifact 형태 구문이 아니므로 none
    expect(classifyChatArtifactIntent('예측')).toMatchObject({ kind: 'none' });
  });

  it('keeps LLM fallback behind an artifact candidate gate', () => {
    expect(shouldUseLLMChatArtifactIntent('CPU 높은 서버 알려줘')).toBe(false);
    expect(shouldUseLLMChatArtifactIntent('최근 추세가 어때?')).toBe(false);
    expect(shouldUseLLMChatArtifactIntent('추세 분석?')).toBe(false);
    expect(shouldUseLLMChatArtifactIntent('현재 서버 상태 분석해줘')).toBe(
      false
    );
    expect(
      shouldUseLLMChatArtifactIntent(
        '방금 CPU 상위 3개 서버 결과를 운영 보고서용 2문장으로 다시 작성해줘'
      )
    ).toBe(false);
    expect(
      shouldUseLLMChatArtifactIntent(
        '이상감지 결과를 보고서용 문장으로 다시 작성해줘'
      )
    ).toBe(false);
    expect(
      shouldUseLLMChatArtifactIntent('api-was-dc1-01 이상감지 분석해줘')
    ).toBe(false);
    expect(
      shouldUseLLMChatArtifactIntent('web-server-01 이상감지 분석해줘')
    ).toBe(false);
    expect(shouldUseLLMChatArtifactIntent('장애 리포트 만들어줘')).toBe(true);
    expect(shouldUseLLMChatArtifactIntent('트렌드 분석 좀 해줘')).toBe(true);
  });
});
