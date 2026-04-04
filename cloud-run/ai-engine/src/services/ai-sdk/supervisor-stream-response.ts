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

import type { SupervisorRequest } from './supervisor-types';
import {
  buildSupervisorModeMetadata,
  resolveSupervisorModeDecision,
} from './supervisor-mode';
import { executeSupervisorStream } from './supervisor-single-agent';
import { getPublicErrorResponse, sanitizeErrorData } from '../../lib/error-handler';
import { logger } from '../../lib/logger';
import { flushLangfuseBestEffort } from '../observability/langfuse-flush';

// ============================================================================
// UIMessageStream Response
// ============================================================================

const RESPONSE_SUMMARY_CHAR_THRESHOLD = 680;
const RESPONSE_SUMMARY_LINE_THRESHOLD = 14;

interface AssistantResponseSummary {
  summary: string;
  details: string | null;
  shouldCollapse: boolean;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function createAssistantResponseSummary(content: string): AssistantResponseSummary {
  const normalized = typeof content === 'string' ? content.trim() : '';
  if (!normalized) {
    return { summary: '', details: null, shouldCollapse: false };
  }

  const lines = normalized
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const isLong =
    normalized.length >= RESPONSE_SUMMARY_CHAR_THRESHOLD ||
    lines.length >= RESPONSE_SUMMARY_LINE_THRESHOLD;

  if (!isLong) {
    return {
      summary: normalized,
      details: null,
      shouldCollapse: false,
    };
  }

  const paragraphs = splitIntoParagraphs(normalized);
  if (paragraphs.length >= 2) {
    const firstParagraph = paragraphs[0];
    if (!firstParagraph) {
      return { summary: normalized, details: null, shouldCollapse: false };
    }

    let summary = firstParagraph;
    let detailsStartIndex = 1;

    const isHeadingOnly =
      /^#{1,3}\s.+$/m.test(summary) && summary.length <= 80;
    const secondParagraph = paragraphs[1];
    if (isHeadingOnly && secondParagraph) {
      summary = `${summary}\n\n${secondParagraph}`;
      detailsStartIndex = 2;
    }

    const details = paragraphs.slice(detailsStartIndex).join('\n\n').trim();
    if (details.length > 0) {
      return {
        summary,
        details,
        shouldCollapse: true,
      };
    }
  }

  const sentences = splitSentences(normalized);
  if (sentences.length >= 3) {
    const summary = sentences.slice(0, 2).join(' ').trim();
    const details = sentences.slice(2).join(' ').trim();
    if (summary && details) {
      return {
        summary,
        details,
        shouldCollapse: true,
      };
    }
  }

  return {
    summary: normalized,
    details: null,
    shouldCollapse: false,
  };
}

function isStringValue(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isStringValue(value);
}

function isBooleanValue(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function getStructuredResponseSummary(
  doneData: Record<string, unknown>,
  fallback: AssistantResponseSummary
): { summary: string; details: string | null; shouldCollapse: boolean } {
  const responseSummary = isStringValue(doneData.responseSummary)
    ? doneData.responseSummary
    : isStringValue(doneData.summary)
      ? doneData.summary
      : undefined;

  const responseDetails = isNullableString(doneData.responseDetails)
    ? (doneData.responseDetails ?? null)
    : isNullableString(doneData.details)
      ? (doneData.details ?? null)
      : undefined;

  const responseShouldCollapse = isBooleanValue(doneData.responseShouldCollapse)
    ? doneData.responseShouldCollapse
    : isBooleanValue(doneData.shouldCollapse)
      ? doneData.shouldCollapse
      : fallback.shouldCollapse;

  const summary = isStringValue(responseSummary)
    ? responseSummary
    : fallback.summary;

  const details = isNullableString(responseDetails)
    ? responseDetails
    : fallback.details;

  return {
    summary,
    details: typeof details === 'string' ? details : null,
    shouldCollapse: typeof summary === 'string' && summary.trim().length > 0
      ? responseShouldCollapse
      : false,
  };
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
      let responseText = '';

      let textPartStarted = false;

      try {
        writer.write({
          type: 'data-start',
          data: {
            sessionId: request.sessionId,
            timestamp: new Date().toISOString(),
          },
        });

        const modeDecision = resolveSupervisorModeDecision(request);

        writer.write({
          type: 'data-mode',
          data: {
            mode: modeDecision.resolvedMode,
            ...buildSupervisorModeMetadata(modeDecision),
          },
        });

        for await (const event of executeSupervisorStream(request)) {
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
              if (typeof event.data === 'string') {
                responseText += event.data;
              }
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
              const summary = createAssistantResponseSummary(responseText);
              const responseSummaryView = getStructuredResponseSummary(
                doneData,
                summary
              );
              const normalizedResponseSummary = responseSummaryView.summary.trim();

              writer.write({
                type: 'data-done',
                data: {
                  durationMs: Date.now() - startTime,
                  ...doneData,
                  ...(normalizedResponseSummary
                    ? {
                        responseSummary: responseSummaryView.summary,
                        responseDetails:
                          responseSummaryView.shouldCollapse
                            ? responseSummaryView.details
                            : null,
                        responseShouldCollapse: responseSummaryView.shouldCollapse,
                      }
                    : {}),
                  success,
                },
              });

              // Cloud Run cpu-throttling 환경에서 stream trace 지연 업로드를 완화.
              await flushLangfuseBestEffort('UIMessageStream');
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
              const publicError = sanitizeErrorData(errorData);
              writer.write({
                type: 'error',
                errorText:
                  (publicError.error as string) ??
                  (publicError.message as string) ??
                  'Internal Server Error',
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
        const publicError = getPublicErrorResponse(error);
        logger.error(`[UIMessageStream] Error:`, errorMessage);

        if (textPartStarted) {
          writer.write({
            type: 'text-end',
            id: currentMessageId,
          });
        }

        writer.write({
          type: 'error',
          errorText: publicError.message,
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
