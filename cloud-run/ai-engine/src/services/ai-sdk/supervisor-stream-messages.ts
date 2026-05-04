import type { ModelMessage, UserContent } from 'ai';
import { buildMultimodalContent } from '../../lib/ai-sdk-utils';
import { createSystemPrompt } from './supervisor-routing';
import type { SupervisorRequest } from './supervisor-types';
import { isFormattingOnlyReportRequest } from './query-routing-signals';

export function getLastUserQueryText(
  messages: SupervisorRequest['messages']
): string {
  return messages.filter((message) => message.role === 'user').pop()?.content || '';
}

function buildQueryAsOfInstruction(
  queryAsOf: SupervisorRequest['queryAsOf']
): string | undefined {
  if (!queryAsOf) return undefined;
  const { dataSlot } = queryAsOf;
  return [
    '데이터 기준 슬롯:',
    `${dataSlot.timeLabel} (slot ${dataSlot.slotIndex}/143).`,
    '현재 서버 메트릭 질문은 이 슬롯의 도구 결과만 기준으로 답하세요.',
    'worker 실행 시각의 다른 슬롯으로 재해석하지 마세요.',
  ].join(' ');
}

const PRIOR_ASSISTANT_CONTEXT_LIMIT = 4_000;

function readPreviousAssistantContent(
  messages: SupervisorRequest['messages'],
  beforeIndex: number
): string | undefined {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== 'assistant') continue;

    const content = message.content.trim();
    if (content.length > 0) return content;
  }

  return undefined;
}

function buildFormattingRewriteContent(
  userRequest: string,
  previousAssistantContent: string
): string {
  const clipped =
    previousAssistantContent.length > PRIOR_ASSISTANT_CONTEXT_LIMIT
      ? `${previousAssistantContent.slice(0, PRIOR_ASSISTANT_CONTEXT_LIMIT)}\n[직전 답변 일부 생략]`
      : previousAssistantContent;

  return [
    '아래 직전 assistant 답변만 근거로 사용자 재작성 요청을 수행하세요.',
    '서버 ID, 순위, 수치, 단위는 직전 답변과 정확히 일치시켜야 합니다.',
    '새 데이터 조회, 새 분석, 새 권고를 추가하지 마세요.',
    '',
    '[직전 assistant 답변]',
    clipped,
    '',
    '[사용자 재작성 요청]',
    userRequest,
  ].join('\n');
}

export function buildSupervisorStreamMessages(
  request: SupervisorRequest
): ModelMessage[] {
  const systemPrompt = createSystemPrompt(request.deviceType);
  const queryAsOfInstruction = buildQueryAsOfInstruction(request.queryAsOf);

  return [
    {
      role: 'system',
      content: queryAsOfInstruction
        ? `${systemPrompt}\n\n${queryAsOfInstruction}`
        : systemPrompt,
    },
    ...request.messages.map((message, index): ModelMessage => {
      const isLastUserMessage =
        message.role === 'user' && index === request.messages.length - 1;

      if (isLastUserMessage) {
        const previousAssistantContent = readPreviousAssistantContent(
          request.messages,
          index
        );
        const textContent =
          previousAssistantContent &&
          isFormattingOnlyReportRequest(message.content)
            ? buildFormattingRewriteContent(
                message.content,
                previousAssistantContent
              )
            : message.content;

        return {
          role: 'user',
          content: buildMultimodalContent(
            textContent,
            request.images,
            request.files
          ) as UserContent,
        };
      }

      return {
        role: message.role,
        content: message.content,
      };
    }),
  ];
}
