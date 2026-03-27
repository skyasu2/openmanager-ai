import type { ModelMessage, UserContent } from 'ai';
import { buildMultimodalContent } from '../../lib/ai-sdk-utils';
import { createSystemPrompt } from './supervisor-routing';
import type { SupervisorRequest } from './supervisor-types';

export function getLastUserQueryText(
  messages: SupervisorRequest['messages']
): string {
  return messages.filter((message) => message.role === 'user').pop()?.content || '';
}

export function buildSupervisorStreamMessages(
  request: SupervisorRequest
): ModelMessage[] {
  return [
    { role: 'system', content: createSystemPrompt(request.deviceType) },
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
