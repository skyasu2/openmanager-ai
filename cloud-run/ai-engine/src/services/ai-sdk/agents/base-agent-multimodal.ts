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

  const content: Array<TextPart | ImagePart | FilePart> = [];

  if (hasImages) {
    const imageCount = options.images!.length;
    options.images!.forEach((image, index) => {
      if (imageCount > 1) {
        content.push({
          type: 'text',
          text: `image ${index + 1}${image.name ? `: ${image.name}` : ''}`,
        } as TextPart);
      }
      content.push({
        type: 'image',
        image: image.data,
        mimeType: image.mimeType,
      } as ImagePart);
    });
    logger.debug(`[${agentName}] Added ${options.images!.length} image(s) to message`);
  }

  if (hasFiles) {
    const fileCount = options.files!.length;
    options.files!.forEach((file, index) => {
      if (fileCount > 1) {
        content.push({
          type: 'text',
          text: `file ${index + 1}${file.name ? `: ${file.name}` : ''}`,
        } as TextPart);
      }
      content.push({
        type: 'file',
        data: file.data,
        mediaType: file.mimeType,
      } as FilePart);
    });
    logger.debug(`[${agentName}] Added ${options.files!.length} file(s) to message`);
  }

  content.push({ type: 'text', text: query } as TextPart);

  return content;
}
