/**
 * AI Fallback Handler Tests
 *
 * @description Cloud Run 장애 시 폴백 응답 생성 테스트
 */

import { describe, expect, it } from 'vitest';
import {
  type ApprovalFallbackData,
  createFallbackHttpResponse,
  createFallbackResponse,
  type IncidentReportFallbackData,
  type IntelligentMonitoringFallbackData,
  isFallbackResponse,
  type SupervisorFallbackData,
} from './ai-fallback-handler';

describe('ai-fallback-handler', () => {
  describe('createFallbackResponse', () => {
    describe('supervisor endpoint', () => {
      it('supervisor 폴백 응답을 생성한다', () => {
        const response = createFallbackResponse('supervisor');

        expect(response.success).toBe(true);
        expect(response.source).toBe('fallback');
        expect(response.message).toContain('AI');
        expect(response.retryAfter).toBe(30000);
        expect(response.generatedAt).toBeDefined();
      });

      it('supervisor 데이터에 suggestions이 포함된다', () => {
        const response = createFallbackResponse('supervisor');
        const data = response.data as SupervisorFallbackData;

        expect(data.suggestions).toBeInstanceOf(Array);
        expect(data.suggestions.length).toBeGreaterThan(0);
        expect(data.serverStatus).toBeDefined();
        expect(data.serverStatus?.available).toBe(false);
      });

      it('context를 전달할 수 있다', () => {
        const response = createFallbackResponse('supervisor', {
          sessionId: 'test-session',
          query: '서버 상태',
        });

        expect(response.source).toBe('fallback');
      });
    });

    describe('intelligent-monitoring endpoint', () => {
      it('intelligent-monitoring 폴백 응답을 생성한다', () => {
        const response = createFallbackResponse('intelligent-monitoring');
        const data = response.data as IntelligentMonitoringFallbackData;

        expect(response.success).toBe(true);
        expect(response.source).toBe('fallback');
        expect(data.anomalyDetection).toBeNull();
        expect(data.trendPrediction).toBeNull();
        expect(data.patternAnalysis).toBeNull();
        expect(data.message).toBeDefined();
      });
    });

    describe('incident-report endpoint', () => {
      it('incident-report 폴백 응답을 생성한다', () => {
        const response = createFallbackResponse('incident-report');
        const data = response.data as IncidentReportFallbackData;

        expect(response.success).toBe(true);
        expect(response.source).toBe('fallback');
        expect(data.report).toBeNull();
        expect(data.summary).toBeDefined();
        expect(data.recommendation).toBeDefined();
      });
    });

    describe('approval endpoint', () => {
      it('approval 폴백 응답을 생성한다', () => {
        const response = createFallbackResponse('approval');
        const data = response.data as ApprovalFallbackData;

        expect(response.success).toBe(true);
        expect(response.source).toBe('fallback');
        expect(data.hasPending).toBe(false);
        expect(data.action).toBeNull();
        expect(data.message).toBeDefined();
      });
    });
  });

  describe('isFallbackResponse', () => {
    it('폴백 응답을 올바르게 판별한다', () => {
      const fallback = createFallbackResponse('supervisor');
      expect(isFallbackResponse(fallback)).toBe(true);
    });

    it('일반 객체는 폴백이 아니다', () => {
      const normalResponse = {
        success: true,
        data: { result: 'normal' },
      };
      expect(isFallbackResponse(normalResponse)).toBe(false);
    });

    it('source가 다르면 폴백이 아니다', () => {
      const response = {
        success: true,
        source: 'primary',
        data: {},
      };
      expect(isFallbackResponse(response)).toBe(false);
    });

    it('null은 폴백이 아니다', () => {
      expect(isFallbackResponse(null)).toBe(false);
    });

    it('undefined는 폴백이 아니다', () => {
      expect(isFallbackResponse(undefined)).toBe(false);
    });

    it('문자열은 폴백이 아니다', () => {
      expect(isFallbackResponse('fallback')).toBe(false);
    });
  });

  describe('createFallbackHttpResponse', () => {
    it('HTTP Response 객체를 생성한다', () => {
      const fallback = createFallbackResponse('supervisor');
      const response = createFallbackHttpResponse(fallback);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Fallback-Response')).toBe('true');
    });

    it('커스텀 상태 코드를 설정할 수 있다', () => {
      const fallback = createFallbackResponse('supervisor');
      const response = createFallbackHttpResponse(fallback, 503);

      expect(response.status).toBe(503);
    });

    it('X-Retry-After 헤더가 설정된다', () => {
      const fallback = createFallbackResponse('supervisor');
      const response = createFallbackHttpResponse(fallback);

      expect(response.headers.get('X-Retry-After')).toBe('30000');
    });

    it('응답 본문이 JSON으로 직렬화된다', async () => {
      const fallback = createFallbackResponse('supervisor');
      const response = createFallbackHttpResponse(fallback);
      const body = await response.json();

      expect(body.source).toBe('fallback');
      expect(body.success).toBe(true);
    });
  });

  describe('generatedAt timestamp', () => {
    it('유효한 ISO 문자열 타임스탬프를 생성한다', () => {
      const response = createFallbackResponse('supervisor');
      const date = new Date(response.generatedAt);

      expect(date.getTime()).not.toBeNaN();
    });

    it('현재 시간과 가깝다', () => {
      const before = Date.now();
      const response = createFallbackResponse('supervisor');
      const after = Date.now();

      const generatedTime = new Date(response.generatedAt).getTime();

      expect(generatedTime).toBeGreaterThanOrEqual(before);
      expect(generatedTime).toBeLessThanOrEqual(after);
    });
  });
});
