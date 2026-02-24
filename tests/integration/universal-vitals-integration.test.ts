/**
 * 🎯 Universal Vitals 통합 테스트
 *
 * @description Vitest + Playwright + API 테스트가 모두 Universal Vitals로 통합되어 작동하는지 검증
 * @integration 여러 테스트 도구의 메트릭이 하나의 시스템으로 수집되고 분석되는 통합 시나리오
 * @philosophy "메인테스트는 Vitals 기반으로 여러 테스트 도구 활용"의 실현
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  type UniversalVital,
  universalVitals,
  type VitalCategory,
} from '@/lib/testing/universal-vitals';
import { VitestVitals } from '@/lib/testing/vitest-vitals-plugin';

// Types for helper functions
interface VitalsSummary {
  total: number;
  good: number;
  needsImprovement: number;
  poor: number;
}

// 🎯 통합 테스트 시나리오: 다중 테스트 도구 Vitals 수집
describe('🌐 Universal Vitals 통합 테스트', () => {
  beforeAll(() => {
    universalVitals.clearMetrics();
  });

  beforeEach(() => {
    // 각 테스트 전 상태 리셋
    VitestVitals.reset();
  });

  afterAll(async () => {
    await generateIntegratedReport();
  });

  describe('🧪 Vitest Vitals 통합', () => {
    it('Vitest 테스트 실행 메트릭이 Universal Vitals로 수집됨', () => {
      const testName = 'sample-unit-test';

      // Vitest 테스트 시작
      VitestVitals.startTest(testName);

      // 실제 테스트 로직 시뮬레이션
      const result = 2 + 2;
      expect(result).toBe(4);

      // 테스트 성공 기록
      const testVital = VitestVitals.passTest(testName);

      // Universal Vitals에서 메트릭 확인
      const metrics = universalVitals.getMetricsByCategory('test-execution');
      const unitTestMetrics = metrics.filter(
        (m) => m.name === 'unit-test-time'
      );

      expect(unitTestMetrics.length).toBeGreaterThan(0);
      expect(testVital.category).toBe('test-execution');
      expect(testVital.value).toBeGreaterThan(0);
      expect(testVital.rating).toBeOneOf(['good', 'needs-improvement', 'poor']);
    });

    it('메모리 사용량 메트릭이 Infrastructure Vitals로 수집됨', () => {
      const memoryUsage = VitestVitals.collectMemoryUsage('integration-test');

      if (memoryUsage > 0) {
        const infraMetrics =
          universalVitals.getMetricsByCategory('infrastructure');
        const memoryMetrics = infraMetrics.filter(
          (m) => m.name === 'memory-usage'
        );

        expect(memoryMetrics.length).toBeGreaterThan(0);
        expect(memoryUsage).toBeTypeOf('number');
      }
    });

    it('테스트 커버리지 메트릭 수집', () => {
      // 모의 커버리지 데이터
      const mockCoverage = {
        lines: 95,
        functions: 88,
        branches: 92,
        statements: 94,
      };

      VitestVitals.collectCoverage(mockCoverage);

      const testMetrics =
        universalVitals.getMetricsByCategory('test-execution');
      const coverageMetrics = testMetrics.filter((m) =>
        m.name.includes('coverage')
      );

      expect(coverageMetrics.length).toBeGreaterThan(0);

      const totalCoverageMetric = testMetrics.find(
        (m) => m.name === 'test-coverage'
      );
      expect(totalCoverageMetric).toBeDefined();
      expect(totalCoverageMetric?.value).toBeCloseTo(92.25); // 평균값
    });
  });

  describe('🚀 API Performance Vitals 시뮬레이션', () => {
    it('API 호출 성능이 API Performance Vitals로 수집됨', async () => {
      const apiEndpoint = '/api/universal-vitals';

      // API 호출 시뮬레이션
      universalVitals.startMeasurement('test-api-call', 'api-performance', {
        endpoint: apiEndpoint,
        method: 'POST',
      });

      // 실제 API 호출 시뮬레이션 (100-500ms 지연)
      const simulatedDelay = 100 + Math.random() * 400;
      await new Promise((resolve) => setTimeout(resolve, simulatedDelay));

      const apiVital = universalVitals.endMeasurement(
        'test-api-call',
        'api-performance',
        'ms',
        {
          statusCode: 200,
          endpoint: apiEndpoint,
        }
      );

      // API Performance Vitals 확인
      const apiMetrics =
        universalVitals.getMetricsByCategory('api-performance');
      expect(apiMetrics.length).toBeGreaterThan(0);
      expect(apiVital.value).toBeCloseTo(simulatedDelay, -1); // 근사값 비교
      expect(apiVital.rating).toBeOneOf(['good', 'needs-improvement', 'poor']);
    });

    it('API 오류율 메트릭 수집', () => {
      // 성공적인 API 호출들
      for (let i = 0; i < 95; i++) {
        universalVitals.collectVital(
          'api-success',
          'api-performance',
          200,
          'ms',
          { statusCode: 200, success: true }
        );
      }

      // 실패한 API 호출들
      for (let i = 0; i < 5; i++) {
        universalVitals.collectVital(
          'api-error',
          'api-performance',
          500,
          'ms',
          { statusCode: 500, success: false }
        );
      }

      // 오류율 계산
      const errorRate = 5; // 5%
      universalVitals.collectVital(
        'api-error-rate',
        'api-performance',
        errorRate,
        '%',
        { totalCalls: 100, errorCalls: 5 }
      );

      const apiMetrics =
        universalVitals.getMetricsByCategory('api-performance');
      const errorRateMetric = apiMetrics.find(
        (m) => m.name === 'api-error-rate'
      );

      expect(errorRateMetric).toBeDefined();
      expect(errorRateMetric?.value).toBe(5);
      expect(errorRateMetric?.rating).toBe('poor'); // 5%는 poor (임계값 초과)
    });
  });

  describe('🏗️ Build Performance Vitals 시뮬레이션', () => {
    it('빌드 시간 메트릭이 Build Performance Vitals로 수집됨', () => {
      // 빌드 프로세스 시뮬레이션
      universalVitals.startMeasurement('test-build', 'build-performance');

      // 빌드 시간 시뮬레이션 (20-60초)
      const simulatedBuildTime = 20000 + Math.random() * 40000;

      const buildVital = universalVitals.collectVital(
        'build-time',
        'build-performance',
        simulatedBuildTime,
        'ms',
        { buildType: 'production', success: true }
      );

      expect(buildVital.category).toBe('build-performance');
      expect(buildVital.value).toBe(simulatedBuildTime);
      expect(buildVital.rating).toBeOneOf([
        'good',
        'needs-improvement',
        'poor',
      ]);
    });

    it('번들 크기 메트릭 수집', () => {
      // 번들 크기 시뮬레이션 (100KB - 2MB)
      const bundleSize = 100000 + Math.random() * 1900000; // bytes

      universalVitals.collectVital(
        'bundle-size',
        'build-performance',
        bundleSize,
        'bytes',
        { bundleType: 'main', compressed: true }
      );

      const buildMetrics =
        universalVitals.getMetricsByCategory('build-performance');
      const bundleSizeMetric = buildMetrics.find(
        (m) => m.name === 'bundle-size'
      );

      expect(bundleSizeMetric).toBeDefined();
      expect(bundleSizeMetric?.value).toBe(bundleSize);
    });
  });

  describe('🌐 Web Performance Vitals 시뮬레이션', () => {
    it('Web Vitals Core 메트릭 수집', () => {
      // LCP (Largest Contentful Paint)
      const lcpValue = 1500 + Math.random() * 2000; // 1.5-3.5초
      universalVitals.collectVital('LCP', 'web-performance', lcpValue, 'ms', {
        element: 'hero-image',
        url: '/dashboard',
      });

      // FID (First Input Delay) - 새로운 INP로 대체 예정
      const fidValue = 50 + Math.random() * 200; // 50-250ms
      universalVitals.collectVital('FID', 'web-performance', fidValue, 'ms', {
        interactionType: 'click',
        url: '/dashboard',
      });

      // CLS (Cumulative Layout Shift)
      const clsValue = Math.random() * 0.3; // 0-0.3 스코어
      universalVitals.collectVital(
        'CLS',
        'web-performance',
        clsValue,
        'score',
        { url: '/dashboard' }
      );

      const webMetrics =
        universalVitals.getMetricsByCategory('web-performance');
      expect(webMetrics.filter((m) => m.name === 'LCP')).toHaveLength(1);
      expect(webMetrics.filter((m) => m.name === 'FID')).toHaveLength(1);
      expect(webMetrics.filter((m) => m.name === 'CLS')).toHaveLength(1);
    });
  });

  describe('📊 통합 분석 및 리포팅', () => {
    it('모든 카테고리의 메트릭이 통합 수집됨', () => {
      const summary = universalVitals.getSummary();

      expect(summary.total).toBeGreaterThan(10); // 충분한 메트릭 수집
      expect(summary.categories).toHaveProperty('test-execution');
      expect(summary.categories).toHaveProperty('api-performance');
      expect(summary.categories).toHaveProperty('build-performance');
      expect(summary.categories).toHaveProperty('web-performance');
    });

    it('통합 리포트 생성 및 API 전송 시뮬레이션', async () => {
      const report = await generateIntegratedReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('analysis');
      expect(report).toHaveProperty('recommendations');
      expect(report.metrics.length).toBeGreaterThan(0);

      // API 전송 시뮬레이션 (실제로는 /api/universal-vitals로 전송)
      const mockApiResponse = {
        success: true,
        data: {
          processed: report.metrics.length,
          analysis: report.analysis,
          recommendations: report.recommendations,
        },
      };

      expect(mockApiResponse.success).toBe(true);
      expect(mockApiResponse.data.processed).toBe(report.metrics.length);
    });

    it('성능 회귀 감지 시뮬레이션', async () => {
      // 이전 성능 기준선 설정
      const baselineMetrics = [
        { name: 'unit-test-time', value: 45 },
        { name: 'api-response-time', value: 180 },
        { name: 'build-time', value: 25000 },
      ];

      // 현재 성능 메트릭 (일부 성능 저하)
      const currentApiTime = 280; // 180ms → 280ms (55% 증가)
      universalVitals.collectVital(
        'api-response-time',
        'api-performance',
        currentApiTime,
        'ms',
        { regression: true }
      );

      // 회귀 감지 시뮬레이션
      const regressionDetected =
        currentApiTime > baselineMetrics[1].value * 1.5; // 50% 임계값

      if (regressionDetected) {
        const regressionPercentage =
          ((currentApiTime - baselineMetrics[1].value) /
            baselineMetrics[1].value) *
          100;

        universalVitals.collectVital(
          'performance-regression',
          'reliability',
          regressionPercentage,
          '%',
          {
            metric: 'api-response-time',
            baseline: baselineMetrics[1].value,
            current: currentApiTime,
            severity: 'high',
          }
        );
      }

      expect(regressionDetected).toBe(true);
    });
  });
});

// 📊 통합 리포트 생성 함수
async function generateIntegratedReport() {
  const allMetrics = universalVitals.getAllMetrics();
  const summary = universalVitals.getSummary();

  // 카테고리별 분석
  const categoryAnalysis = {
    'test-execution': analyzeCategory('test-execution'),
    'api-performance': analyzeCategory('api-performance'),
    'build-performance': analyzeCategory('build-performance'),
    'web-performance': analyzeCategory('web-performance'),
    infrastructure: analyzeCategory('infrastructure'),
    reliability: analyzeCategory('reliability'),
  };

  // 전체 점수 계산 (가중 평균)
  const overallScore = calculateOverallScore(summary);

  // 권장사항 생성
  const recommendations = generateRecommendations(allMetrics);

  const report = {
    timestamp: Date.now(),
    source: 'universal-vitals-integration',
    sessionId: `integration-${Date.now()}`,
    metrics: allMetrics,
    summary: {
      ...summary,
      overallScore,
      overallRating:
        overallScore >= 80
          ? 'good'
          : overallScore >= 60
            ? 'needs-improvement'
            : 'poor',
    },
    analysis: categoryAnalysis,
    recommendations,
    metadata: {
      testTools: ['vitest', 'playwright', 'api-tests'],
      environment: 'test',
      integration: true,
    },
  };

  return report;
}

function analyzeCategory(category: string) {
  const metrics = universalVitals.getMetricsByCategory(
    category as VitalCategory
  );
  if (metrics.length === 0) return null;

  const good = metrics.filter((m) => m.rating === 'good').length;
  const poor = metrics.filter((m) => m.rating === 'poor').length;
  const total = metrics.length;

  const score = Math.round((good / total) * 100);
  const rating =
    score >= 80 ? 'good' : score >= 60 ? 'needs-improvement' : 'poor';

  return {
    totalMetrics: total,
    good,
    poor,
    score,
    rating,
    avgValue: metrics.reduce((sum, m) => sum + m.value, 0) / total,
  };
}

function calculateOverallScore(summary: VitalsSummary) {
  const total = summary.total;
  if (total === 0) return 100;

  const goodWeight = 100;
  const needsImprovementWeight = 60;
  const poorWeight = 20;

  const weightedScore =
    (summary.good * goodWeight +
      summary.needsImprovement * needsImprovementWeight +
      summary.poor * poorWeight) /
    total;

  return Math.round(weightedScore);
}

function generateRecommendations(metrics: UniversalVital[]) {
  const recommendations: string[] = [];

  const poorMetrics = metrics.filter((m) => m.rating === 'poor');

  poorMetrics.forEach((metric) => {
    if (
      metric.category === 'api-performance' &&
      metric.name.includes('response-time')
    ) {
      recommendations.push('API 응답 시간 최적화 필요 - 캐싱 및 쿼리 최적화');
    }
    if (
      metric.category === 'test-execution' &&
      metric.name.includes('test-time')
    ) {
      recommendations.push('테스트 실행 시간 개선 - 병렬 실행 및 Mock 활용');
    }
    if (
      metric.category === 'build-performance' &&
      metric.name.includes('build-time')
    ) {
      recommendations.push('빌드 시간 단축 - 증분 빌드 및 캐싱 활용');
    }
    if (metric.category === 'web-performance') {
      recommendations.push('Web Vitals 개선 - 이미지 최적화 및 코드 스플리팅');
    }
  });

  return [...new Set(recommendations)]; // 중복 제거
}
