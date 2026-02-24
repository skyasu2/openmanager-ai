/**
 * Supervisor UIMessageStream Response
 *
 * Creates AI SDK v6 native UIMessageStream Response for direct
 * integration with useChat on the frontend.
 *
 * @version 2.0.0
 */

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from 'ai';

import type { SupervisorRequest, SupervisorMode } from './supervisor-types';
import { selectExecutionMode } from './supervisor-routing';
import { executeSupervisorStream } from './supervisor-single-agent';
import { logger } from '../../lib/logger';
import { flushLangfuse } from '../observability/langfuse';

// ============================================================================
// UIMessageStream Response
// ============================================================================

async function flushLangfuseBestEffort(timeoutMs: number = 350): Promise<void> {
  await Promise.race([
    flushLangfuse(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]).catch((error) => {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'UIMessageStream: Langfuse flush skipped'
    );
  });
}

export function createSupervisorStreamResponse(
  request: SupervisorRequest
): Response {
  logger.info(`[UIMessageStream] Creating native stream for session: ${request.sessionId}`);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const startTime = Date.now();
      const nonce = generateId();

      let messageSeq = 0;
      let currentMessageId = `assistant-${request.sessionId}-${startTime}-${nonce}-${messageSeq}`;

      let textPartStarted = false;

      try {
        writer.write({
          type: 'data-start',
          data: {
            sessionId: request.sessionId,
            timestamp: new Date().toISOString(),
          },
        });

        let mode: SupervisorMode = request.mode || 'auto';
        if (mode === 'auto') {
          const lastUserMessage = request.messages.filter((m) => m.role === 'user').pop();
          mode = lastUserMessage ? selectExecutionMode(lastUserMessage.content) : 'single';
        }

        writer.write({
          type: 'data-mode',
          data: { mode },
        });

        for await (const event of executeSupervisorStream({ ...request, mode })) {
          switch (event.type) {
            case 'text_delta':
              if (!textPartStarted) {
                writer.write({
                  type: 'text-start',
                  id: currentMessageId,
                });
                textPartStarted = true;
              }

              writer.write({
                type: 'text-delta',
                delta: event.data as string,
                id: currentMessageId,
              });
              break;

            case 'handoff':
              if (textPartStarted) {
                writer.write({
                  type: 'text-end',
                  id: currentMessageId,
                });
                textPartStarted = false;
              }

              messageSeq += 1;
              currentMessageId = `assistant-${request.sessionId}-${startTime}-${nonce}-${messageSeq}`;

              writer.write({
                type: 'data-handoff',
                data: event.data as object,
              });
              break;

            case 'tool_call':
              writer.write({
                type: 'data-tool-call',
                data: event.data as object,
              });
              break;

            case 'tool_result':
              writer.write({
                type: 'data-tool-result',
                data: event.data as object,
              });
              break;

            case 'warning':
              writer.write({
                type: 'data-warning',
                data: event.data as object,
              });
              break;

            case 'agent_status':
              writer.write({
                type: 'data-agent-status',
                data: event.data as object,
              });
              break;

            case 'done':
              if (textPartStarted) {
                writer.write({
                  type: 'text-end',
                  id: currentMessageId,
                });
                textPartStarted = false;
              }

              const doneData = event.data as Record<string, unknown>;
              const upstreamSuccess = doneData.success;
              const success = typeof upstreamSuccess === 'boolean' ? upstreamSuccess : true;

              writer.write({
                type: 'data-done',
                data: {
                  durationMs: Date.now() - startTime,
                  ...doneData,
                  success,
                },
              });

              // Cloud Run cpu-throttling 환경에서 stream trace 지연 업로드를 완화.
              await flushLangfuseBestEffort();
              break;

            case 'error':
              if (textPartStarted) {
                writer.write({
                  type: 'text-end',
                  id: currentMessageId,
                });
                textPartStarted = false;
              }

              const errorData = event.data as Record<string, unknown>;
              writer.write({
                type: 'error',
                errorText: (errorData.error as string) ?? (errorData.message as string) ?? 'Unknown error',
              });
              break;

            default:
              writer.write({
                type: `data-${event.type}` as `data-${string}`,
                data: typeof event.data === 'object' ? event.data as object : { value: event.data },
              });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[UIMessageStream] Error:`, errorMessage);

        if (textPartStarted) {
          writer.write({
            type: 'text-end',
            id: currentMessageId,
          });
        }

        writer.write({
          type: 'error',
          errorText: errorMessage,
        });
      }
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      'X-Session-Id': request.sessionId,
      'X-Stream-Protocol': 'ui-message-stream',
    },
  });
}
