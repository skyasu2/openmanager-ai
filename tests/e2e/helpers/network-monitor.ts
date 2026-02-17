/**
 * 🌐 네트워크 모니터링 & SSE 스트리밍 헬퍼 함수
 *
 * 🎯 목적: Playwright MCP 통합을 통한 네트워크 활동 모니터링
 * 📊 효과: SSE 이벤트 추적, 네트워크 요청/응답 로깅, 스냅샷 비교
 *
 * 사용 예시:
 * ```typescript
 * import { monitorSSEStream, captureNetworkRequests, compareSnapshots } from './helpers/network-monitor';
 *
 * // SSE 스트리밍 모니터링
 * const sseEvents = await monitorSSEStream(page, '/api/ai/supervisor');
 *
 * // 네트워크 요청 캡처
 * const requests = await captureNetworkRequests(page, async () => {
 *   await page.click('button[type="submit"]');
 * });
 *
 * // 스냅샷 비교 (pixelmatch 사용)
 * const diff = await compareSnapshots(page, 'baseline.png', { threshold: 0.1 });
 * ```
 */

import type { Page, Request, Response } from '@playwright/test';
import { TIMEOUTS } from './timeouts';

/**
 * SSE 이벤트 정보
 */
export interface SSEEvent {
  /** 이벤트 타입 */
  type: string;
  /** 이벤트 데이터 */
  data: string;
  /** 타임스탬프 (ms) */
  timestamp: number;
  /** 이벤트 ID (optional) */
  id?: string;
}

/**
 * 네트워크 요청 정보
 */
export interface NetworkRequest {
  /** 요청 URL */
  url: string;
  /** HTTP 메서드 */
  method: string;
  /** 요청 헤더 */
  headers: Record<string, string>;
  /** 요청 바디 (optional) */
  body?: string;
  /** 타임스탬프 (ms) */
  timestamp: number;
}

/**
 * 네트워크 응답 정보
 */
export interface NetworkResponse {
  /** 응답 URL */
  url: string;
  /** HTTP 상태 코드 */
  status: number;
  /** 응답 헤더 */
  headers: Record<string, string>;
  /** 응답 바디 (optional) */
  body?: string;
  /** 응답 시간 (ms) */
  responseTime: number;
  /** 타임스탬프 (ms) */
  timestamp: number;
}

/**
 * SSE 모니터링 옵션
 */
export interface MonitorSSEOptions {
  /** 모니터링 최대 시간 (기본값: TIMEOUTS.AI_RESPONSE) */
  timeout?: number;
  /** 스트리밍 완료 감지 문자열 (기본값: '[DONE]') */
  doneMarker?: string;
  /** 이벤트 필터 함수 (optional) */
  eventFilter?: (event: SSEEvent) => boolean;
}

/**
 * 네트워크 캡처 옵션
 */
export interface CaptureNetworkOptions {
  /** URL 필터 패턴 (정규식 또는 문자열) */
  urlPattern?: string | RegExp;
  /** 캡처할 메서드 (기본값: ['GET', 'POST']) */
  methods?: string[];
  /** 응답 바디 포함 여부 (기본값: false) */
  includeResponseBody?: boolean;
}

/**
 * 스냅샷 비교 옵션
 */
export interface CompareSnapshotsOptions {
  /** 픽셀 차이 임계값 (0-1, 기본값: 0.1 = 10%) */
  threshold?: number;
  /** 스냅샷 저장 경로 (기본값: 'tests/e2e/screenshots') */
  snapshotPath?: string;
  /** 전체 페이지 스냅샷 여부 (기본값: true) */
  fullPage?: boolean;
}

/**
 * 스냅샷 비교 결과
 */
export interface SnapshotComparison {
  /** 픽셀 차이율 (0-1) */
  diffPercentage: number;
  /** 비교 통과 여부 */
  passed: boolean;
  /** 차이 이미지 경로 (optional) */
  diffImagePath?: string;
}

/**
 * SSE 스트리밍을 모니터링하고 이벤트를 수집합니다.
 *
 * @param page - Playwright Page 객체
 * @param endpoint - SSE 엔드포인트 URL (예: '/api/ai/supervisor')
 * @param options - 모니터링 옵션
 * @returns SSE 이벤트 배열
 *
 * @example
 * ```typescript
 * const events = await monitorSSEStream(page, '/api/ai/supervisor', {
 *   timeout: 60000,
 *   doneMarker: '[DONE]'
 * });
 * expect(events.length).toBeGreaterThan(0);
 * ```
 */
