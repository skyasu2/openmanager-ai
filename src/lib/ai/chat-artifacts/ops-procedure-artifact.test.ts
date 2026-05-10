import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateOpsProcedureArtifact,
  patchOpsProcedureArtifactFromQuery,
  validateOpsProcedureArtifact,
} from './ops-procedure-artifact';

const metricsProviderMock = vi.hoisted(() => ({
  getAllServerMetrics: vi.fn(),
  getSystemSummary: vi.fn(),
}));

vi.mock('@/services/metrics/MetricsProvider', () => ({
  metricsProvider: metricsProviderMock,
}));

describe('ops procedure artifact generator', () => {
  beforeEach(() => {
    metricsProviderMock.getAllServerMetrics.mockResolvedValue([
      {
        serverId: 'api-was-dc1-01',
        hostname: 'api-was-dc1-01',
        status: 'critical',
        cpu: 92,
        memory: 67,
        disk: 55,
        network: 41,
      },
      {
        serverId: 'web-nginx-dc1-01',
        hostname: 'web-nginx-dc1-01',
        status: 'warning',
        cpu: 83,
        memory: 61,
        disk: 50,
        network: 38,
      },
    ]);
    metricsProviderMock.getSystemSummary.mockResolvedValue({
      minuteOfDay: 420,
      totalServers: 18,
      onlineServers: 16,
      warningServers: 1,
      criticalServers: 1,
      offlineServers: 0,
      averageCpu: 51.2,
      averageMemory: 62.4,
      averageDisk: 58.1,
      averageNetwork: 35.6,
    });
  });

  it('builds Slack bash script artifacts without fake internal tool functions or hardcoded webhook URLs', async () => {
    const artifact = await generateOpsProcedureArtifact({
      query: 'CPU 80% 이상 서버 슬랙 알림 bash 스크립트 짜줘',
    });

    expect(artifact).toMatchObject({
      kind: 'ops-procedure',
      procedureType: 'script',
      inputs: {
        metric: 'cpu',
        threshold: 80,
        serverScope: 'all',
        notificationTarget: 'slack-webhook',
      },
      validation: {
        noFakeFunctions: true,
        noHardcodedSecrets: true,
        requiresManualReview: true,
      },
    });
    expect(artifact.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'metric',
          metric: 'cpu',
          serverId: 'api-was-dc1-01',
        }),
      ])
    );
    expect(artifact.codeBlocks[0]).toMatchObject({
      language: 'bash',
      executable: false,
      requiredEnv: expect.arrayContaining(['SLACK_WEBHOOK_URL']),
      safetyLevel: 'notification-only',
    });
    const serialized = JSON.stringify(artifact);
    expect(serialized).toContain('SLACK_WEBHOOK_URL');
    expect(serialized).not.toMatch(/https:\/\/hooks\.slack\.com\/services/i);
    expect(serialized).not.toMatch(
      /filterServers\(|getServerMetrics|searchKnowledgeBase/
    );
  });

  it('prefers Prometheus and Alertmanager YAML for alert rule requests', async () => {
    const artifact = await generateOpsProcedureArtifact({
      query: 'CPU 80% 이상 서버 Slack 알림 Alertmanager 설정 만들어줘',
    });

    expect(artifact.procedureType).toBe('alert-rule');
    expect(artifact.codeBlocks.map((block) => block.language)).toEqual(
      expect.arrayContaining(['yaml', 'promql'])
    );
    expect(JSON.stringify(artifact)).toContain('HighCpuUsage');
    expect(JSON.stringify(artifact)).toContain('SLACK_WEBHOOK_URL');
    expect(validateOpsProcedureArtifact(artifact)).toMatchObject({
      noFakeFunctions: true,
      noHardcodedSecrets: true,
      requiresManualReview: true,
    });
  });

  it('builds log runbook artifacts with log evidence and validation steps', async () => {
    const artifact = await generateOpsProcedureArtifact({
      query: '로그 중 에러/경고 보고 원인과 대응 순서 알려줘',
    });

    expect(artifact.procedureType).toBe('runbook');
    expect(artifact.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'log',
          severity: expect.stringMatching(/warning|critical/),
        }),
      ])
    );
    expect(artifact.runbook.responseSteps.length).toBeGreaterThan(0);
    expect(artifact.runbook.validationSteps.join('\n')).toMatch(
      /journalctl|로그|재확인/
    );
    expect(artifact.codeBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          language: 'markdown',
          executable: false,
        }),
      ])
    );
  });

  it('patches the previous ops procedure threshold instead of creating a new metrics query', async () => {
    const artifact = await generateOpsProcedureArtifact({
      query: 'CPU 80% 이상 서버 슬랙 알림 bash 스크립트 짜줘',
    });
    const patched = patchOpsProcedureArtifactFromQuery(
      artifact,
      '이 스크립트에서 임계치를 90%로 바꿔줘'
    );

    expect(patched.inputs.threshold).toBe(90);
    expect(JSON.stringify(patched.codeBlocks)).toContain('90');
    expect(JSON.stringify(patched.codeBlocks)).not.toContain('THRESHOLD=80');
  });
});
