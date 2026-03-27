/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemWatchdog } from './SystemWatchdog';

type RunMonitoringCycleAccessor = {
  runMonitoringCycle: () => Promise<void>;
};

describe('SystemWatchdog runMonitoringCycle 순서 보장', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('모니터링 사이클은 collectMetrics → analyzeStability → checkAlerts 순서로 실행된다', async () => {
    const watchdog = new SystemWatchdog();
    const callOrder: string[] = [];

    // private 메서드 스파이: 호출 순서 기록
    const collectSpy = vi
      .spyOn(watchdog as never, 'collectMetrics')
      .mockImplementation(async () => {
        callOrder.push('collectMetrics');
      });
    const analyzeSpy = vi
      .spyOn(watchdog as never, 'analyzeStability')
      .mockImplementation(() => {
        callOrder.push('analyzeStability');
      });
    const checkSpy = vi
      .spyOn(watchdog as never, 'checkAlerts')
      .mockImplementation(() => {
        callOrder.push('checkAlerts');
      });

    // private runMonitoringCycle 직접 호출
    await (
      watchdog as unknown as RunMonitoringCycleAccessor
    ).runMonitoringCycle();

    expect(callOrder).toEqual([
      'collectMetrics',
      'analyzeStability',
      'checkAlerts',
    ]);

    // 각 메서드가 정확히 1회 호출됨
    expect(collectSpy).toHaveBeenCalledOnce();
    expect(analyzeSpy).toHaveBeenCalledOnce();
    expect(checkSpy).toHaveBeenCalledOnce();
  });

  it('collectMetrics가 실패해도 analyzeStability/checkAlerts가 실행되지 않는다 (에러 전파)', async () => {
    const watchdog = new SystemWatchdog();

    vi.spyOn(watchdog as never, 'collectMetrics').mockRejectedValue(
      new Error('metrics failure')
    );
    const analyzeSpy = vi.spyOn(watchdog as never, 'analyzeStability');
    const checkSpy = vi.spyOn(watchdog as never, 'checkAlerts');

    await expect(
      (watchdog as unknown as RunMonitoringCycleAccessor).runMonitoringCycle()
    ).rejects.toThrow('metrics failure');

    expect(analyzeSpy).not.toHaveBeenCalled();
    expect(checkSpy).not.toHaveBeenCalled();
  });
});
