import { describe, expect, it } from 'vitest';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_PEAK_METRIC_CAPABILITY_ID,
} from './constants';
import {
  parseMonitoringPeakMetricFrame,
  parseMonitoringPeakMetricMessage,
} from './peak-metric-intent';
import { getMonitoringPeakMetric, getPeakMetricSlot } from './peak-metric';
import { monitoringPeakMetricEvidenceProvider } from './peak-metric-evidence-provider';

describe('getPeakMetricSlot', () => {
  it('returns the highest load slot in the recent 24h OTel window', () => {
    const peak = getPeakMetricSlot({ metric: 'load', hours: 24 });

    expect(peak).not.toBeNull();
    expect(peak?.windowHours).toBe(24);
    expect(peak?.slotIndex).toBeGreaterThanOrEqual(0);
    expect(peak?.slotIndex).toBeLessThan(144);
    expect(peak?.timeLabel).toMatch(/^\d{2}:\d{2}$/);
    expect(peak?.requestedMetric).toBe('load');
    expect(peak?.sourceKey).toMatch(/^load[15]$/);
    expect(peak?.value).toBeGreaterThan(0);
    expect(peak?.topServers.length).toBeGreaterThan(0);
    expect(peak?.topServers[0]?.value).toBe(peak?.value);
  });

  it('uses the same helper for non-load metrics', () => {
    const peak = getPeakMetricSlot({ metric: 'cpu', hours: 24 });

    expect(peak).not.toBeNull();
    expect(peak?.requestedMetric).toBe('cpu');
    expect(peak?.sourceKey).toBe('cpu');
    expect(peak?.unit).toBe('%');
    expect(peak?.value).toBeGreaterThan(0);
  });

  it('adapts monitoring peak data for the domain evidence provider', () => {
    const peak = getMonitoringPeakMetric({ metric: 'load', windowHours: 24 });

    expect(peak).not.toBeNull();
    expect(peak?.requestedMetric).toBe('load');
    expect(peak?.sourceLabel).toContain('로드');
    expect(peak?.topServers.length).toBeGreaterThan(0);
  });
});

