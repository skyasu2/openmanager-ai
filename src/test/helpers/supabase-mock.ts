/**
 * 🧪 Supabase Mock Helper
 * 완전한 Supabase 클라이언트 Mock 및 Builder 패턴 제공
 */

import { expect, type Mock, vi } from 'vitest';

export interface MockQueryResponse<T = unknown> {
  data: T | null;
  error: unknown | null;
}

export interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  like: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  containedBy: ReturnType<typeof vi.fn>;
  rangeGt: ReturnType<typeof vi.fn>;
  rangeGte: ReturnType<typeof vi.fn>;
  rangeLt: ReturnType<typeof vi.fn>;
  rangeLte: ReturnType<typeof vi.fn>;
  rangeAdjacent: ReturnType<typeof vi.fn>;
  overlaps: ReturnType<typeof vi.fn>;
  textSearch: ReturnType<typeof vi.fn>;
  match: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  filter: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  csv: ReturnType<typeof vi.fn>;
  geojson: ReturnType<typeof vi.fn>;
  explain: ReturnType<typeof vi.fn>;
  rollback: ReturnType<typeof vi.fn>;
  returns: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
}

/**
 * Builder 패턴으로 Supabase Mock 생성
 */
export class SupabaseMockBuilder<T = unknown> {
  private mockData: T | T[] = [];
  private mockError: unknown | null = null;
  private customResponses: Map<string, unknown> = new Map();

  /**
   * 기본 데이터 설정
   */
  withData(data: T | T[]): this {
    this.mockData = data;
    return this;
  }

  /**
   * 에러 설정
   */
  withError(error: unknown): this {
    this.mockError = error;
    return this;
  }

  /**
   * 특정 메서드에 대한 커스텀 응답 설정
   */
  withCustomResponse(method: string, response: unknown): this {
    this.customResponses.set(method, response);
    return this;
  }

  /**
   * 벡터 검색 결과 설정
   */
  withVectorSearchResults(results: unknown[]): this {
    return this.withCustomResponse('rpc', {
      data: results,
      error: null,
    });
  }

  /**
   * 테이블 스키마 정보 설정
   */
  withTableSchema(schema: unknown): this {
    return this.withCustomResponse('describe', {
      data: schema,
      error: null,
    });
  }

  /**
   * Mock QueryBuilder 생성
   */
  build(): MockQueryBuilder {
    const defaultResponse: MockQueryResponse = {
      data: this.mockData,
      error: this.mockError,
    };

    // 체인 가능한 메서드들
    const chainableMethods = [
      'select',
      'insert',
      'upsert',
      'update',
      'delete',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'like',
      'ilike',
      'is',
      'in',
      'contains',
      'containedBy',
      'rangeGt',
      'rangeGte',
      'rangeLt',
      'rangeLte',
      'rangeAdjacent',
      'overlaps',
      'textSearch',
      'match',
      'not',
      'or',
      'filter',
      'order',
      'limit',
      'range',
      'returns',
    ];

    // 종료 메서드들
    const terminalMethods = [
      'single',
      'maybeSingle',
      'csv',
      'geojson',
      'explain',
      'rollback',
    ];

    const mockBuilder: Partial<MockQueryBuilder> = {};

    // 체인 가능한 메서드들 - this 반환
    chainableMethods.forEach((method) => {
      mockBuilder[method as keyof MockQueryBuilder] = vi
        .fn()
        .mockReturnValue(mockBuilder);
    });

    // 종료 메서드들 - Promise 반환
    terminalMethods.forEach((method) => {
      const customResponse = this.customResponses.get(method);
      mockBuilder[method as keyof MockQueryBuilder] = vi
        .fn()
        .mockResolvedValue(customResponse || defaultResponse);
    });

    // then 메서드 - Promise 체인용
    // biome-ignore lint/suspicious/noThenProperty: Supabase QueryBuilder is Thenable
    mockBuilder.then = vi.fn().mockResolvedValue(defaultResponse);

    return mockBuilder as MockQueryBuilder;
  }

  /**
   * 기본 설정으로 Mock 생성
   */
  static createDefault(): MockQueryBuilder {
    return new SupabaseMockBuilder().withData([]).withError(null).build();
  }

  /**
   * 벡터 DB용 Mock 생성
   */
  static createForVectorDB(): MockQueryBuilder {
    return new SupabaseMockBuilder()
      .withData([])
      .withError(null)
      .withVectorSearchResults([
        {
          id: '1',
          content: 'Test content',
          similarity: 0.85,
          metadata: { category: 'test' },
        },
      ])
      .build();
  }

  /**
   * RAG 엔진용 Mock 생성
   */
  static createForRAG(): MockQueryBuilder {
    return new SupabaseMockBuilder()
      .withData({
        total_documents: 10,
        total_categories: 3,
      })
      .withError(null)
      .withCustomResponse('single', {
        data: { total_documents: 10, total_categories: 3 },
        error: null,
      })
      .build();
  }
}

/**
 * 완전한 Supabase 클라이언트 Mock
 */
export function createSupabaseMock(builder?: SupabaseMockBuilder) {
  const queryBuilder = builder
    ? builder.build()
    : SupabaseMockBuilder.createDefault();

  const mockClient = {
    from: vi.fn(() => queryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      signIn: vi.fn().mockResolvedValue({ data: null, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  };

  return {
    supabase: mockClient,
    // 함수형 export 지원
    getSupabase: vi.fn(() => mockClient),
    getSupabaseClient: vi.fn(() => mockClient),
  };
}

/**
 * 테스트용 유틸리티 함수들
 */
export const TestUtils = {
  /**
   * Mock 함수 호출 횟수 초기화
   */
  resetMocks: (mocks: Mock[]) => {
    mocks.forEach((mock) => {
      mock.mockClear();
    });
  },

  /**
   * 비동기 테스트 대기
   */
  waitFor: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Mock 응답 검증
   */
  expectMockCalled: (mock: Mock, times: number = 1) => {
    expect(mock).toHaveBeenCalledTimes(times);
  },
};
