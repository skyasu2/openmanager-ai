/**
 * Jobs Routes Tests
 *
 * POST /jobs/process, GET /jobs/:id, GET /jobs/:id/progress 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/model-config', () => ({
  validateAPIKeys: vi.fn(() => ({ all: true })),
  logAPIKeyStatus: vi.fn(),
}));

vi.mock('../lib/job-notifier', () => ({
  markJobProcessing: vi.fn(async () => {}),
  storeJobResult: vi.fn(async () => {}),
  storeJobError: vi.fn(async () => {}),
  getJobResult: vi.fn(async () => null),
  updateJobProgress: vi.fn(async () => {}),
  isJobNotifierAvailable: vi.fn(() => true),
  getJobProgress: vi.fn(async () => null),
}));

vi.mock('../services/ai-sdk', () => ({
  executeSupervisorStream: vi.fn(async function* () {
    yield {
      type: 'agent_status',
      data: {
        agent: 'Orchestrator',
        status: 'processing',
        message: '분석 조율 중...',
      },
    };
    yield {
      type: 'handoff',
      data: { from: 'supervisor', to: 'analyst', reason: 'trend analysis' },
    };
    yield {
      type: 'tool_result',
      data: {
        toolName: 'getServerMetrics',
        result: { dataSlot: { slotIndex: 57 } },
      },
    };
    yield { type: 'text_delta', data: 'AI 응답' };
    yield {
      type: 'done',
      data: {
        success: true,
        finalAgent: 'NLQ Agent',
        toolsCalled: ['detectAnomalies'],
        ragSources: [],
        metadata: {
          provider: 'cerebras',
          modelId: 'gpt-oss-120b',
          stepsExecuted: 2,
          durationMs: 500,
          traceId: 'trace-job-123',
          retrieval: {
            retrievalEnabled: true,
            retrievalUsed: false,
            retrievalMode: 'lite',
            suppressedReason: 'no_results',
            evidenceCount: 0,
            webUsed: false,
          },
          handoffs: [
            { from: 'supervisor', to: 'analyst', reason: 'trend analysis' },
          ],
          toolResultSummaries: [
            {
              toolName: 'detectAnomalies',
              label: '이상 탐지',
              summary: '1개 이상 징후를 감지했습니다.',
              status: 'completed',
            },
          ],
        },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      },
    };
  }),
  logProviderStatus: vi.fn(),
}));

import { jobsRouter } from './jobs';
import {
  getJobResult,
  isJobNotifierAvailable,
  markJobProcessing,
  storeJobError,
  storeJobResult,
} from '../lib/job-notifier';
import { executeSupervisorStream } from '../services/ai-sdk';

const app = new Hono();
app.route('/jobs', jobsRouter);

describe('Jobs Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /jobs/process', () => {
    it('유효한 요청으로 job 처리를 완료한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-123',
          messages: [{ role: 'user', content: '서버 상태 확인' }],
          sessionId: 'session-1',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.jobId).toBe('job-123');
      expect(json.status).toBe('completed');
      expect(vi.mocked(executeSupervisorStream)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(storeJobResult)).toHaveBeenCalledWith(
        'job-123',
        'AI 응답',
        expect.objectContaining({
          targetAgent: 'NLQ Agent',
          toolsCalled: ['detectAnomalies'],
          ragSources: [],
          startedAt: expect.any(String),
          toolResults: [
            {
              toolName: 'getServerMetrics',
              result: { dataSlot: { slotIndex: 57 } },
            },
          ],
          metadata: expect.objectContaining({
            traceId: 'trace-job-123',
            retrieval: {
              retrievalEnabled: true,
              retrievalUsed: false,
              retrievalMode: 'lite',
              suppressedReason: 'no_results',
              evidenceCount: 0,
              webUsed: false,
            },
            handoffs: [
              {
                from: 'supervisor',
                to: 'analyst',
                reason: 'trend analysis',
              },
            ],
            toolResultSummaries: [
              {
                toolName: 'detectAnomalies',
                label: '이상 탐지',
                summary: '1개 이상 징후를 감지했습니다.',
                status: 'completed',
              },
            ],
            provider: 'cerebras',
            modelId: 'gpt-oss-120b',
            durationMs: 500,
          }),
        })
      );
    });

    it('stream done provider attempt telemetry를 job metadata에 보존한다', async () => {
      vi.mocked(executeSupervisorStream).mockImplementationOnce(async function* () {
        yield { type: 'text_delta', data: 'fallback 응답' };
        yield {
          type: 'done',
          data: {
            success: true,
            finalAgent: 'Analyst Agent',
            toolsCalled: ['getServerMetrics'],
            ragSources: [],
            metadata: {
              provider: 'groq',
              modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
              usedFallback: true,
              fallbackReason: 'rate_limit',
              durationMs: 1234,
              ttfbMs: 220,
              latencyTier: 'normal',
              providerAttempts: [
                {
                  provider: 'cerebras',
                  modelId: 'llama3.1-8b',
                  attempt: 1,
                  durationMs: 12,
                  error: 'QUOTA_ADMISSION:minute_request_threshold',
                },
                {
                  provider: 'groq',
                  modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
                  attempt: 2,
                  durationMs: 1222,
                },
              ],
            },
          },
        };
      });

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-provider-telemetry',
          messages: [{ role: 'user', content: '위험 서버 조치 알려줘' }],
          sessionId: 'session-provider-telemetry',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(vi.mocked(storeJobResult)).toHaveBeenCalledWith(
        'job-provider-telemetry',
        'fallback 응답',
        expect.objectContaining({
          metadata: expect.objectContaining({
            provider: 'groq',
            modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
            usedFallback: true,
            fallbackReason: 'rate_limit',
            durationMs: 1234,
            ttfbMs: 220,
            latencyTier: 'normal',
            providerAttempts: [
              {
                provider: 'cerebras',
                modelId: 'llama3.1-8b',
                attempt: 1,
                durationMs: 12,
                error: 'QUOTA_ADMISSION:minute_request_threshold',
              },
              {
                provider: 'groq',
                modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
                attempt: 2,
                durationMs: 1222,
              },
            ],
          }),
        })
      );
    });

    it('handoff가 없어도 빈 handoffs 배열을 metadata에 저장한다', async () => {
      vi.mocked(executeSupervisorStream).mockImplementationOnce(async function* () {
        yield { type: 'text_delta', data: '직접 응답' };
        yield {
          type: 'done',
          data: {
            success: true,
            finalAgent: 'Analyst Agent',
            toolsCalled: ['getServerMetrics'],
            ragSources: [],
            metadata: {
              traceId: 'trace-job-empty-handoff',
              handoffs: [],
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          },
        };
      });

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-empty-handoff',
          messages: [{ role: 'user', content: '직접 응답 테스트' }],
          sessionId: 'session-empty-handoff',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(vi.mocked(storeJobResult)).toHaveBeenCalledWith(
        'job-empty-handoff',
        '직접 응답',
        expect.objectContaining({
          metadata: expect.objectContaining({
            traceId: 'trace-job-empty-handoff',
            handoffs: [],
          }),
        })
      );
    });

    it('RAG/Web/analysisMode 옵션을 supervisor stream에 보존한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-tool-options',
          messages: [{ role: 'user', content: '서버 상태 확인' }],
          sessionId: 'session-tool-options',
          analysisMode: 'thinking',
          enableRAG: true,
          enableWebSearch: true,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(vi.mocked(executeSupervisorStream)).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-tool-options',
          analysisMode: 'thinking',
          enableRAG: true,
          enableWebSearch: true,
        })
      );
      expect(vi.mocked(storeJobResult)).toHaveBeenCalledWith(
        'job-tool-options',
        'AI 응답',
        expect.objectContaining({
          metadata: expect.objectContaining({
            analysisMode: 'thinking',
          }),
        })
      );
    });

    it('internalDisclosureMode 옵션을 supervisor stream에 보존한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-internal-disclosure',
          messages: [
            {
              role: 'user',
              content: 'OpenManager OTel SSOT는 어느 파일에 정의돼?',
            },
          ],
          sessionId: 'session-internal-disclosure',
          internalDisclosureMode: 'developer',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(vi.mocked(executeSupervisorStream)).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-internal-disclosure',
          internalDisclosureMode: 'developer',
        })
      );
    });

    it('queryAsOf 데이터 슬롯을 supervisor와 결과 metadata에 보존한다', async () => {
      const queryAsOf = {
        createdAt: '2026-04-29T05:55:00.000Z',
        source: 'vercel-static-otel',
        datasetVersion: '24h-rotating-v1.0.0',
        dataSlot: {
          slotIndex: 89,
          minuteOfDay: 890,
          timeLabel: '14:50 KST',
        },
      };

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-query-as-of',
          messages: [{ role: 'user', content: '현재 DISK 70% 이상 서버' }],
          sessionId: 'session-query-as-of',
          queryAsOf,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(vi.mocked(executeSupervisorStream)).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-query-as-of',
          queryAsOf,
        })
      );
      expect(vi.mocked(storeJobResult)).toHaveBeenCalledWith(
        'job-query-as-of',
        'AI 응답',
        expect.objectContaining({
          metadata: expect.objectContaining({
            queryAsOf,
          }),
        })
      );
    });

    it('semantic intent metadata를 supervisor와 결과 metadata에 보존한다', async () => {
      const intentFrame = {
        domainId: 'openmanager-monitoring',
        intent: 'metric_peak',
        capabilityId: 'monitoring.metric_peak',
        scope: 'whole_fleet',
        targets: [],
        metric: 'load1',
        timeWindow: '24h',
        aggregation: 'peak',
        ambiguity: 'low',
        confidence: 0.95,
      };
      const initialTrace = {
        originalQuery: '지난 24시간 load1 피크 시간대 알려줘',
        selectedDomain: 'openmanager-monitoring',
        selectedCapability: 'monitoring.metric_peak',
        evidenceAvailable: false,
        clarificationRequired: false,
        reasonCodes: [],
      };
      const validatedTrace = {
        ...initialTrace,
        selectedEvidenceProvider: 'monitoring-peak-metric',
        evidenceAvailable: true,
        reasonCodes: ['semantic_frame_evidence_validated'],
      };

      vi.mocked(executeSupervisorStream).mockImplementationOnce(
        async function* () {
          yield { type: 'text_delta', data: 'AI 응답' };
          yield {
            type: 'done',
            data: {
              success: true,
              finalAgent: 'NLQ Agent',
              metadata: {
                semanticQueryTrace: validatedTrace,
              },
            },
          };
        }
      );

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-semantic-trace',
          messages: [
            {
              role: 'user',
              content: '지난 24시간 load1 피크 시간대 알려줘',
            },
          ],
          sessionId: 'session-semantic-trace',
          metadata: {
            intentFrame,
            semanticQueryTrace: initialTrace,
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(vi.mocked(executeSupervisorStream)).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-semantic-trace',
          metadata: expect.objectContaining({
            intentFrame,
            semanticQueryTrace: initialTrace,
          }),
        })
      );
      expect(vi.mocked(storeJobResult)).toHaveBeenCalledWith(
        'job-semantic-trace',
        'AI 응답',
        expect.objectContaining({
          metadata: expect.objectContaining({
            semanticQueryTrace: validatedTrace,
          }),
        })
      );
    });

    it('localRouteDecision을 supervisor stream 요청에 보존한다', async () => {
      const localRouteDecision = {
        intent: 'job',
        executionPath: 'job',
        complexity: 'complex',
        reasonCodes: ['job_queue_api'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'bff',
        providerRawError: 'must not leak',
      };

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-local-route',
          messages: [
            {
              role: 'user',
              content: '전체 서버 장애 원인 분석 보고서 만들어줘',
            },
          ],
          sessionId: 'session-local-route',
          localRouteDecision,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      expect(vi.mocked(executeSupervisorStream)).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-local-route',
          localRouteDecision: expect.objectContaining({
            intent: 'job',
            executionPath: 'job',
            complexity: 'complex',
            reasonCodes: ['job_queue_api'],
            ruleVersion: '2026-05-03-v1',
            decidedBy: 'bff',
          }),
        })
      );
      expect(
        (
          vi.mocked(executeSupervisorStream).mock.calls[0]?.[0] as {
            localRouteDecision?: Record<string, unknown>;
          }
        ).localRouteDecision
      ).not.toHaveProperty('providerRawError');
    });

    it('completed job duplicate delivery는 AI 실행 없이 성공으로 반환한다', async () => {
      vi.mocked(getJobResult).mockResolvedValueOnce({
        status: 'completed',
        result: 'cached response',
        startedAt: '2026-04-28T00:00:00.000Z',
        completedAt: '2026-04-28T00:00:05.000Z',
      });

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-completed-duplicate',
          messages: [{ role: 'user', content: '서버 상태 확인' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        success: true,
        jobId: 'job-completed-duplicate',
        status: 'completed',
        duplicate: true,
      });
      expect(vi.mocked(markJobProcessing)).not.toHaveBeenCalled();
      expect(vi.mocked(executeSupervisorStream)).not.toHaveBeenCalled();
      expect(vi.mocked(storeJobResult)).not.toHaveBeenCalled();
    });

    it('processing job duplicate delivery는 AI 중복 실행 없이 202로 반환한다', async () => {
      vi.mocked(getJobResult).mockResolvedValueOnce({
        status: 'processing',
        startedAt: new Date().toISOString(),
      });

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-processing-duplicate',
          messages: [{ role: 'user', content: '서버 상태 확인' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(202);
      await expect(res.json()).resolves.toMatchObject({
        success: true,
        jobId: 'job-processing-duplicate',
        status: 'processing',
        duplicate: true,
      });
      expect(vi.mocked(markJobProcessing)).not.toHaveBeenCalled();
      expect(vi.mocked(executeSupervisorStream)).not.toHaveBeenCalled();
      expect(vi.mocked(storeJobResult)).not.toHaveBeenCalled();
    });

    it('jobId 누락 시 400을 반환한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('jobId');
    });

    it('messages 누락 시 400을 반환한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({ jobId: 'job-456' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
    });

    it('빈 messages 배열 시 400을 반환한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({ jobId: 'job-789', messages: [] }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
    });

    it('Redis 사용 불가 시 503을 반환한다', async () => {
      vi.mocked(isJobNotifierAvailable).mockReturnValueOnce(false);

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-no-redis',
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.fallback).toBeDefined();
    });

    it('메시지에 content가 없으면 400을 반환한다', async () => {
      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-no-content',
          messages: [{ role: 'user' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
      expect(storeJobError).toHaveBeenCalled();
    });

    it('process 예외 시 내부 메시지 대신 공개 메시지를 반환한다', async () => {
      vi.mocked(markJobProcessing).mockRejectedValueOnce(
        new Error('provider secret leaked')
      );

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-process-error',
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Service unavailable');
      expect(json.error).not.toContain('secret');
    });

    it('동기 처리 예외를 저장할 때 내부 메시지 대신 공개 메시지를 사용한다', async () => {
      vi.mocked(executeSupervisorStream).mockImplementationOnce(async function* () {
        throw new Error('provider secret leaked');
      });

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-background-error',
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.status).toBe('failed');

      expect(vi.mocked(storeJobError).mock.calls).toContainEqual([
        'job-background-error',
        'Service unavailable',
        expect.any(String),
        {
          kind: 'general',
          message: 'Service unavailable',
        },
      ]);
    });

    it('rate limit 실패 시 구조화 errorDetails를 저장한다', async () => {
      const rateLimitError = new Error(
        'Cloud Run AI 엔진 요청 제한으로 15초 후 다시 시도해주세요.'
      ) as Error & {
        details?: {
          kind: 'rate-limit';
          message: string;
          source: 'cloud-run-ai';
          scope: 'minute';
          retryAfterSeconds: number;
          remaining: number;
        };
      };
      rateLimitError.details = {
        kind: 'rate-limit',
        message: 'Cloud Run AI 엔진 요청 제한으로 15초 후 다시 시도해주세요.',
        source: 'cloud-run-ai',
        scope: 'minute',
        retryAfterSeconds: 15,
        remaining: 0,
      };

      vi.mocked(executeSupervisorStream).mockImplementationOnce(async function* () {
        throw rateLimitError;
      });

      const res = await app.request('/jobs/process', {
        method: 'POST',
        body: JSON.stringify({
          jobId: 'job-rate-limit',
          messages: [{ role: 'user', content: 'test' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.status).toBe('failed');
      expect(json.error).toContain('15초 후');

      expect(vi.mocked(storeJobError).mock.calls).toContainEqual([
        'job-rate-limit',
        'Cloud Run AI 엔진 요청 제한으로 15초 후 다시 시도해주세요.',
        expect.any(String),
        {
          kind: 'rate-limit',
          message: 'Cloud Run AI 엔진 요청 제한으로 15초 후 다시 시도해주세요.',
          source: 'cloud-run-ai',
          scope: 'minute',
          retryAfterSeconds: 15,
          remaining: 0,
        },
      ]);
    });
  });

  describe('GET /jobs/:id', () => {
    it('완료된 job 결과를 반환한다', async () => {
      vi.mocked(getJobResult).mockResolvedValueOnce({
        status: 'completed',
        response: 'AI 분석 결과',
        completedAt: '2026-03-03T00:00:00Z',
        processingTimeMs: 1500,
      });

      const res = await app.request('/jobs/job-done');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.jobId).toBe('job-done');
      expect(json.status).toBe('completed');
    });

    it('존재하지 않는 job에 404를 반환한다', async () => {
      vi.mocked(getJobResult).mockResolvedValueOnce(null);

      const res = await app.request('/jobs/job-missing');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /jobs/:id/progress', () => {
    it('완료된 job의 진행률을 반환한다', async () => {
      vi.mocked(getJobResult).mockResolvedValueOnce({
        status: 'completed',
        completedAt: '2026-03-03T00:00:00Z',
        processingTimeMs: 2000,
      });

      const res = await app.request('/jobs/job-prog/progress');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.progress).toBe(100);
      expect(json.status).toBe('completed');
    });

    it('존재하지 않는 job에 404를 반환한다', async () => {
      vi.mocked(getJobResult).mockResolvedValueOnce(null);

      const res = await app.request('/jobs/job-none/progress');

      expect(res.status).toBe(404);
    });
  });
});
