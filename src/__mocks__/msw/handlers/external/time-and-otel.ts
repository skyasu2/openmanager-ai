/**
 * External resource handlers used during tests.
 *
 * - worldtimeapi: stabilizes time-sync tests without real network dependency
 * - /data/otel-data/*: serves fixture files to prevent passthrough warnings
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpResponse, http } from 'msw';

const OTEL_DATA_CACHE = new Map<string, string>();

async function loadOtelFile(relativePath: string): Promise<string | null> {
  const normalized = relativePath.replace(/^\/+/, '');

  if (OTEL_DATA_CACHE.has(normalized)) {
    return OTEL_DATA_CACHE.get(normalized) ?? null;
  }

  try {
    const filePath = path.join(
      process.cwd(),
      'public',
      'data',
      'otel-data',
      normalized
    );
    const content = await readFile(filePath, 'utf-8');
    OTEL_DATA_CACHE.set(normalized, content);
    return content;
  } catch {
    return null;
  }
}

export const externalResourceHandlers = [
  http.get('https://worldtimeapi.org/api/timezone/Asia/Seoul', () => {
    return HttpResponse.json({
      datetime: '2026-02-21T21:00:00.000+09:00',
      timezone: 'Asia/Seoul',
      utc_offset: '+09:00',
      unixtime: 1771675200,
    });
  }),

  // Local test environments are not on GCP metadata network.
  // Return a network error to drive the "local environment" code path
  // without unhandled-request warnings.
  http.get(
    'http://metadata.google.internal/computeMetadata/v1/project/project-id',
    () => {
      return HttpResponse.error();
    }
  ),

  // Host-agnostic match for jsdom relative fetches and absolute URLs.
  http.get(/\/data\/otel-data\/(.+)$/, async ({ request }) => {
    const url = new URL(request.url);
    const marker = '/data/otel-data/';
    const idx = url.pathname.indexOf(marker);
    if (idx < 0) {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const relativePath = url.pathname.slice(idx + marker.length);
    const content = await loadOtelFile(relativePath);
    if (!content) {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new HttpResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }),
];
