export type IncidentSeverity = 'warning' | 'critical' | 'offline';

export type IncidentMetric =
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'network'
  | 'composite';

export type IncidentCause = {
  metric: Exclude<IncidentMetric, 'composite'>;
  value: number;
  warningThreshold: number;
  criticalThreshold: number;
  level: 'warning' | 'critical';
};

export type IncidentEvent = {
  id: string;
  timestamp: string;
  timestampUnixMs: number;
  hour: number;
  slotIndex: number;
  serverId: string;
  hostname: string;
  serverType: string;
  environment: string;
  status: IncidentSeverity;
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  causes: IncidentCause[];
  score: number;
  summary: string;
};

export type IncidentQueryResult = {
  items: IncidentEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  metadata: {
    builtAt: string | null;
    windowStart: string | null;
    windowEnd: string | null;
    cacheAgeMs: number | null;
  };
};
