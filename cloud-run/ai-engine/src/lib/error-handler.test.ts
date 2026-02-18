import { describe, expect, it, vi } from 'vitest';

// Mock logger before import
vi.mock('./logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Mock Hono context
function createMockContext() {
  const jsonFn = vi.fn((body: unknown, status?: number) => {
    return { body, status: status ?? 200 } as unknown as Response;
  });
  return { json: jsonFn } as unknown as import('hono').Context;
}

// We need to test classifyError which is not exported, so we test via handleApiError
import { handleApiError, handleNotFoundError, handleUnauthorizedError, handleValidationError, jsonSuccess, jsonSuccessData } from './error-handler';

describe('handleApiError (classifyError integration)', () => {
  it('should return 401 for auth-related errors', () => {
    const c = createMockContext();
    handleApiError(c, new Error('Invalid API key'));
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, code: 'AUTH_ERROR' }),
      401
    );
  });

  it('should return 429 for rate limit errors', () => {
    const c = createMockContext();
    handleApiError(c, new Error('Rate limit exceeded'));
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'RATE_LIMIT' }),
      429
    );
  });

  it('should return 429 for quota errors', () => {
    const c = createMockContext();
    handleApiError(c, new Error('Quota exceeded, too many requests'));
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'RATE_LIMIT' }),
      429
    );
  });

  it('should return 504 for timeout errors', () => {
    const c = createMockContext();
    handleApiError(c, new Error('Request timed out'));
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TIMEOUT' }),
      504
    );
  });

  it('should return 503 for model/provider errors', () => {
    const c = createMockContext();
    handleApiError(c, new Error('Model provider unavailable'));
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MODEL_ERROR' }),
      503
    );
  });

  it('should return 400 for validation errors', () => {
    const c = createMockContext();
    handleApiError(c, new Error('Required field missing'));
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      400
    );
  });

  it('should return 404 for not-found errors', () => {
    const c = createMockContext();
    handleApiError(c, new Error('Resource not found'));
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_FOUND' }),
      404
    );
  });

  it('should return 500 for unknown errors', () => {
    const c = createMockContext();
    handleApiError(c, new Error('Something unexpected happened'));
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      500
    );
  });

  it('should handle non-Error objects', () => {
    const c = createMockContext();
    handleApiError(c, 'string error message');
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
      500
    );
  });
});

describe('handleValidationError', () => {
  it('should return 400 with validation error code', () => {
    const c = createMockContext();
    handleValidationError(c, 'Email is required');
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Email is required', code: 'VALIDATION_ERROR' }),
      400
    );
  });
});

describe('handleNotFoundError', () => {
  it('should return 404 with resource name', () => {
    const c = createMockContext();
    handleNotFoundError(c, 'Server');
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Server not found', code: 'NOT_FOUND' }),
      404
    );
  });
});

describe('handleUnauthorizedError', () => {
  it('should return 401', () => {
    const c = createMockContext();
    handleUnauthorizedError(c);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
      401
    );
  });
});

describe('jsonSuccess', () => {
  it('should wrap data with success and timestamp', () => {
    const c = createMockContext();
    jsonSuccess(c, { count: 5 });
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, count: 5, timestamp: expect.any(String) }),
      200
    );
  });
});

describe('jsonSuccessData', () => {
  it('should wrap data in data field', () => {
    const c = createMockContext();
    jsonSuccessData(c, [1, 2, 3]);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: [1, 2, 3] }),
      200
    );
  });
});
