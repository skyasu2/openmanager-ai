/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MONITORING_ARTIFACT_DOMAIN_ID } from '@/lib/ai/chat-artifacts/artifact-workspace-registry';
import type {
  MonitoringAnalysisArtifact,
  ServerMonitoringAnalysisArtifact,
  ServerSnapshotArtifact,
} from '@/lib/ai/chat-artifacts/types';
import {
  ARTIFACT_CONTRACT_VERSION,
  createArtifactEnvelope,
} from '@/lib/ai/chat-artifacts/types';
import { ArtifactRendererHost } from './domain-renderers/ArtifactRendererHost';
import { IncidentReportArtifactCard } from './IncidentReportArtifactCard';
import { MonitoringAnalysisArtifactCard } from './MonitoringAnalysisArtifactCard';
import { ServerSnapshotArtifactCard } from './ServerSnapshotArtifactCard';

vi.mock('@/hooks/ai/useAIEntryController', () => ({
  useAIEntryController: () => ({
    openFullscreen: vi.fn(),
  }),
}));

const opsProcedureArtifact = {
  kind: 'ops-procedure',
  generatedAt: '2026-05-11T00:00:00.000Z',
  title: 'CPU 80% Slack 알림 운영 절차',
  summary: 'CPU 80% 이상 서버를 확인하고 Slack 알림 템플릿을 제공합니다.',
  procedureType: 'script',
  source: 'otel-static',
  inputs: {
    metric: 'cpu',
    threshold: 80,
    serverScope: 'all',
    timeWindowMinutes: 10,
    notificationTarget: 'slack-webhook',
  },
  evidence: [
    {
      id: 'metric-cpu-threshold',
      kind: 'metric',
      summary: '현재 OTel snapshot 기준 CPU 상위 서버를 확인했습니다.',
      metric: 'cpu',
      severity: 'warning',
    },
  ],
  runbook: {
    symptoms: ['CPU 80% 이상 서버가 Slack 알림 대상입니다.'],
    likelyCauses: ['트래픽 증가 또는 프로세스 과점유'],
    responseSteps: ['CPU 상위 프로세스를 확인합니다.'],
    validationSteps: ['알림 발송 후 CPU 사용률을 재확인합니다.'],
    rollbackOrStopConditions: [
      '잘못된 webhook 또는 과도한 알림이면 중단합니다.',
    ],
    limitations: ['자동 실행되지 않는 템플릿입니다.'],
  },
  codeBlocks: [
    {
      id: 'slack-cpu-alert-bash',
      title: 'Slack CPU threshold alert script',
      language: 'bash',
      content: 'SLACK_WEBHOOK_URL="$SLACK_WEBHOOK_URL"\nTHRESHOLD=80',
      executable: false,
      requiredEnv: ['SLACK_WEBHOOK_URL'],
      safetyLevel: 'notification-only',
      notes: ['Webhook URL은 secret으로 주입합니다.'],
    },
  ],
  validation: {
    noFakeFunctions: true,
    noHardcodedSecrets: true,
    requiresManualReview: true,
  },
} as const;

const serverMonitoringArtifact: ServerMonitoringAnalysisArtifact = {
  kind: 'server-monitoring-analysis',
  generatedAt: '2026-05-13T00:00:00.000Z',
  title: '웹 서버 01 이상감지/추세 분석',
  summary: '웹 서버 01 상태 정상',
  serverId: 'server-1',
  serverName: '웹 서버 01',
  overallStatus: 'online',
  analysis: {
    success: true,
    serverId: 'server-1',
    analysisType: 'full',
    timestamp: '2026-05-13T00:00:00.000Z',
  },
  server: {
    success: true,
    serverId: 'server-1',
    serverName: '웹 서버 01',
    analysisType: 'full',
    timestamp: '2026-05-13T00:00:00.000Z',
    overallStatus: 'online',
  },
  dataSlot: '07:00 KST',
  sourceMode: 'tool-result',
};

