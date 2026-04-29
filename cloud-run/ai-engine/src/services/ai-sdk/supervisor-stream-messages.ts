import type { ModelMessage, UserContent } from 'ai';
import { buildMultimodalContent } from '../../lib/ai-sdk-utils';
import { createSystemPrompt } from './supervisor-routing';
import type { SupervisorRequest } from './supervisor-types';

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
        return {
          role: 'user',
          content: buildMultimodalContent(
            message.content,
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
