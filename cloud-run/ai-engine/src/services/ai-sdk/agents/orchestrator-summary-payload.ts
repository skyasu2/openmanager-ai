export interface CollectedToolResult {
  toolName: string;
  result: unknown;
}

export interface ServerSnapshot {
  id: string;
  name?: string;
  status: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
  dailyTrend?: {
    cpu?: { avg?: number };
    memory?: { avg?: number };
    disk?: { avg?: number };
  };
}

export interface AlertServerSnapshot {
  id: string;
  status: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  cpuTrend?: string;
  memoryTrend?: string;
  diskTrend?: string;
  dailyAvg?: {
    cpu?: number;
    memory?: number;
    disk?: number;
  };
}

export interface MetricsToolPayload {
  source:
    | 'getServerMetrics'
    | 'getServerMetricsAdvanced'
    | 'filterServers'
    | 'getServerByGroup'
    | 'getServerByGroupAdvanced';
  servers: ServerSnapshot[];
  alertServers?: AlertServerSnapshot[];
  condition?: string;
  filterSummary?: {
    matched: number;
    returned: number;
    total: number;
  };
  emptyResultHint?: {
    topServers?: Array<{
      id: string;
      name?: string;
      status?: string;
      value?: number;
    }>;
    suggestion?: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isServerSnapshot(value: unknown): value is ServerSnapshot {
  return isRecord(value) && typeof value.id === 'string' && typeof value.status === 'string';
}

function isAlertServerSnapshot(value: unknown): value is AlertServerSnapshot {
  return isRecord(value) && typeof value.id === 'string' && typeof value.status === 'string';
}

function toAdvancedServerSnapshot(value: unknown): ServerSnapshot | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.metrics)) {
    return null;
  }

  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : undefined,
    status: typeof value.status === 'string' ? value.status : 'online',
    cpu: toNumber(value.metrics.cpu) ?? undefined,
    memory: toNumber(value.metrics.memory) ?? undefined,
    disk: toNumber(value.metrics.disk) ?? undefined,
    network: toNumber(value.metrics.network) ?? undefined,
  };
}

function toFilterSummary(value: unknown): MetricsToolPayload['filterSummary'] | undefined {
  if (!isRecord(value)) return undefined;
  const matched = toNumber(value.matched);
  const returned = toNumber(value.returned);
  const total = toNumber(value.total);
  if (matched === null || returned === null || total === null) return undefined;
  return { matched, returned, total };
}

function toEmptyResultHint(value: unknown): MetricsToolPayload['emptyResultHint'] | undefined {
  if (!isRecord(value)) return undefined;
  const topServers = Array.isArray(value.topServers)
    ? value.topServers
        .filter(isRecord)
        .map((server) => ({
          id: String(server.id ?? ''),
          name: server.name ? String(server.name) : undefined,
          status: server.status ? String(server.status) : undefined,
          value: toNumber(server.value) ?? undefined,
        }))
        .filter((server) => server.id)
    : undefined;

  const hint: MetricsToolPayload['emptyResultHint'] = {};
  if (topServers) {
    hint.topServers = topServers;
  }
  if (value.suggestion) {
    hint.suggestion = String(value.suggestion);
  }
  return hint;
}

export function getMetricsPayload(
  toolResults: CollectedToolResult[]
): MetricsToolPayload | null {
  const metricsEntry = toolResults.find(
    (entry) => entry.toolName === 'getServerMetrics' && isRecord(entry.result)
  );

  if (metricsEntry && isRecord(metricsEntry.result)) {
    const servers = Array.isArray(metricsEntry.result.servers)
      ? metricsEntry.result.servers.filter(isServerSnapshot)
      : [];
    const alertServers = Array.isArray(metricsEntry.result.alertServers)
      ? metricsEntry.result.alertServers.filter(isAlertServerSnapshot)
      : undefined;

    if (servers.length === 0) {
      return null;
    }

    return { source: 'getServerMetrics', servers, alertServers };
  }

  const advancedEntry = toolResults.find(
    (entry) =>
      entry.toolName === 'getServerMetricsAdvanced' && isRecord(entry.result)
  );

  if (advancedEntry && isRecord(advancedEntry.result)) {
    const servers = Array.isArray(advancedEntry.result.servers)
      ? advancedEntry.result.servers
          .map(toAdvancedServerSnapshot)
          .filter((server): server is ServerSnapshot => server !== null)
      : [];

    if (servers.length > 0) {
      return { source: 'getServerMetricsAdvanced', servers };
    }
  }

  const groupEntry = toolResults.find(
    (entry) =>
      (entry.toolName === 'getServerByGroup' ||
        entry.toolName === 'getServerByGroupAdvanced') &&
      isRecord(entry.result)
  );

  if (groupEntry && isRecord(groupEntry.result)) {
    const servers = Array.isArray(groupEntry.result.servers)
      ? groupEntry.result.servers.filter(isServerSnapshot)
      : [];

    if (servers.length > 0) {
      return {
        source:
          groupEntry.toolName === 'getServerByGroupAdvanced'
            ? 'getServerByGroupAdvanced'
            : 'getServerByGroup',
        servers,
      };
    }
  }

  const filterEntry = toolResults.find(
    (entry) => entry.toolName === 'filterServers' && isRecord(entry.result)
  );

  if (!filterEntry || !isRecord(filterEntry.result)) {
    return null;
  }

  const servers = Array.isArray(filterEntry.result.servers)
    ? filterEntry.result.servers.filter(isServerSnapshot)
    : [];
  const filterSummary = toFilterSummary(filterEntry.result.summary);

  if (servers.length === 0 && !filterSummary) {
    return null;
  }

  return {
    source: 'filterServers',
    servers,
    condition: filterEntry.result.condition ? String(filterEntry.result.condition) : undefined,
    filterSummary,
    emptyResultHint: toEmptyResultHint(filterEntry.result.emptyResultHint),
  };
}

export function buildSummaryPayloadFromCurrentState(
  stateData?: unknown
): MetricsToolPayload | null {
  if (!isRecord(stateData) || !Array.isArray(stateData.servers)) {
    return null;
  }

  const state = {
    ...stateData,
    servers: stateData.servers.filter(isServerSnapshot),
  };
  if (!state?.servers || state.servers.length === 0) {
    return null;
  }

  const servers: ServerSnapshot[] = state.servers.map((server) => {
    return {
      id: server.id,
      status: server.status,
      cpu: server.cpu,
      memory: server.memory,
      disk: server.disk,
      network: server.network,
    };
  });

  const alertServers: AlertServerSnapshot[] = servers
    .filter((server) =>
      ['warning', 'critical', 'offline'].includes(server.status)
    )
    .map((server) => ({
      id: server.id,
      status: server.status,
      cpu: server.cpu,
      memory: server.memory,
      disk: server.disk,
    }));

  return {
    source: 'getServerMetrics',
    servers,
    ...(alertServers.length > 0 && { alertServers }),
  };
}

export function getPayloadServerEvidenceCount(payload: MetricsToolPayload): number {
  return payload.servers.length || payload.filterSummary?.total || 0;
}
