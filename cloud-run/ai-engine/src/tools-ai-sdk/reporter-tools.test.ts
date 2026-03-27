/**
 * Reporter Tools Unit Tests
 *
 * P0 Priority Tests for Tavily web search - validates tool configuration
 * and return structure without hitting real APIs.
 *
 * All external dependencies are mocked to ensure:
 * - No network calls during tests
 * - Fast, deterministic test execution
 * - CI/CD pipeline reliability
 *
 * @version 2.0.0
 * @created 2026-01-04
 * @updated 2026-02-18 — Mock tavily-hybrid-rag (SSOT) instead of @tavily/core
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Mock Setup - All external dependencies mocked before imports
// ============================================================================

// Hoisted mock references — accessible inside vi.mock() factories
const { mockExecuteSearch, mockIsTavilyAvailable } = vi.hoisted(() => ({
  mockExecuteSearch: vi.fn(),
  mockIsTavilyAvailable: vi.fn(),
}));

// Mock the SSOT module (tavily-hybrid-rag) that web-search.ts imports from
vi.mock('../lib/tavily-hybrid-rag', () => ({
  executeTavilySearchWithFailover: mockExecuteSearch,
  isTavilyAvailable: mockIsTavilyAvailable,
}));

// Mock quota tracker
vi.mock('../services/resilience/quota-tracker', () => ({
  recordProviderUsage: vi.fn().mockResolvedValue(undefined),
  getQuotaStatus: vi.fn().mockResolvedValue({ shouldPreemptiveFallback: false }),
}));

// Mock logger
vi.mock('../lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Mock Supabase to avoid connection attempts
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ rpc: vi.fn() })),
}));

// Mock embedding/rag functions (used by knowledge tool, not web-search, but needed for barrel import)
vi.mock('../lib/embedding', () => ({
  searchWithEmbedding: vi.fn().mockResolvedValue({ success: false, results: [] }),
  embedText: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/llamaindex-rag-service', () => ({
  hybridGraphSearch: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/config-parser', () => ({
  getTavilyApiKey: vi.fn(),
  getTavilyApiKeyBackup: vi.fn(),
  getSupabaseConfig: vi.fn(),
}));

// Import after mocking
import { searchWeb } from './reporter-tools';

describe('Reporter Tools - Web Search Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // 1. Tool Definition Tests
  // ============================================================================
  describe('Tool Definition', () => {
    it('should have correct tool description', () => {
      expect(searchWeb.description).toContain('웹 검색');
    });

    it('should have inputSchema with required query parameter', () => {
      const schema = searchWeb.inputSchema;
      expect(schema).toBeDefined();
      expect(schema.shape?.query).toBeDefined();
    });
  });

  // ============================================================================
  // 2. API Key Configuration Tests
  // ============================================================================
  describe('API Key Configuration', () => {
    it('should return error when Tavily is not available', async () => {
      mockIsTavilyAvailable.mockReturnValue(false);

      const result = await searchWeb.execute({
        query: 'test query',
        maxResults: 5,
        searchDepth: 'basic',
        includeDomains: [],
        excludeDomains: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tavily API key not configured');
      expect(result._source).toBe('Tavily (Unconfigured)');
    });

    it('should check isTavilyAvailable before searching', async () => {
      mockIsTavilyAvailable.mockReturnValue(false);

      await searchWeb.execute({ query: 'test query' });

      expect(mockIsTavilyAvailable).toHaveBeenCalled();
      expect(mockExecuteSearch).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 3. Return Structure Tests
  // ============================================================================
  describe('Return Structure', () => {
    it('should return correct structure on unavailable error', async () => {
      mockIsTavilyAvailable.mockReturnValue(false);

      const result = await searchWeb.execute({ query: 'test query' });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('_source');
      expect(result).toHaveProperty('results');
      expect(result.results).toEqual([]);
    });

    it('should include error in result when Tavily unavailable', async () => {
      mockIsTavilyAvailable.mockReturnValue(false);

      const result = await searchWeb.execute({ query: 'docker container logs' });

      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // 4. Input Validation Tests
  // ============================================================================
  describe('Input Handling', () => {
    it('should accept query with default options', async () => {
      mockIsTavilyAvailable.mockReturnValue(false);

      const result = await searchWeb.execute({ query: 'kubernetes pods' });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it('should handle all optional parameters', async () => {
      mockIsTavilyAvailable.mockReturnValue(false);

      const result = await searchWeb.execute({
        query: 'test query',
        maxResults: 10,
        searchDepth: 'advanced',
        includeDomains: ['docs.example.com'],
        excludeDomains: ['spam.com'],
      });

      expect(result).toBeDefined();
    });
  });
});

// ============================================================================
// 5. Mocked API Call Tests (No Network)
// Note: Each test uses a unique query to avoid module-level cache interference
// ============================================================================
describe('Reporter Tools - Tavily API Mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTavilyAvailable.mockReturnValue(true);
  });

  it('should return success when search succeeds', async () => {
    mockExecuteSearch.mockResolvedValue({
      results: [
        { title: 'Test Result', url: 'https://example.com', content: 'Test content', score: 0.95 },
      ],
      answer: 'Mocked answer',
    });

    const result = await searchWeb.execute({
      query: 'success test query unique-1',
      maxResults: 5,
      searchDepth: 'basic',
    });

    expect(result.success).toBe(true);
    expect(result._source).toBe('Tavily Web Search');
    expect(result.results).toHaveLength(1);
    expect(result.answer).toBe('Mocked answer');
  });

  it('should succeed via failover (transparent via Promise.any)', async () => {
    // Failover is handled inside executeTavilySearchWithFailover (SSOT).
    // From web-search tool's perspective, it just gets a successful result.
    mockExecuteSearch.mockResolvedValue({
      results: [{ title: 'Backup Result', url: 'https://backup.com', content: 'Backup content', score: 0.8 }],
      answer: null,
    });

    const result = await searchWeb.execute({
      query: 'failover test query unique-2',
      maxResults: 5,
      searchDepth: 'basic',
    });

    expect(result.success).toBe(true);
    expect(result._source).toBe('Tavily Web Search');
    expect(result.results).toHaveLength(1);
  });

  it('should return error when search fails (AggregateError)', async () => {
    const aggError = new AggregateError(
      [new Error('Primary failed'), new Error('Backup failed')],
      'All promises were rejected',
    );
    mockExecuteSearch.mockRejectedValue(aggError);

    const result = await searchWeb.execute({
      query: 'both keys fail query unique-3',
      maxResults: 5,
      searchDepth: 'basic',
    });

    expect(result.success).toBe(false);
    expect(result._source).toBe('Tavily (Failed)');
    expect(result.error).toContain('Primary failed');
    expect(result.error).toContain('Backup failed');
  });

  it('should return error when search throws regular Error', async () => {
    mockExecuteSearch.mockRejectedValue(new Error('API Error'));

    const result = await searchWeb.execute({
      query: 'primary fail no backup unique-4',
      maxResults: 5,
      searchDepth: 'basic',
    });

    expect(result.success).toBe(false);
    expect(result._source).toBe('Tavily (Failed)');
    expect(result.error).toBe('API Error');
  });

  it('should truncate long content to 1500 chars', async () => {
    const longContent = 'x'.repeat(3000);
    mockExecuteSearch.mockResolvedValue({
      results: [{ title: 'Long', url: 'https://example.com', content: longContent, score: 0.9 }],
      answer: null,
    });

    const result = await searchWeb.execute({
      query: 'truncation test unique-5',
    });

    expect(result.success).toBe(true);
    expect(result.results[0].content.length).toBe(1500);
  });
});
