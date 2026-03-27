import type { SupervisorMode, SupervisorRequest } from './supervisor-types';
import { selectExecutionMode } from './supervisor-routing';

export type ResolvedSupervisorMode = Exclude<SupervisorMode, 'auto'>;

export function resolveSupervisorMode(
  request: Pick<SupervisorRequest, 'mode' | 'messages'>,
): ResolvedSupervisorMode {
  const mode = request.mode || 'auto';
  if (mode === 'single' || mode === 'multi') {
    return mode;
  }

  const lastUserMessage = request.messages.filter((message) => message.role === 'user').pop();
  if (!lastUserMessage) {
    return 'single';
  }

  return selectExecutionMode(lastUserMessage.content) === 'multi'
    ? 'multi'
    : 'single';
}
