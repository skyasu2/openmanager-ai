import type { SystemStatusPayload } from '../interfaces/SystemEventBus';
import type {
  ProcessConfig,
  ProcessState,
  SystemMetrics,
} from './process-types';

type ServiceStatus = SystemStatusPayload['services'][number];

export function calculateProcessStartupOrder(
  processes: Map<string, ProcessConfig>
): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);

    const config = processes.get(id);
    if (config?.dependencies) {
      for (const depId of config.dependencies) {
        visit(depId);
      }
    }

    order.push(id);
  };

  for (const id of Array.from(processes.keys())) {
    visit(id);
  }

  return order;
}

export function calculateSystemUptime(systemStartTime?: Date): number {
  if (!systemStartTime) return 0;
  return Date.now() - systemStartTime.getTime();
}

export function buildServiceStatuses(
  processes: Map<string, ProcessConfig>,
  states: Map<string, ProcessState>
): ServiceStatus[] {
  return Array.from(processes.entries()).map(([id, config]) => {
    const state = states.get(id);
    let status: ServiceStatus['status'] = 'down';

    if (state?.status === 'running') {
      status = state.healthScore >= 70 ? 'up' : 'degraded';
    }

    return {
      name: config.name,
      status,
      responseTime: state?.lastHealthCheck
        ? Date.now() - state.lastHealthCheck.getTime()
        : undefined,
    };
  });
}

export function buildSystemMetrics(params: {
  processes: Map<string, ProcessConfig>;
  states: Map<string, ProcessState>;
  systemStartTime?: Date;
}): SystemMetrics {
  const { processes, states, systemStartTime } = params;
  const stateList = Array.from(states.values());
  const runningStates = stateList.filter((state) => state.status === 'running');
  const healthyStates = runningStates.filter(
    (state) => state.healthScore >= 70
  );

  const totalRestarts = stateList.reduce(
    (sum, state) => sum + state.restartCount,
    0
  );

  const averageHealthScore =
    runningStates.length > 0
      ? runningStates.reduce((sum, state) => sum + state.healthScore, 0) /
        runningStates.length
      : 0;

  return {
    totalProcesses: processes.size,
    runningProcesses: runningStates.length,
    healthyProcesses: healthyStates.length,
    systemUptime: calculateSystemUptime(systemStartTime),
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
    averageHealthScore,
    totalRestarts,
    lastStabilityCheck: new Date(),
  };
}