export async function monitorSSEStream(
  page: Page,
  endpoint: string,
  options: MonitorSSEOptions = {}
): Promise<SSEEvent[]> {
  const {
    timeout = TIMEOUTS.AI_RESPONSE,
    doneMarker = '[DONE]',
    eventFilter,
  } = options;

  const events: SSEEvent[] = [];
  const startTime = Date.now();

  // SSE 이벤트 리스너 설정 (클라이언트 측 코드 주입)
  await page.evaluate(
    ({ endpoint: targetEndpoint }) => {
      // @ts-expect-error - window 객체에 SSE 이벤트 배열 추가
      window.__sseEvents = [];

      // EventSource 모니터링 (브라우저 API)
      const originalEventSource = window.EventSource;
      window.EventSource = class extends originalEventSource {
        constructor(url: string, config?: EventSourceInit) {
          super(url, config);

          if (url.includes(targetEndpoint)) {
            this.addEventListener('message', (event: MessageEvent) => {
              // @ts-expect-error
              window.__sseEvents.push({
                type: 'message',
                data: event.data,
                timestamp: Date.now(),
                id: event.lastEventId,
              });
            });

            this.addEventListener('error', (event: Event) => {
              // @ts-expect-error
              window.__sseEvents.push({
                type: 'error',
                data: JSON.stringify(event),
                timestamp: Date.now(),
              });
            });
          }
        }
      };

      // Fetch API 모니터링 (SSE over fetch)
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const [url] = args;
        const response = await originalFetch(...args);

        if (
          typeof url === 'string' &&
          url.includes(targetEndpoint) &&
          response.headers.get('content-type')?.includes('text/event-stream')
        ) {
          // SSE 스트림 읽기
          const reader = response.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            let buffer = '';

            // 백그라운드에서 스트림 읽기
            (async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() ?? '';

                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const data = line.substring(6);
                      // @ts-expect-error
                      window.__sseEvents.push({
                        type: 'data',
                        data,
                        timestamp: Date.now(),
                      });
                    }
                  }
                }
              } catch (error) {
                // @ts-expect-error
                window.__sseEvents.push({
                  type: 'error',
                  data: JSON.stringify(error),
                  timestamp: Date.now(),
                });
              }
            })();
          }
        }

        return response;
      };
    },
    { endpoint }
  );

  // 스트리밍 완료 또는 타임아웃까지 대기
  const endTime = startTime + timeout;
  while (Date.now() < endTime) {
    // 클라이언트 측 이벤트 수집
    const clientEvents = await page.evaluate(() => {
      // @ts-expect-error
      return window.__sseEvents ?? [];
    });

    events.push(...clientEvents);

    // 클라이언트 측 이벤트 배열 초기화
    await page.evaluate(() => {
      // @ts-expect-error
      window.__sseEvents = [];
    });

    // 완료 마커 확인
    const hasDoneMarker = events.some((event) =>
      event.data.includes(doneMarker)
    );
    if (hasDoneMarker) {
      break;
    }

    await page
      .waitForFunction(() => document.readyState !== 'loading', {
        timeout: 100,
      })
      .catch(() => undefined);
  }

  // 이벤트 필터 적용
  if (eventFilter) {
    return events.filter(eventFilter);
  }

  return events;
}

/**
 * 네트워크 요청을 캡처합니다.
 *
 * @param page - Playwright Page 객체
 * @param action - 네트워크 요청을 트리거할 동작
 * @param options - 캡처 옵션
 * @returns 캡처된 요청 및 응답 정보
 *
 * @example
 * ```typescript
 * const { requests, responses } = await captureNetworkRequests(
 *   page,
 *   async () => {
 *     await page.click('button[type="submit"]');
 *   },
 *   { urlPattern: /\/api\/ai\// }
 * );
 * ```
 */