describe('AI artifact cards', () => {
  it('renders ops procedure artifact cards through the domain renderer host', () => {
    const envelope = createArtifactEnvelope(opsProcedureArtifact, {
      domainId: MONITORING_ARTIFACT_DOMAIN_ID,
      artifactVersion: ARTIFACT_CONTRACT_VERSION,
      sourceMode: 'otel-static',
      dataSlot: '07:00 KST',
    });

    render(
      <ArtifactRendererHost
        metadata={{
          artifactEnvelopes: [envelope],
        }}
      />
    );

    expect(screen.getByText('운영 절차')).toBeInTheDocument();
    expect(
      screen.getByText('CPU 80% Slack 알림 운영 절차')
    ).toBeInTheDocument();
    expect(screen.getByText('script')).toBeInTheDocument();
    expect(screen.getByText('SLACK_WEBHOOK_URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MD 다운로드/i })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /JSON 다운로드/i })
    ).toBeEnabled();
  });

  it('renders selected server monitoring artifacts through the domain renderer host', () => {
    const envelope = createArtifactEnvelope(serverMonitoringArtifact, {
      domainId: MONITORING_ARTIFACT_DOMAIN_ID,
      artifactVersion: ARTIFACT_CONTRACT_VERSION,
      sourceMode: 'tool-result',
      dataSlot: '07:00 KST',
    });

    render(
      <ArtifactRendererHost
        metadata={{
          artifactEnvelopes: [envelope],
        }}
      />
    );

    expect(
      screen.getByText('단일 서버 이상감지/추세 분석')
    ).toBeInTheDocument();
    expect(
      screen.getByText('웹 서버 01 이상감지/추세 분석')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '웹 서버 01' })).toHaveAttribute(
      'href',
      '/dashboard/servers/server-1'
    );
    expect(screen.getByRole('button', { name: /Markdown/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /JSON/i })).toBeEnabled();
  });

  it('renders incident report artifact actions', () => {
    render(
      <IncidentReportArtifactCard
        artifact={{
          kind: 'incident-report',
          generatedAt: '2026-05-02T00:00:00.000Z',
          report: {
            id: 'incident-artifact-1',
            title: 'DB 메모리 경고',
            severity: 'warning',
            timestamp: new Date('2026-05-02T00:00:00.000Z'),
            affectedServers: ['db-mysql-dc1-primary'],
            description: '메모리 사용률이 높습니다.',
            status: 'active',
          },
        }}
      />
    );

    expect(screen.getByText('장애 보고서')).toBeInTheDocument();
    expect(screen.getByText('DB 메모리 경고')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MD 다운로드/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /TXT 다운로드/i })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /장애 보고서 작성에서 보기/i })
    ).toBeEnabled();
  });

  it('renders incident report artifact detail payload without another API call', () => {
    render(
      <IncidentReportArtifactCard
        artifact={{
          kind: 'incident-report',
          generatedAt: '2026-05-02T00:00:00.000Z',
          report: {
            id: 'incident-artifact-2',
            title: 'API CPU 포화',
            severity: 'critical',
            timestamp: new Date('2026-05-02T00:00:00.000Z'),
            affectedServers: ['api-was-dc1-01'],
            description: 'API 서버 CPU가 임계치를 초과했습니다.',
            status: 'active',
            recommendations: [
              {
                action: 'API worker 수를 임시 증설',
                priority: 'high',
                expected_impact: '응답 지연 완화',
              },
            ],
            anomalies: [
              {
                server_id: 'api-was-dc1-01',
                server_name: 'api-was-dc1-01',
                metric: 'cpu',
                value: 94,
                severity: 'critical',
              },
            ],
            timeline: [
              {
                timestamp: '2026-05-02T00:00:00.000Z',
                event: 'CPU 임계치 초과',
                severity: 'critical',
              },
            ],
          },
        }}
      />
    );

    expect(
      screen.getByRole('link', { name: /api-was-dc1-01/i })
    ).toHaveAttribute('href', '/dashboard/servers/api-was-dc1-01');
    expect(screen.getByText('API worker 수를 임시 증설')).toBeInTheDocument();
    expect(screen.getByText(/cpu 94%/i)).toBeInTheDocument();
    expect(screen.getByText('CPU 임계치 초과')).toBeInTheDocument();
  });

  it('renders monitoring analysis artifact actions', () => {
    render(
      <MonitoringAnalysisArtifactCard
        artifact={{
          kind: 'monitoring-analysis',
          generatedAt: '2026-05-02T00:01:00.000Z',
          title: '전체 서버 이상감지/추세 분석',
          summary: '18개 서버 분석 완료, 주의 1대',
          serverCount: 18,
          riskSignalCount: 1,
          warningServers: 1,
          criticalServers: 0,
          analysis: {
            success: true,
            sourceMode: 'replay-json',
            queryAsOf: '2026-05-02T00:00:00.000Z',
            slot: {
              slotIndex: 143,
              hour: 23,
              slotInHour: 5,
              minuteOfDay: 1430,
              timeLabel: '23:50 KST',
              startTime: '2026-05-02T00:00:00.000Z',
              endTime: '2026-05-02T00:10:00.000Z',
            },
            summary: '18개 서버 분석 완료',
            servers: [],
            riskSignals: [],
            evidenceRefs: [],
            dataFreshness: {
              generatedAt: null,
              sourceUpdatedAt: null,
              stale: false,
            },
          },
        }}
      />
    );

    expect(screen.getByText('이상감지/추세 분석')).toBeInTheDocument();
    expect(
      screen.getByText('전체 서버 이상감지/추세 분석')
    ).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MD 다운로드/i })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /JSON 다운로드/i })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /이상감지\/추세에서 보기/i })
    ).toBeEnabled();
  });

  it('renders monitoring analysis risk and evidence payload without another API call', () => {
    render(
      <MonitoringAnalysisArtifactCard
        artifact={{
          kind: 'monitoring-analysis',
          generatedAt: '2026-05-02T00:01:00.000Z',
          title: '전체 서버 이상감지/추세 분석',
          summary: '18개 서버 분석 완료, 위험 신호 1건',
          serverCount: 18,
          riskSignalCount: 1,
          warningServers: 0,
          criticalServers: 1,
          analysis: {
            success: true,
            sourceMode: 'replay-json',
            queryAsOf: '2026-05-02T00:00:00.000Z',
            slot: {
              slotIndex: 143,
              hour: 23,
              slotInHour: 5,
              minuteOfDay: 1430,
              timeLabel: '23:50 KST',
              startTime: '2026-05-02T00:00:00.000Z',
              endTime: '2026-05-02T00:10:00.000Z',
            },
            summary: '18개 서버 분석 완료',
            servers: [
              {
                id: 'api-was-dc1-01',
                name: 'api-was-dc1-01',
                type: 'api',
                status: 'critical',
                cpu: 92,
                memory: 73,
                disk: 61,
                network: 44,
              },
            ],
            riskSignals: [
              {
                id: 'risk-api-cpu',
                serverId: 'api-was-dc1-01',
                serverName: 'api-was-dc1-01',
                serverType: 'api',
                metric: 'cpu',
                value: 92,
                threshold: 90,
                trend: 'up',
                severity: 'critical',
                evidenceRefId: 'evidence-api-cpu',
              },
            ],
            evidenceRefs: [
              {
                id: 'evidence-api-cpu',
                kind: 'metric',
                serverId: 'api-was-dc1-01',
                metric: 'cpu',
                timeRange: {
                  from: '2026-05-02T00:00:00.000Z',
                  to: '2026-05-02T00:10:00.000Z',
                },
                summary: 'api-was-dc1-01 CPU가 90% 임계치를 초과했습니다.',
                value: 92,
                threshold: 90,
                severity: 'critical',
              },
            ],
            dataFreshness: {
              generatedAt: '2026-05-02T00:00:00.000Z',
              sourceUpdatedAt: '2026-05-02T00:00:00.000Z',
              stale: false,
            },
          },
        }}
      />
    );

    expect(
      screen.getByText('데이터 OpenTelemetry snapshot')
    ).toBeInTheDocument();
    expect(screen.getByText('기준 23:50 KST')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /api-was-dc1-01/i })
    ).toHaveAttribute('href', '/dashboard/servers/api-was-dc1-01');
    expect(screen.getByText('cpu 92%')).toBeInTheDocument();
    expect(
      screen.getByText('api-was-dc1-01 CPU가 90% 임계치를 초과했습니다.')
    ).toBeInTheDocument();
  });

  it('prefers MonitoringFactPack signals and evidence over legacy risk payloads', () => {
    const artifact = {
      kind: 'monitoring-analysis',
      generatedAt: '2026-05-02T00:01:00.000Z',
      title: '전체 서버 이상감지/추세 분석',
      summary: '18개 서버 분석 완료, fact pack 위험 신호 1건',
      serverCount: 18,
      riskSignalCount: 1,
      warningServers: 0,
      criticalServers: 1,
      analysis: {
        success: true,
        sourceMode: 'replay-json',
        queryAsOf: '2026-05-02T00:00:00.000Z',
        slot: {
          slotIndex: 143,
          hour: 23,
          slotInHour: 5,
          minuteOfDay: 1430,
          timeLabel: '23:50 KST',
          startTime: '2026-05-02T00:00:00.000Z',
          endTime: '2026-05-02T00:10:00.000Z',
        },
        summary: '18개 서버 분석 완료',
        servers: [],
        riskSignals: [
          {
            id: 'legacy-risk-api-cpu',
            serverId: 'api-was-dc1-01',
            serverName: 'api-was-dc1-01',
            serverType: 'api',
            metric: 'cpu',
            value: 41,
            threshold: 90,
            trend: 'stable',
            severity: 'warning',
            evidenceRefId: 'legacy-evidence-api-cpu',
          },
        ],
        evidenceRefs: [
          {
            id: 'legacy-evidence-api-cpu',
            kind: 'metric',
            serverId: 'api-was-dc1-01',
            metric: 'cpu',
            timeRange: {
              from: '2026-05-02T00:00:00.000Z',
              to: '2026-05-02T00:10:00.000Z',
            },
            summary:
              'Legacy evidence should not render while fact pack exists.',
            value: 41,
            threshold: 90,
            severity: 'warning',
          },
        ],
        factPack: {
          factPackVersion: '2026-05-03-v1',
          dataSlot: '23:50 KST',
          sourceMode: 'replay-json',
          queryAsOf: '2026-05-02T00:00:00.000Z',
          thresholds: {
            cpu: { warning: 80, critical: 90 },
            memory: { warning: 80, critical: 90 },
            disk: { warning: 80, critical: 90 },
            network: { warning: 80, critical: 90 },
          },
          summary: {
            total: 18,
            online: 17,
            warning: 0,
            critical: 1,
            offline: 0,
          },
          signals: [
            {
              id: 'fact-api-cpu',
              serverId: 'api-was-dc1-01',
              serverName: 'api-was-dc1-01',
              serverType: 'api',
              metric: 'cpu',
              value: 95,
              threshold: 90,
              thresholdLevel: 'critical',
              severity: 'critical',
              evidenceRefId: 'evidence-api-cpu',
            },
          ],
          evidenceRefs: [
            {
              id: 'evidence-api-cpu',
              kind: 'metric',
              serverId: 'api-was-dc1-01',
              metric: 'cpu',
              timeRange: {
                from: '2026-05-02T00:00:00.000Z',
                to: '2026-05-02T00:10:00.000Z',
              },
              summary:
                'FactPack 기준 api-was-dc1-01 CPU가 critical 임계치를 초과했습니다.',
              value: 95,
              threshold: 90,
              severity: 'critical',
            },
          ],
        },
        dataFreshness: {
          generatedAt: '2026-05-02T00:00:00.000Z',
          sourceUpdatedAt: '2026-05-02T00:00:00.000Z',
          stale: false,
        },
      },
    } as unknown as MonitoringAnalysisArtifact;

    render(<MonitoringAnalysisArtifactCard artifact={artifact} />);

    expect(screen.getByText('cpu 95%')).toBeInTheDocument();
    expect(
      screen.getByText(
        'FactPack 기준 api-was-dc1-01 CPU가 critical 임계치를 초과했습니다.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('cpu 41%')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Legacy evidence should not render while fact pack exists.'
      )
    ).not.toBeInTheDocument();
  });

  it('renders restored monitoring artifacts defensively when optional payload sections are missing', () => {
    const restoredArtifact = {
      kind: 'monitoring-analysis',
      generatedAt: '2026-05-02T00:01:00.000Z',
      title: '복원된 이상감지/추세 분석',
      summary: 'legacy metadata',
      serverCount: 0,
      riskSignalCount: 0,
      warningServers: 0,
      criticalServers: 0,
      analysis: {
        success: true,
        servers: [],
        riskSignals: [],
      },
    } as unknown as MonitoringAnalysisArtifact;

    render(<MonitoringAnalysisArtifactCard artifact={restoredArtifact} />);

    expect(screen.getByText('복원된 이상감지/추세 분석')).toBeInTheDocument();
    expect(screen.getByText('데이터 Monitoring snapshot')).toBeInTheDocument();
    expect(screen.getByText('기준 현재')).toBeInTheDocument();
  });

  it('renders server snapshot artifact status, links, and download actions', () => {
    const artifact: ServerSnapshotArtifact = {
      kind: 'server-snapshot',
      generatedAt: '2026-05-02T22:00:00.000Z',
      title: '현재 서버 상태 스냅샷',
      summary: '4대 서버 중 위험 1대, 주의 1대, 오프라인 1대입니다.',
      source: 'otel-static',
      slot: {
        slotIndex: 42,
        minuteOfDay: 420,
        timeLabel: '07:00 KST',
      },
      totals: {
        total: 4,
        online: 1,
        warning: 1,
        critical: 1,
        offline: 1,
      },
      averages: {
        cpu: 60,
        memory: 67.8,
        disk: 56.8,
        network: 35,
      },
      topServers: [
        {
          id: 'web-01',
          name: 'web-01',
          status: 'critical',
          cpu: 92.4,
          memory: 71.2,
          disk: 62.1,
          network: 55.4,
          primaryRisk: 'cpu',
        },
      ],
      alerts: [
        {
          serverId: 'web-01',
          metric: 'cpu',
          value: 92.4,
          severity: 'critical',
          summary: 'web-01 CPU 92.4%',
        },
      ],
    };

    render(<ServerSnapshotArtifactCard artifact={artifact} />);

    expect(screen.getByText('서버 상태 스냅샷')).toBeInTheDocument();
    expect(screen.getByText('현재 서버 상태 스냅샷')).toBeInTheDocument();
    expect(screen.getByText('source otel-static')).toBeInTheDocument();
    expect(screen.getByText('기준 07:00 KST')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('CPU 60%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /web-01/i })).toHaveAttribute(
      'href',
      '/dashboard/servers/web-01'
    );
    expect(screen.getByText('web-01 CPU 92.4%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MD 다운로드/i })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /JSON 다운로드/i })
    ).toBeEnabled();
  });

  it('renders restored server snapshot artifacts defensively when optional sections are missing', () => {
    const restoredArtifact = {
      kind: 'server-snapshot',
      generatedAt: '2026-05-02T22:00:00.000Z',
      title: '복원된 서버 상태 스냅샷',
      summary: 'legacy metadata',
      source: 'otel-static',
      totals: {
        total: 0,
        online: 0,
        warning: 0,
        critical: 0,
        offline: 0,
      },
      averages: {
        cpu: 0,
        memory: 0,
        disk: 0,
        network: 0,
      },
    } as unknown as ServerSnapshotArtifact;

    render(<ServerSnapshotArtifactCard artifact={restoredArtifact} />);

    expect(screen.getByText('복원된 서버 상태 스냅샷')).toBeInTheDocument();
    expect(screen.getByText('기준 현재')).toBeInTheDocument();
    expect(screen.getByText('표시할 위험 상위 서버 없음')).toBeInTheDocument();
  });

  it('renders restored server snapshot artifacts defensively when summary is missing', () => {
    const restoredArtifact = {
      kind: 'server-snapshot',
      generatedAt: '2026-05-02T22:00:00.000Z',
      title: '복원된 서버 상태 스냅샷',
      source: 'otel-static',
      totals: {
        total: 0,
        online: 0,
        warning: 0,
        critical: 0,
        offline: 0,
      },
      averages: {
        cpu: 0,
        memory: 0,
        disk: 0,
        network: 0,
      },
    } as unknown as ServerSnapshotArtifact;

    render(<ServerSnapshotArtifactCard artifact={restoredArtifact} />);

    expect(screen.getByText('요약 정보 없음')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('uses shared server snapshot fallback readers while keeping card display capped', () => {
    const restoredArtifact = {
      kind: 'server-snapshot',
      generatedAt: '2026-05-02T22:00:00.000Z',
      title: '복원된 서버 상태 스냅샷',
      summary: 'legacy metadata',
      source: 'otel-static',
      queryAsOfDataSlot: {
        slotIndex: 42,
        minuteOfDay: 420,
        timeLabel: '07:00 KST',
      },
      totals: {
        total: 4,
        online: 1,
        warning: 1,
        critical: 1,
        offline: 1,
      },
      averages: {
        cpu: 60,
        memory: 67.8,
        disk: 56.8,
        network: 35,
      },
      topServers: [
        {
          id: 'server-01',
          name: 'server-01',
          status: 'critical',
          cpu: 91,
          memory: 70,
          disk: 60,
          network: 40,
          primaryRisk: 'cpu',
        },
        {
          id: 'server-02',
          name: 'server-02',
          status: 'warning',
          cpu: 82,
          memory: 68,
          disk: 66,
          network: 41,
          primaryRisk: 'cpu',
        },
        {
          id: 'server-03',
          name: 'server-03',
          status: 'warning',
          cpu: 78,
          memory: 74,
          disk: 55,
          network: 45,
          primaryRisk: 'cpu',
        },
        {
          id: 'server-04',
          name: 'server-04',
          status: 'online',
          cpu: 71,
          memory: 65,
          disk: 52,
          network: 35,
          primaryRisk: 'cpu',
        },
      ],
      alerts: [
        {
          serverId: 'alert-01',
          metric: 'cpu',
          value: 91,
          severity: 'critical',
          summary: 'alert-01 CPU 91%',
        },
        {
          serverId: 'alert-02',
          metric: 'memory',
          value: 88,
          severity: 'warning',
          summary: 'alert-02 MEMORY 88%',
        },
        {
          serverId: 'alert-03',
          metric: 'disk',
          value: 81,
          severity: 'warning',
          summary: 'alert-03 DISK 81%',
        },
        {
          serverId: 'alert-04',
          metric: 'network',
          value: 77,
          severity: 'warning',
          summary: 'alert-04 NETWORK 77%',
        },
      ],
    } as ServerSnapshotArtifact;

    render(<ServerSnapshotArtifactCard artifact={restoredArtifact} />);

    expect(screen.getByText('기준 07:00 KST')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /server-01/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /server-03/i })).toBeVisible();
    expect(
      screen.queryByRole('link', { name: /server-04/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText('alert-01 CPU 91%')).toBeInTheDocument();
    expect(screen.getByText('alert-03 DISK 81%')).toBeInTheDocument();
    expect(screen.queryByText('alert-04 NETWORK 77%')).not.toBeInTheDocument();
  });
});