describe('parseMonitoringPeakMetricMessage', () => {
  it('recognizes concept-level peak load phrasing variants without exact sentence matching', () => {
    const queries = [
      '전체 서버 기준 지난 하루 중 load average가 가장 높았던 시간은?',
      '전체 서버가 최근 24시간 중 제일 힘들었던 순간은? CPU 빼고 로드 기준',
      '최근 하루 시스템 pressure 최대 구간은?',
      '최근 24시간 load가 가장 높았던 구간',
      '최근 하루 부하 최고점 top server',
      '서버명 없이 전체 시스템에서 어제부터 지금까지 load1이 제일 튄 때랑 원인 후보만 알려줘',
    ];

    for (const query of queries) {
      expect(parseMonitoringPeakMetricMessage(query)).toMatchObject({
        metric: 'load',
        windowHours: 24,
      });
    }
  });

  it('does not route general load advice to the peak metric capability', () => {
    expect(
      parseMonitoringPeakMetricMessage('부하가 높으면 조치 방법 알려줘')
    ).toBeNull();
    expect(
      parseMonitoringPeakMetricMessage('최근 하루 부하 조치 방법 알려줘')
    ).toBeNull();
    expect(
      parseMonitoringPeakMetricMessage('최근 24시간 부하가 높으면 조치 방법 알려줘')
    ).toBeNull();
    expect(
      parseMonitoringPeakMetricMessage('최근 하루 load timeout 조치 방법 알려줘')
    ).toBeNull();
    expect(
      parseMonitoringPeakMetricMessage(
        '최근 하루 load 높아서 힘들 때 조치 방법 알려줘'
      )
    ).toBeNull();
  });

  it('P20: does not claim increase-rate ranking phrasing as peak metric intent', () => {
    expect(
      parseMonitoringPeakMetricMessage(
        '최근 CPU 증가율이 가장 높은 서버 알려줘'
      )
    ).toBeNull();
    expect(
      parseMonitoringPeakMetricMessage(
        '지난 24시간 메모리 상승률 상위 서버 보여줘'
      )
    ).toBeNull();
  });

  it('keeps peak questions routable when they also ask for response guidance', () => {
    expect(
      parseMonitoringPeakMetricMessage(
        '최근 하루 load 피크 시간과 대응 방법 알려줘'
      )
    ).toMatchObject({
      metric: 'load',
      windowHours: 24,
    });
  });

  it('keeps message and frame parsing aligned for peak load requests', () => {
    const query = '최근 24시간 load가 가장 높았던 구간';
    const fromMessage = parseMonitoringPeakMetricMessage(query);
    const fromFrame = parseMonitoringPeakMetricFrame({
      requestId: 'peak-frame-parity',
      domainId: MONITORING_DOMAIN_ID,
      message: query,
      messages: [{ role: 'user', content: query }],
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_peak',
        capabilityId: MONITORING_PEAK_METRIC_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        metric: 'load',
        timeWindow: '24h',
        aggregation: 'peak',
        topN: 3,
        ambiguity: 'low',
        confidence: 0.9,
      },
    });

    expect(fromMessage).toMatchObject({
      metric: 'load',
      windowHours: 24,
    });
    expect(fromFrame).toMatchObject({
      capabilityId: MONITORING_PEAK_METRIC_CAPABILITY_ID,
      intent: 'metric_peak',
      metric: 'load',
      windowHours: 24,
    });
  });

  it('does not let current resource pressure rankings use peak metric frames', () => {
    const query = '전체 서버 리소스 압박 순위 알려줘';

    expect(parseMonitoringPeakMetricMessage(query)).toBeNull();
    expect(
      parseMonitoringPeakMetricFrame({
        requestId: 'current-pressure-ranking-frame',
        domainId: MONITORING_DOMAIN_ID,
        message: query,
        messages: [{ role: 'user', content: query }],
        intentFrame: {
          domainId: MONITORING_DOMAIN_ID,
          intent: 'metric_peak',
          capabilityId: MONITORING_PEAK_METRIC_CAPABILITY_ID,
          scope: 'whole_fleet',
          targets: [],
          metric: 'load',
          timeWindow: 'current',
          aggregation: 'peak',
          topN: 5,
          ambiguity: 'low',
          confidence: 0.9,
        },
      })
    ).toBeNull();
  });

  it('keeps composite peak-and-advice requests evidence-bound and read-only', async () => {
    const query = '최근 하루 load 피크 시간과 대응 방법 알려줘';
    const evidence = await monitoringPeakMetricEvidenceProvider.resolve({
      requestId: 'peak-advice-safety',
      domainId: MONITORING_DOMAIN_ID,
      message: query,
      messages: [{ role: 'user', content: query }],
    });

    expect(evidence).not.toBeNull();
    expect(evidence?.prompt).toContain('읽기 전용');
    expect(evidence?.prompt).toContain('패키지 설치');
    expect(evidence?.prompt).toContain('서비스 재시작');
  });

  it('returns deterministic evidence for the 24h CPU/load peak QA query', async () => {
    const query =
      '지난 24시간 동안 전체 서버에서 CPU load가 가장 높았던 시간대는 언제야?';
    const parsed = parseMonitoringPeakMetricMessage(query);
    const evidence = await monitoringPeakMetricEvidenceProvider.resolve({
      requestId: 'peak-qa-24h-cpu-load',
      domainId: MONITORING_DOMAIN_ID,
      message: query,
      messages: [{ role: 'user', content: query }],
    });

    expect(parsed).toMatchObject({
      metric: 'load',
      windowHours: 24,
    });
    expect(evidence?.metadata).toMatchObject({
      metric: 'load',
      sourceMetric: 'load1',
      windowHours: 24,
      responsePolicy: 'deterministic_answer',
    });
    expect(evidence?.fallback).toContain('지난 24시간 기준');
    expect(evidence?.fallback).toMatch(/\d{4}-\d{2}-\d{2}.*\d{2}:\d{2}/);
    expect(evidence?.fallback).toMatch(
      /\b(?:api|web|db|cache|storage|lb|monitoring|batch|worker)-[a-z0-9]+(?:-[a-z0-9]+)*\b/
    );
    expect(evidence?.fallback).toMatch(/\d+(?:\.\d+)?/);
    expect(evidence?.fallback).not.toContain('CPU 사용률 상위 3대');
  });
});
