import { isSingleModeAllowed } from '../../lib/config-parser';
import { logger } from '../../lib/logger';
import type { SupervisorMode, SupervisorRequest } from './supervisor-types';
import { selectExecutionMode } from './supervisor-routing';

export type ResolvedSupervisorMode = Exclude<SupervisorMode, 'auto'>;

/**
 * Resolve final execution mode for the request.
 * 
 * 🎯 Strategy (2026-04-04):
 * 1. Multi-agent is the DEFAULT operational mode for OpenManager AI.
 * 2. Single-agent is strictly restricted and only allowed if ALLOW_DEGRADED_SINGLE=true.
 * 3. Auto mode always prefers multi-agent unless query is extremely trivial AND single is allowed.
 * 
 * @version 2.0.0
 */
export function resolveSupervisorMode(
  request: Pick<SupervisorRequest, 'mode' | 'messages'>,
): ResolvedSupervisorMode {
  const requestedMode = request.mode || 'auto';
  const singleAllowed = isSingleModeAllowed();

  // 1. Explicit Multi-agent request (Golden Path)
  if (requestedMode === 'multi') {
    return 'multi';
  }

  // 2. Explicit Single-agent request (Restricted)
  if (requestedMode === 'single') {
    if (!singleAllowed) {
      logger.warn('[SupervisorMode] Single-agent requested but NOT allowed in production. Upgrading to Multi-agent.');
      return 'multi';
    }
    return 'single';
  }

  // 3. Auto-detection (prefers Multi-agent)
  const lastUserMessage = request.messages.filter((message) => message.role === 'user').pop();
  if (!lastUserMessage) {
    return 'multi'; // No message? Multi-agent is safer for exploration.
  }

  const complexityMode = selectExecutionMode(lastUserMessage.content);
  
  // Even if complexity is low (suggesting single), we enforce multi if single is not allowed.
  if (complexityMode === 'single' && !singleAllowed) {
    return 'multi';
  }

  return complexityMode === 'multi' ? 'multi' : 'single';
}
