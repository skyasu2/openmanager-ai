import type { FilePart, ImagePart, TextPart, UserContent } from 'ai';
import { logger } from '../../../lib/logger';
import type { AgentRunOptions } from './base-agent-types';

export function buildUserContent(
  agentName: string,
  query: string,
  options: AgentRunOptions
): UserContent {
  const hasImages = options.images && options.images.length > 0;
  const hasFiles = options.files && options.files.length > 0;

  if (!hasImages && !hasFiles) {
    return query;
  }

  const content: Array<TextPart | ImagePart | FilePart> = [
    { type: 'text', text: query } as TextPart,
  ];

  if (hasImages) {
    for (const image of options.images!) {
      content.push({
        type: 'image',
        image: image.data,
        mimeType: image.mimeType,
      } as ImagePart);
    }
    logger.debug(`[${agentName}] Added ${options.images!.length} image(s) to message`);
  }

  if (hasFiles) {
    for (const file of options.files!) {
      content.push({
        type: 'file',
        data: file.data,
        mediaType: file.mimeType,
      } as FilePart);
    }
    logger.debug(`[${agentName}] Added ${options.files!.length} file(s) to message`);
  }

  return content;
}
