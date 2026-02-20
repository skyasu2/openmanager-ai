import { systemLogger } from '@/lib/logger';
import type {
  ISystemEventBus,
  ProcessEventPayload,
} from '../interfaces/SystemEventBus';
import { SystemEventType } from '../interfaces/SystemEventBus';
import { HealthCheckManager } from './HealthCheckManager';
import type { ProcessConfig, ProcessState } from './process-types';

export type RuntimeContext = {
  processes: Map<string, ProcessConfig>;
  states: Map<string, ProcessState>;
  healthCheckManager: HealthCheckManager;
  eventBus?: ISystemEventBus;
  emitLocal: (event: string, payload: Record<string, unknown>) => void;
  restartProcess: (processId: string) => Promise<boolean>;
  startProcess: (processId: string) => Promise<boolean>;
  stopProcess: (processId: string) => Promise<boolean>;
  delay: (ms: number) => Promise<void>;
};

export async function startManagedProcess(
  ctx: RuntimeContext,
  processId: string
): Promise<boolean> {
  const config = ctx.processes.get(processId);
  const state = ctx.states.get(processId);

  if (!config || !state) {
    systemLogger.warn(`프로세스 설정을 찾을 수 없음: ${processId}`);
    return false;
  }

  if (state.status === 'running') {
    systemLogger.system(`프로세스 이미 실행 중: ${config.name}`);
    return true;
  }

  try {
    systemLogger.system(`🔄 ${config.name} 시작 중...`);
    state.status = 'starting';
    state.startedAt = new Date();

    if (config.dependencies) {
      for (const depId of config.dependencies) {
        const depState = ctx.states.get(depId);
        if (!depState || depState.status !== 'running') {
          throw new Error(`의존성 프로세스 ${depId}가 실행되지 않음`);
        }
      }
    }

    await config.startCommand();

    state.status = 'running';
    state.errors = [];

    const isHealthy =
      await ctx.healthCheckManager.performInitialHealthCheck(config);
    if (!isHealthy) {
      throw new Error('초기 헬스체크 실패');
    }

    state.healthScore = 100;
    state.lastHealthCheck = new Date();

    systemLogger.system(`✅ ${config.name} 시작 완료`);

    if (ctx.eventBus) {
      ctx.eventBus.emit<ProcessEventPayload>({
        type: SystemEventType.PROCESS_STARTED,
        timestamp: Date.now(),
        source: 'ProcessManager',
        payload: {
          processId: config.id,
          processName: config.name,
          status: 'running',
        },
      });
    }

    ctx.emitLocal('process:started', { processId, config, state });
    return true;
  } catch (error) {
    state.status = 'error';
    state.stoppedAt = new Date();
    const errorMsg =
      error instanceof Error ? error.message : '알 수 없는 오류';

    state.errors.push({
      timestamp: new Date(),
      message: errorMsg,
      error,
    });

    systemLogger.error(`${config.name} 시작 실패:`, error);

    if (ctx.eventBus) {
      ctx.eventBus.emit<ProcessEventPayload>({
        type: SystemEventType.PROCESS_ERROR,
        timestamp: Date.now(),
        source: 'ProcessManager',
        payload: {
          processId: config.id,
          processName: config.name,
          status: 'error',
          error: error instanceof Error ? error : new Error(errorMsg),
        },
      });
    }

    ctx.emitLocal('process:error', { processId, error: errorMsg });

    if (config.autoRestart && state.restartCount < config.maxRestarts) {
      await ctx.restartProcess(processId);
    }

    return false;
  }
}

export async function stopManagedProcess(
  ctx: RuntimeContext,
  processId: string
): Promise<boolean> {
  const config = ctx.processes.get(processId);
  const state = ctx.states.get(processId);

  if (!config || !state) {
    return false;
  }

  if (state.status === 'stopped') {
    return true;
  }

  try {
    state.status = 'stopping';
    await config.stopCommand();
    state.status = 'stopped';
    state.stoppedAt = new Date();

    if (state.startedAt) {
      state.uptime = state.stoppedAt.getTime() - state.startedAt.getTime();
    }

    systemLogger.system(`✅ ${config.name} 정지 완료`);
    ctx.emitLocal('process:stopped', { processId, config, state });
    return true;
  } catch (error) {
    systemLogger.error(`${config.name} 정지 실패:`, error);
    return false;
  }
}

export async function restartManagedProcess(
  ctx: RuntimeContext,
  processId: string
): Promise<boolean> {
  const config = ctx.processes.get(processId);
  const state = ctx.states.get(processId);

  if (!config || !state) {
    return false;
  }

  state.restartCount++;

  if (state.restartCount > config.maxRestarts) {
    systemLogger.error(
      `${config.name} 최대 재시작 횟수 초과 (${config.maxRestarts}회)`
    );
    state.status = 'error';
    ctx.emitLocal('process:max-restarts-exceeded', { processId, config });
    return false;
  }

  systemLogger.system(
    `🔄 ${config.name} 재시작 중... (시도 ${state.restartCount}/${config.maxRestarts})`
  );

  ctx.emitLocal('process:restarting', {
    processId,
    attempt: state.restartCount,
    maxAttempts: config.maxRestarts,
  });

  await ctx.stopProcess(processId);
  await ctx.delay(2000);
  return await ctx.startProcess(processId);
}
