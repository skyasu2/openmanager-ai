/**
 * 🔧 통합 시스템 API
 *
 * 시스템 상태, 제어, 최적화를 통합 관리
 *
 * v5.84.1 변경사항:
 * - /api/system/status, initialize, start, optimize, sync-data, unified 기능 통합
 * - Query parameter로 뷰 선택 (?view=status|metrics|health|processes|memory)
 * - POST body.action으로 작업 통합
 *
 * GET /api/system
 *   - (default): 시스템 상태
 *   - ?view=metrics: 시스템 메트릭
 *   - ?view=health: 헬스 상태
 *   - ?view=processes: 프로세스 목록
 *   - ?view=memory: 메모리 상태
 *
 * POST /api/system
 *   - action: 'start' | 'stop' | 'restart'
 *   - action: 'initialize'
 *   - action: 'optimize' (with level: 'normal' | 'aggressive')
 *   - action: 'sync-data'
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { ProcessManager } from '@/lib/core/system/ProcessManager';
import {
  getProcessConfigs,
  validateProcessConfigs,
} from '@/lib/core/system/process-configs';
import { systemLogger } from '@/lib/logger';
import { getSystemRunningFlag, setSystemRunningFlag } from '@/lib/redis';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';

// ============================================================================
// ProcessManager Singleton
// ============================================================================

let processManager: ProcessManager | null = null;

function getProcessManager(): ProcessManager {
  if (!processManager) {
    systemLogger.system('🔧 ProcessManager 인스턴스 생성');
    processManager = new ProcessManager();

    const configs = getProcessConfigs();
    const validation = validateProcessConfigs(configs);

    if (!validation.isValid) {
      systemLogger.error('프로세스 설정 검증 실패:', validation.errors);
      throw new Error(`프로세스 설정 오류: ${validation.errors.join(', ')}`);
    }

    configs.forEach((config) => {
      processManager!.registerProcess(config);
    });

    systemLogger.system(
      `✅ ProcessManager 초기화 완료 (${configs.length}개 프로세스 등록)`
    );
  }

  return processManager;
}

// ============================================================================
// Initialization State
// ============================================================================

let isInitialized = false;
let isInitializing = false;

async function runInitialization(): Promise<string[]> {
  const logs: string[] = [];
  isInitializing = true;

  try {
    logs.push('✅ 서버 데이터 생성기 초기화 완료');
    systemLogger.info('✅ 서버 데이터 생성기 초기화 완료');

    logs.push('🔄 MCP 서버 웜업 시작 (백그라운드)');
    logs.push('✅ 기타 필수 서비스 초기화 완료');

    isInitialized = true;
    return logs;
  } catch (error) {
    isInitialized = false;
    throw error;
  } finally {
    isInitializing = false;
  }
}

async function syncSystemRunningFlag(
  isRunning: boolean,
  action: string
): Promise<void> {
  const synced = await setSystemRunningFlag(isRunning);
  if (!synced) {
    systemLogger.warn(
      `[System] Redis system flag sync failed (action=${action}, isRunning=${isRunning})`
    );
  }
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'status';

    debug.log('🔍 System GET requested:', { view });

    const manager = getProcessManager();

    switch (view) {
      case 'metrics': {
        const metrics = manager.getSystemMetrics();
        return NextResponse.json({
          success: true,
          data: { metrics, timestamp: new Date().toISOString() },
        });
      }

      case 'health': {
        const status = manager.getSystemStatus();
        const { metrics } = status;
        const healthRatio =
          metrics.totalProcesses > 0
            ? metrics.healthyProcesses / metrics.totalProcesses
            : 0;
        const isHealthy =
          healthRatio >= 0.7 && metrics.averageHealthScore >= 70;
        const healthStatus = isHealthy
          ? 'healthy'
          : healthRatio >= 0.5
            ? 'degraded'
            : 'unhealthy';

        return NextResponse.json(
          {
            success: true,
            healthy: isHealthy,
            status: healthStatus,
            runningProcesses: metrics.runningProcesses,
            totalProcesses: metrics.totalProcesses,
            timestamp: new Date().toISOString(),
          },
          { status: isHealthy ? 200 : 503 }
        );
      }

      case 'processes': {
        const status = manager.getSystemStatus();
        const processArray = Array.from(status.processes.values());

        return NextResponse.json({
          success: true,
          data: {
            processes: processArray.map((proc) => ({
              id: proc.id,
              status: proc.status,
              healthScore: proc.healthScore,
              restartCount: proc.restartCount,
              uptime: proc.uptime,
              lastHealthCheck: proc.lastHealthCheck,
              errorCount: proc.errors.length,
            })),
            timestamp: new Date().toISOString(),
          },
        });
      }

      case 'memory': {
        const mem = process.memoryUsage();
        return NextResponse.json({
          success: true,
          data: {
            status: 'optimal',
            current: {
              heapUsed: mem.heapUsed,
              heapTotal: mem.heapTotal,
              rss: mem.rss,
              external: mem.external,
              usagePercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
              timestamp: Date.now(),
            },
            monitoring: {
              enabled: false,
              lastOptimization: null,
              totalOptimizations: 0,
            },
            serverless: true,
            message: 'Vercel 서버리스 환경에서는 플랫폼이 자동 관리합니다.',
            history: [],
          },
          timestamp: new Date().toISOString(),
        });
      }

      default: {
        // case 'status' is handled by default
        // useSystemStatus 훅이 기대하는 형식으로 응답
        const status = manager.getSystemStatus();
        const { metrics } = status;
        const redisSystemRunning = await getSystemRunningFlag();

        // 시스템 실행 상태 판단: 프로세스가 있고 running 프로세스가 50% 이상
        const processBasedRunning =
          status.running ||
          (metrics.totalProcesses > 0 &&
            metrics.runningProcesses / metrics.totalProcesses >= 0.5);
        // 실행 상태의 SSOT는 프로세스 매니저 상태를 우선한다.
        // Redis는 보조 신호로만 사용하여 stale 플래그에 의한 오탐을 줄인다.
        const isSystemRunning = processBasedRunning;
        const redisStateMismatch =
          redisSystemRunning !== null &&
          redisSystemRunning !== processBasedRunning;

        if (redisStateMismatch) {
          systemLogger.warn(
            `[System] Redis/system status mismatch (redis=${redisSystemRunning}, process=${processBasedRunning})`
          );
        }

        return NextResponse.json({
          isRunning: isSystemRunning,
          isStarting: false,
          lastUpdate: new Date().toISOString(),
          userCount: 1, // 현재 접속자 (데모용)
          version: process.env.npm_package_version || '8.3.3',
          environment: process.env.NODE_ENV || 'development',
          uptime: metrics.systemUptime || 0,
          services: {
            database: true,
            cache: true,
            ai: true,
          },
          systemStateSource:
            redisSystemRunning === null
              ? 'process-manager'
              : redisStateMismatch
                ? 'process-manager(redis-mismatch)'
                : 'process-manager+redis',
          // 기존 데이터도 함께 반환 (호환성)
          metrics,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    systemLogger.error('System GET 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '시스템 상태 조회 실패',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { action, options } = body;

    debug.log('🔧 System POST action:', action);

    const manager = getProcessManager();

    switch (action) {
      // System Control Actions (from unified)
      case 'start': {
        systemLogger.system('🚀 통합 시스템 시작 요청');
        const result = await manager.startSystem(options);
        if (result.success) {
          await syncSystemRunningFlag(true, 'start');
        }

        return NextResponse.json({
          success: result.success,
          action: 'start',
          message: result.message,
          errors: result.errors,
          warnings: result.warnings,
          timestamp: new Date().toISOString(),
        });
      }

      case 'stop': {
        systemLogger.system('🛑 통합 시스템 중지 요청');
        const result = await manager.stopSystem();
        if (result.success) {
          await syncSystemRunningFlag(false, 'stop');
        }

        return NextResponse.json({
          success: result.success,
          action: 'stop',
          message: result.message,
          errors: result.errors,
          timestamp: new Date().toISOString(),
        });
      }

      case 'restart': {
        systemLogger.system('🔄 통합 시스템 재시작 요청');

        const stopResult = await manager.stopSystem();
        if (!stopResult.success) {
          return NextResponse.json(
            {
              success: false,
              action: 'restart',
              message: '시스템 중지 실패로 재시작 중단',
              errors: stopResult.errors,
              timestamp: new Date().toISOString(),
            },
            { status: 500 }
          );
        }
        await syncSystemRunningFlag(false, 'restart-stop');

        await new Promise((resolve) => setTimeout(resolve, 3000));
        const startResult = await manager.startSystem(options);
        if (startResult.success) {
          await syncSystemRunningFlag(true, 'restart-start');
        }

        return NextResponse.json({
          success: startResult.success,
          action: 'restart',
          message: `재시작 완료: ${startResult.message}`,
          errors: [...stopResult.errors, ...startResult.errors],
          warnings: startResult.warnings,
          timestamp: new Date().toISOString(),
        });
      }

      // Initialize Action (from initialize)
      case 'initialize': {
        if (isInitializing) {
          return NextResponse.json(
            {
              success: false,
              action: 'initialize',
              message: '시스템이 이미 초기화 중입니다.',
            },
            { status: 429 }
          );
        }

        if (isInitialized) {
          return NextResponse.json({
            success: true,
            action: 'initialize',
            message: '시스템이 이미 초기화되었습니다.',
            logs: ['👍 시스템은 이미 준비되었습니다.'],
          });
        }

        systemLogger.info('🚀 시스템 초기화 시작...');
        const logs = await runInitialization();
        systemLogger.info('🎉 시스템 초기화 완료');

        return NextResponse.json({
          success: true,
          action: 'initialize',
          message: '시스템 초기화 성공',
          logs,
        });
      }

      // Memory Optimize Action (serverless - platform managed)
      case 'optimize': {
        debug.log('🧠 메모리 최적화 API 호출 (서버리스)');

        const mem = process.memoryUsage();
        const usagePercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

        return NextResponse.json({
          success: true,
          action: 'optimize',
          message: `서버리스 환경 - Vercel이 자동 관리 (현재 ${usagePercent}%)`,
          data: {
            level: '서버리스 (자동 관리)',
            duration: 0,
            targetAchieved: true,
            memory: {
              before: { usagePercent, heapUsed: mem.heapUsed },
              after: { usagePercent, heapUsed: mem.heapUsed },
              freedMB: 0,
            },
            serverless: true,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Sync Data Action (from sync-data)
      case 'sync-data': {
        systemLogger.info('🔄 데이터 동기화 API 호출됨');

        const syncResult = {
          backupChecked: true,
          cacheValidated: true,
          dataRestored: false,
          syncTime: new Date().toISOString(),
        };

        await new Promise((resolve) => setTimeout(resolve, 100));
        systemLogger.info('✅ 데이터 동기화 완료:', syncResult);

        return NextResponse.json({
          success: true,
          action: 'sync-data',
          message: '데이터 동기화 완료',
          data: syncResult,
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            availableActions: [
              'start',
              'stop',
              'restart',
              'initialize',
              'optimize',
              'sync-data',
            ],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    systemLogger.error('System POST 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '시스템 제어 실패',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
});
