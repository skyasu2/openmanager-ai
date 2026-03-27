/**
 * Agent Context Store Facade
 *
 * 기존 public API를 유지하면서 구현을 모듈 단위로 분리합니다.
 */

// Types
export type {
  AgentContext,
  AgentFindings,
  AnomalyData,
  HandoffEvent,
  MetricSnapshot,
  RootCauseData,
} from './context-store-types';

// Core CRUD
export {
  CONTEXT_CONFIG,
  deleteSessionContext,
  getContextStoreStats,
  getOrCreateSessionContext,
  getSessionContext,
  saveSessionContext,
  updateSessionContext,
} from './context-store-core';

// Specialized operations
export {
  appendAffectedServers,
  appendAnomalies,
  appendKnowledgeResults,
  appendMetrics,
  appendRecommendedCommands,
  getContextSummary,
  recordHandoffEvent,
  setRootCause,
} from './context-store-specialized';
