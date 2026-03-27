import type { ModelMessage, UserContent } from 'ai';

import { logger } from '../../../lib/logger';
import { SessionMemoryService } from '../session-memory';
import type { AgentRunOptions } from './base-agent-types';

const MAX_HISTORY_MESSAGES = 4;

export async function buildAgentContext(
  agentName: string,
  query: string,
  options: AgentRunOptions,
  buildUserContent: (
    query: string,
    options: AgentRunOptions
  ) => UserContent
): Promise<ModelMessage[]> {
  const userContent = buildUserContent(query, options);
  const messages: ModelMessage[] = [];

  if (options.sessionId) {
    try {
      const history = await SessionMemoryService.getHistory(options.sessionId);
      if (history && history.length > 0) {
        const trimmed =
          history.length > MAX_HISTORY_MESSAGES
            ? history.slice(-MAX_HISTORY_MESSAGES)
            : history;

        if (trimmed.length < history.length) {
          logger.info(
            `[SessionMemory] Trimmed history ${history.length} → ${trimmed.length} messages`
          );
        }

        messages.push(...trimmed);
      }
    } catch (error) {
      logger.error(
        `[SessionMemory] History recovery failed for ${options.sessionId}:`,
        error
      );
    }
  }

  messages.push({ role: 'user', content: userContent });

  return messages;
}

export function persistAgentHistory(
  sessionId: string | undefined,
  messages: ModelMessage[],
  responseText: string
) {
  if (!sessionId || !responseText) {
    return;
  }

  const updatedMessages: ModelMessage[] = [
    ...messages,
    { role: 'assistant', content: responseText },
  ];

  SessionMemoryService.saveHistory(sessionId, updatedMessages).catch((error) => {
    logger.error(
      `[SessionMemory] Failed to save history for ${sessionId}:`,
      error
    );
  });
}
