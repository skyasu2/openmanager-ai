/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MonitoringAnalysisArtifact } from '@/lib/ai/chat-artifacts/types';
import { IncidentReportArtifactCard } from './IncidentReportArtifactCard';
import { MonitoringAnalysisArtifactCard } from './MonitoringAnalysisArtifactCard';

vi.mock('@/hooks/ai/useAIEntryController', () => ({
  useAIEntryController: () => ({
    openFullscreen: vi.fn(),
  }),
}));

describe('AI artifact cards', () => {
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

    expect(screen.getByText('source replay-json')).toBeInTheDocument();
    expect(screen.getByText('기준 23:50 KST')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /api-was-dc1-01/i })
    ).toHaveAttribute('href', '/dashboard/servers/api-was-dc1-01');
    expect(screen.getByText('cpu 92%')).toBeInTheDocument();
    expect(
      screen.getByText('api-was-dc1-01 CPU가 90% 임계치를 초과했습니다.')
    ).toBeInTheDocument();
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
    expect(screen.getByText('source unknown')).toBeInTheDocument();
    expect(screen.getByText('기준 현재')).toBeInTheDocument();
  });
});
