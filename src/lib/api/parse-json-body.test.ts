/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { parseJsonBody } from './parse-json-body';

function createRequest(body: string | null, contentType?: string): Request {
  const headers = new Headers();
  if (contentType) {
    headers.set('content-type', contentType);
  }
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers,
    body,
  });
}

describe('parseJsonBody', () => {
  // Given: Content-Type이 application/json이 아닌 요청
  it('should return 415 when Content-Type is missing', async () => {
    const request = createRequest('{}');

    // When
    const result = await parseJsonBody(request);

    // Then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(415);
    }
  });

  it('should return 415 when Content-Type is text/plain', async () => {
    const request = createRequest('{}', 'text/plain');

    const result = await parseJsonBody(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(415);
    }
  });

  // Given: 유효한 JSON 요청
  it('should parse valid JSON body', async () => {
    const request = createRequest(
      JSON.stringify({ action: 'reset', service: 'ai' }),
      'application/json'
    );

    const result = await parseJsonBody<{ action: string; service: string }>(
      request
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe('reset');
      expect(result.data.service).toBe('ai');
    }
  });

  it('should accept application/json with charset', async () => {
    const request = createRequest(
      JSON.stringify({ ok: true }),
      'application/json; charset=utf-8'
    );

    const result = await parseJsonBody(request);

    expect(result.success).toBe(true);
  });

  // Given: 잘못된 JSON 요청
  it('should return 400 for malformed JSON', async () => {
    const request = createRequest('{invalid json', 'application/json');

    const result = await parseJsonBody(request);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
    }
  });

  it('should return typed data', async () => {
    type Payload = { count: number; items: string[] };
    const payload: Payload = { count: 2, items: ['a', 'b'] };
    const request = createRequest(JSON.stringify(payload), 'application/json');

    const result = await parseJsonBody<Payload>(request);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.count).toBe(2);
      expect(result.data.items).toEqual(['a', 'b']);
    }
  });
});
