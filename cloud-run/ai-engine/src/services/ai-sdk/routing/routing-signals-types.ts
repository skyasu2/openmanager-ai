import type { SupervisorMode } from '../supervisor-types';

export type QueryRoutingIntent =
  | 'metrics'
  | 'anomaly'
  | 'prediction'
  | 'rca'
  | 'advisor'
  | 'logs'
  | 'serverGroup'
  | 'report'
  | 'vision'
  | 'knowledge'
  | 'general';

export type QueryRoutingToolIntentCategory =
  | 'anomaly'
  | 'prediction'
  | 'math'
  | 'rca'
  | 'advisor'
  | 'serverGroup'
  | 'logs'
  | 'metrics'
  | 'general';

export type QueryRoutingScope =
  | 'single_server'
  | 'server_group'
  | 'whole_fleet'
  | 'unknown';

export type QueryRoutingMetric =
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'load1'
  | 'network'
  | 'unknown';

export type QueryRoutingTimeWindow =
  | 'realtime'
  | 'recent'
  | '24h'
  | 'unknown';

export interface QueryRoutingPreFilterSignal {
  action: 'direct_response' | 'suggest_agent' | 'continue';
  suggestedAgent?: string;
  confidence: number;
  reasonCodes: string[];
}

export interface QueryRoutingSignalOptions {
  hasImageAttachments?: boolean;
  hasFileAttachments?: boolean;
}

export interface QueryRoutingSignals {
  intent: QueryRoutingIntent;
  toolIntentCategory: QueryRoutingToolIntentCategory;
  scope: QueryRoutingScope;
  hasInfraContext: boolean;
  hasAttachment: boolean;
  hasImageAttachment: boolean;
  hasFileAttachment: boolean;
  asksForReport: boolean;
  asksForAction: boolean;
  asksForMutation: boolean;
  asksForFormattingOnly: boolean;
  metric?: QueryRoutingMetric;
  timeWindow?: QueryRoutingTimeWindow;
  confidence: number;
  reasonCodes: string[];
  modeHint: Exclude<SupervisorMode, 'auto'>;
  preFilter: QueryRoutingPreFilterSignal;
}