export async function captureNetworkRequests(
  page: Page,
  action: () => Promise<void>,
  options: CaptureNetworkOptions = {}
): Promise<{
  requests: NetworkRequest[];
  responses: NetworkResponse[];
}> {
  const {
    urlPattern,
    methods = ['GET', 'POST'],
    includeResponseBody = false,
  } = options;

  const requests: NetworkRequest[] = [];
  const responses: NetworkResponse[] = [];
  const requestTimestamps = new Map<string, number>();

  // 요청 리스너
  const requestListener = (request: Request) => {
    const url = request.url();
    const method = request.method();

    // URL 패턴 및 메서드 필터
    if (urlPattern) {
      const pattern =
        typeof urlPattern === 'string' ? new RegExp(urlPattern) : urlPattern;
      if (!pattern.test(url)) return;
    }
    if (!methods.includes(method)) return;

    const timestamp = Date.now();
    requestTimestamps.set(request.url(), timestamp);

    requests.push({
      url,
      method,
      headers: request.headers(),
      body: request.postData() ?? undefined,
      timestamp,
    });
  };

  // 응답 리스너
  const responseListener = async (response: Response) => {
    const url = response.url();
    const requestTimestamp = requestTimestamps.get(url);

    // URL 패턴 필터
    if (urlPattern) {
      const pattern =
        typeof urlPattern === 'string' ? new RegExp(urlPattern) : urlPattern;
      if (!pattern.test(url)) return;
    }

    const responseTime = requestTimestamp ? Date.now() - requestTimestamp : 0;

    const responseInfo: NetworkResponse = {
      url,
      status: response.status(),
      headers: response.headers(),
      responseTime,
      timestamp: Date.now(),
    };

    if (includeResponseBody) {
      try {
        const body = await response.text();
        responseInfo.body = body;
      } catch {
        // 바디 읽기 실패 (이미 읽힌 경우 등)
      }
    }

    responses.push(responseInfo);
  };

  // 리스너 등록
  page.on('request', requestListener);
  page.on('response', responseListener);

  try {
    // 동작 실행
    await action();
  } finally {
    // 리스너 제거
    page.off('request', requestListener);
    page.off('response', responseListener);
  }

  return { requests, responses };
}

/**
 * 페이지 스냅샷을 비교합니다. (Playwright MCP browser_snapshot 활용)
 *
 * @param page - Playwright Page 객체
 * @param baselineName - 기준 스냅샷 이름
 * @param options - 비교 옵션
 * @returns 스냅샷 비교 결과
 *
 * @example
 * ```typescript
 * const diff = await compareSnapshots(page, 'ai-sidebar-open', {
 *   threshold: 0.05
 * });
 * expect(diff.passed).toBe(true);
 * ```
 */
export async function compareSnapshots(
  page: Page,
  baselineName: string,
  options: CompareSnapshotsOptions = {}
): Promise<SnapshotComparison> {
  const {
    threshold = 0.1,
    snapshotPath = 'tests/e2e/screenshots',
    fullPage = true,
  } = options;

  // Playwright의 내장 스냅샷 기능 사용
  try {
    // 현재 스냅샷 캡처
    const currentSnapshot = await page.screenshot({
      fullPage,
      animations: 'disabled',
    });

    // Playwright의 expect().toMatchSnapshot() 대신 직접 비교
    // (MCP browser_snapshot은 내부적으로 Playwright API 사용)
    const baselinePath = `${snapshotPath}/${baselineName}.png`;

    // 기준 스냅샷이 없으면 생성
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const absoluteBaselinePath = path.resolve(baselinePath);
    const baselineDir = path.dirname(absoluteBaselinePath);

    await fs.mkdir(baselineDir, { recursive: true });

    let baselineExists = false;
    try {
      await fs.access(absoluteBaselinePath);
      baselineExists = true;
    } catch {
      // 기준 스냅샷이 없음
    }

    if (!baselineExists) {
      // 기준 스냅샷 저장
      await fs.writeFile(absoluteBaselinePath, currentSnapshot);
      return {
        diffPercentage: 0,
        passed: true,
      };
    }

    // 기준 스냅샷 읽기
    const baselineSnapshot = await fs.readFile(absoluteBaselinePath);

    // pixelmatch를 사용한 픽셀 비교
    const { default: pixelmatch } = await import('pixelmatch');
    const pngjs = await import('pngjs');

    const PNG = pngjs.PNG;

    const img1 = PNG.sync.read(baselineSnapshot);
    const img2 = PNG.sync.read(currentSnapshot);

    // 이미지 크기가 다르면 실패
    if (img1.width !== img2.width || img1.height !== img2.height) {
      return {
        diffPercentage: 1.0,
        passed: false,
      };
    }

    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      { threshold: 0.1 }
    );

    const totalPixels = width * height;
    const diffPercentage = numDiffPixels / totalPixels;

    const passed = diffPercentage <= threshold;

    let diffImagePath: string | undefined;
    if (!passed) {
      // 차이 이미지 저장
      diffImagePath = `${snapshotPath}/${baselineName}-diff.png`;
      const absoluteDiffPath = path.resolve(diffImagePath);
      await fs.writeFile(absoluteDiffPath, PNG.sync.write(diff));
    }

    return {
      diffPercentage,
      passed,
      diffImagePath,
    };
  } catch (error) {
    // 스냅샷 비교 실패
    throw new Error(`Snapshot comparison failed: ${error}`);
  }
}
