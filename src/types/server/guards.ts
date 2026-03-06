/**
 * Server Type Guards
 *
 * 타입 가드 함수 모음
 */

import type { AlertSeverity, ServiceStatus } from '../common';
import {
  isValidServerEnvironment,
  isValidServerRole,
  isValidServerStatus,
} from '../server-enums';
import type { Server } from './core';
import type { EnhancedServerMetrics } from './metrics';

// Re-export enum validators
export { isValidServerStatus, isValidServerEnvironment, isValidServerRole };

/**
 * Server 타입 가드
 */
export function isServer(obj: unknown): obj is Server {
  if (typeof obj !== 'object' || obj === null) return false;

  const server = obj as Server;
  return (
    typeof server.id === 'string' &&
    typeof server.name === 'string' &&
    isValidServerStatus(server.status) &&
    typeof server.cpu === 'number' &&
    typeof server.memory === 'number' &&
    typeof server.disk === 'number' &&
    typeof server.uptime !== 'undefined'
  );
}

/**
 * AlertSeverity 타입 가드
 */
export function isValidAlertSeverity(
  severity: string
): severity is AlertSeverity {
  const validSeverities: AlertSeverity[] = ['info', 'warning', 'critical'];
  return (validSeverities as string[]).includes(severity);
}

/**
 * ServiceStatus 타입 가드
 */
export function isValidServiceStatus(status: string): status is ServiceStatus {
  const validStatuses: ServiceStatus[] = [
    'running',
    'stopped',
    'warning',
    'failed',
    'unknown',
    'error',
    'starting',
    'stopping',
  ];
  return (validStatuses as string[]).includes(status);
}

/**
 * EnhancedServerMetrics 타입 가드
 */
export function isEnhancedServerMetrics(
  obj: unknown
): obj is EnhancedServerMetrics {
  if (typeof obj !== 'object' || obj === null) return false;

  const server = obj as EnhancedServerMetrics;
  return (
    typeof server.id === 'string' &&
    typeof server.hostname === 'string' &&
    isValidServerEnvironment(server.environment) &&
    isValidServerRole(server.role) &&
    isValidServerStatus(server.status) &&
    typeof server.cpu_usage === 'number' &&
    typeof server.memory_usage === 'number' &&
    typeof server.disk_usage === 'number'
  );
}
