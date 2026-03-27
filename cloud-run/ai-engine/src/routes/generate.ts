/**
 * Generate Routes
 *
 * Text generation endpoints (streaming and non-streaming).
 *
 * @version 1.0.0
 * @created 2025-12-28
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { generateService } from '../services/generate/generate-service';
import { handleApiError, handleValidationError, jsonSuccess } from '../lib/error-handler';
import { sanitizeChineseCharacters } from '../lib/text-sanitizer';

export const generateRouter = new Hono();

/**
 * POST /generate - Text generation (non-streaming)
 */
generateRouter.post('/', async (c: Context) => {
  try {
    const { prompt, options } = await c.req.json();

    if (!prompt) {
      return handleValidationError(c, 'prompt is required');
    }

    const result = await generateService.generate(prompt, options || {});

    // Sanitize Chinese characters from LLM output
    if (result && typeof result === 'object' && 'text' in result) {
      (result as { text: string }).text = sanitizeChineseCharacters((result as { text: string }).text);
    }

    return c.json(result);
  } catch (error) {
    return handleApiError(c, error, 'Generate');
  }
});

/**
 * POST /generate/stream - Text generation (streaming SSE)
 */
generateRouter.post('/stream', async (c: Context) => {
  try {
    const { prompt, options } = await c.req.json();

    if (!prompt) {
      return handleValidationError(c, 'prompt is required');
    }

    const stream = await generateService.generateStream(prompt, options || {});

    if (!stream) {
      return c.json({
        success: false,
        error: 'Failed to create stream',
        timestamp: new Date().toISOString(),
      }, 500);
    }

    // Set headers for SSE streaming
    c.header('Content-Type', 'text/event-stream; charset=utf-8');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return c.body(stream);
  } catch (error) {
    return handleApiError(c, error, 'Generate Stream');
  }
});

/**
 * GET /generate/stats - Generate service statistics
 */
generateRouter.get('/stats', (c: Context) => {
  const stats = generateService.getStats();
  return jsonSuccess(c, stats);
});
