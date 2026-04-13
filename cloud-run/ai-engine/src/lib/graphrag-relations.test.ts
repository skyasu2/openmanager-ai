import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  extractRelationshipsFromKnowledgeBase,
  normalizeRelationshipType,
  planKnowledgeRelationships,
} from './graphrag-relations';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type KnowledgeBaseRow = {
  id: string;
  title: string;
  category?: string;
  content: string;
  metadata?: Record<string, unknown> | null;
};

type RelationshipRow = {
  id: string;
  source_id: string;
  target_id: string;
  source_table: string;
  target_table: string;
  relationship_type: string;
  weight: number;
  description: string;
  bidirectional: boolean;
  metadata: Record<string, unknown>;
};

function createMockSupabaseClient(
  knowledgeBaseRows: KnowledgeBaseRow[],
  relationshipRows: RelationshipRow[] = []
) {
  let relationshipId = relationshipRows.length;

  function createKnowledgeBaseSelectBuilder() {
    let limitValue: number | undefined;
    let onlyUnprocessed = false;
    let titleFilter: string[] | null = null;

    return {
      limit(value: number) {
        limitValue = value;
        return this;
      },
      in(column: string, values: unknown[]) {
        if (column !== 'title') {
          throw new Error(`Unsupported in column for knowledge_base.select: ${column}`);
        }
        titleFilter = values.map((value) => String(value));
        return this;
      },
      or(filter: string) {
        if (filter.includes('metadata->indexed_by.is.null') || filter.includes('metadata->triplets.is.null')) {
          onlyUnprocessed = true;
        }
        return this;
      },
      then(resolve: (value: { data: KnowledgeBaseRow[]; error: null }) => void) {
        const rows = knowledgeBaseRows.filter((row) => {
          if (titleFilter && !titleFilter.includes(row.title)) {
            return false;
          }

          if (!onlyUnprocessed) {
            return true;
          }

          const metadata = row.metadata || {};
          return metadata.indexed_by == null || metadata.triplets == null;
        });

        resolve({
          data: typeof limitValue === 'number' ? rows.slice(0, limitValue) : [...rows],
          error: null,
        });
      },
    };
  }

  function createRelationshipSelectBuilder() {
    const filters = new Map<string, unknown>();

    return {
      eq(column: string, value: unknown) {
        filters.set(column, value);
        return this;
      },
      limit(_value: number) {
        return this;
      },
      then(resolve: (value: { data: Array<{ id: string }>; error: null }) => void) {
        const rows = relationshipRows.filter((row) =>
          Array.from(filters.entries()).every(([column, value]) => row[column as keyof RelationshipRow] === value)
        );
        resolve({
          data: rows.map((row) => ({ id: row.id })),
          error: null,
        });
      },
    };
  }

  const client = {
    from(table: string) {
      if (table === 'knowledge_base') {
        return {
          select(_columns: string) {
            return createKnowledgeBaseSelectBuilder();
          },
          update(payload: Partial<KnowledgeBaseRow>) {
            return {
              eq(column: string, value: unknown) {
                if (column !== 'id') throw new Error(`Unsupported eq column for knowledge_base.update: ${column}`);
                const row = knowledgeBaseRows.find((entry) => entry.id === value);
                if (row) {
                  Object.assign(row, payload);
                }
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      if (table === 'knowledge_relationships') {
        return {
          select(_columns: string) {
            return createRelationshipSelectBuilder();
          },
          insert(payload: Omit<RelationshipRow, 'id'>) {
            relationshipId += 1;
            relationshipRows.push({
              id: `rel-${relationshipId}`,
              ...payload,
            });
            return Promise.resolve({ error: null });
          },
          update(payload: Partial<RelationshipRow>) {
            return {
              eq(column: string, value: unknown) {
                if (column !== 'id') throw new Error(`Unsupported eq column for knowledge_relationships.update: ${column}`);
                const row = relationshipRows.find((entry) => entry.id === value);
                if (row) {
                  Object.assign(row, payload);
                }
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      throw new Error(`Unsupported table: ${table}`);
    },
  };

  return {
    client,
    knowledgeBaseRows,
    relationshipRows,
  };
}

describe('graphrag-relations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes free-form predicates to supported relationship types', () => {
    expect(normalizeRelationshipType('depends on')).toBe('depends_on');
    expect(normalizeRelationshipType('related to')).toBe('related_to');
    expect(normalizeRelationshipType('causes')).toBe('causes');
    expect(normalizeRelationshipType('unknown phrase')).toBe('related_to');
  });

  it('plans deterministic edges only when the current entry is a strong anchor', () => {
    const sourceEntry = {
      id: 'kb-source',
      title: 'AI 사이드바 응답 지연 점검 순서',
      category: 'troubleshooting',
      content: 'Cloud Run cold start 와 cache miss 를 함께 확인한다.',
      metadata: null,
    };
    const allEntries = [
      sourceEntry,
      {
        id: 'kb-cloudrun',
        title: 'Google Cloud Run 운영 가이드',
        category: 'best_practice',
        content: 'Cloud Run cold start 와 인스턴스 운영 기준을 정리한다.',
        metadata: null,
      },
      {
        id: 'kb-cache',
        title: 'Vercel/Cloud Run 캐시 전략',
        category: 'architecture',
        content: 'cache miss 와 Cloud Run upstream cache path 를 설명한다.',
        metadata: null,
      },
    ];

    const planned = planKnowledgeRelationships(sourceEntry, allEntries, [
      {
        subject: 'AI 사이드바 응답 지연 점검 순서',
        predicate: 'related to',
        object: 'Google Cloud Run 운영 가이드',
        confidence: 0.92,
      },
      {
        subject: 'Vercel/Cloud Run 캐시 전략',
        predicate: 'depends on',
        object: 'AI 사이드바 응답 지연 점검 순서',
        confidence: 0.78,
      },
      {
        subject: '랜덤 외부 개념',
        predicate: 'supports',
        object: '또 다른 개념',
        confidence: 0.9,
      },
    ]);

    expect(planned).toHaveLength(2);
    expect(planned[0]?.relationshipType).toBe('related_to');
    expect(planned[1]?.relationshipType).toBe('depends_on');
    expect(planned.every((entry) => entry.sourceId !== entry.targetId)).toBe(true);
  });

  it('materializes extracted triplets into knowledge_relationships and updates metadata', async () => {
    const store = createMockSupabaseClient([
      {
        id: 'kb-source',
        title: 'AI 사이드바 응답 지연 점검 순서',
        category: 'troubleshooting',
        content: 'Cloud Run cold start 와 cache miss 를 같이 본다.',
        metadata: null,
      },
      {
        id: 'kb-cloudrun',
        title: 'Google Cloud Run 운영 가이드',
        category: 'best_practice',
        content: 'Cloud Run cold start, instance, startup tuning 을 다룬다.',
        metadata: { indexed_by: 'seed', triplets: [] },
      },
      {
        id: 'kb-cache',
        title: 'Vercel/Cloud Run 캐시 전략',
        category: 'architecture',
        content: 'cache miss 와 upstream cache path 를 설명한다.',
        metadata: { indexed_by: 'seed', triplets: [] },
      },
    ]);

    const extractTriplets = vi.fn(async () => [
      {
        subject: 'AI 사이드바 응답 지연 점검 순서',
        predicate: 'related to',
        object: 'Google Cloud Run 운영 가이드',
        confidence: 0.92,
      },
      {
        subject: 'Vercel/Cloud Run 캐시 전략',
        predicate: 'depends on',
        object: 'AI 사이드바 응답 지연 점검 순서',
        confidence: 0.78,
      },
    ]);

    const result = await extractRelationshipsFromKnowledgeBase(
      store.client as never,
      extractTriplets,
      { batchSize: 10, onlyUnprocessed: true }
    );

    expect(extractTriplets).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect(result[0]?.relationships).toHaveLength(2);
    expect(result[0]?.materializedCount).toBe(2);
    expect(result[0]?.insertedCount).toBe(2);
    expect(result[0]?.updatedCount).toBe(0);
    expect(store.relationshipRows).toHaveLength(2);
    expect(store.knowledgeBaseRows[0]?.metadata?.indexed_by).toBe('llamaindex');
    expect(store.knowledgeBaseRows[0]?.metadata?.materialized_relationships).toBe(2);
    expect(store.knowledgeBaseRows[0]?.metadata?.materialized_relationship_inserts).toBe(2);
    expect(store.knowledgeBaseRows[0]?.metadata?.materialized_relationship_updates).toBe(0);
  });

  it('updates an existing relationship instead of duplicating it', async () => {
    const store = createMockSupabaseClient(
      [
        {
          id: 'kb-source',
          title: 'AI 사이드바 응답 지연 점검 순서',
          category: 'troubleshooting',
          content: 'Cloud Run cold start 와 cache miss 를 같이 본다.',
          metadata: null,
        },
        {
          id: 'kb-cloudrun',
          title: 'Google Cloud Run 운영 가이드',
          category: 'best_practice',
          content: 'Cloud Run cold start, instance, startup tuning 을 다룬다.',
          metadata: { indexed_by: 'seed', triplets: [] },
        },
      ],
      [
        {
          id: 'rel-1',
          source_id: 'kb-source',
          target_id: 'kb-cloudrun',
          source_table: 'knowledge_base',
          target_table: 'knowledge_base',
          relationship_type: 'related_to',
          weight: 0.4,
          description: 'old',
          bidirectional: false,
          metadata: {},
        },
      ]
    );

    const result = await extractRelationshipsFromKnowledgeBase(
      store.client as never,
      async () => [
        {
          subject: 'AI 사이드바 응답 지연 점검 순서',
          predicate: 'related to',
          object: 'Google Cloud Run 운영 가이드',
          confidence: 0.95,
        },
      ],
      { batchSize: 10, onlyUnprocessed: true }
    );

    expect(result[0]?.materializedCount).toBe(1);
    expect(result[0]?.insertedCount).toBe(0);
    expect(result[0]?.updatedCount).toBe(1);
    expect(store.relationshipRows).toHaveLength(1);
    expect(store.relationshipRows[0]?.weight).toBeGreaterThan(0.4);
    expect(store.relationshipRows[0]?.bidirectional).toBe(true);
  });

  it('adds a title-anchor fallback when triplets do not point to a strong target', async () => {
    const store = createMockSupabaseClient([
      {
        id: 'kb-cpu-incident',
        title: 'CPU 사용량 급증 대응 가이드',
        category: 'incident',
        content: 'CPU 급증 장애는 사용자 지연과 타임아웃을 빠르게 유발한다. 캐시 전략 보완이 필요하다.',
        metadata: null,
      },
      {
        id: 'kb-cpu-guide',
        title: 'CPU 사용률 급증 원인 분석 및 대응 가이드',
        category: 'troubleshooting',
        content: 'CPU 스파이크 원인 분석, 캐시 전략 보완, 핫패스 최적화 순서를 설명한다.',
        metadata: { indexed_by: 'seed', triplets: [] },
      },
      {
        id: 'kb-network',
        title: '네트워크 지연 장애 대응',
        category: 'incident',
        content: '네트워크 지연과 패킷 손실 대응 절차를 정리한다.',
        metadata: { indexed_by: 'seed', triplets: [] },
      },
    ]);

    const result = await extractRelationshipsFromKnowledgeBase(
      store.client as never,
      async () => [
        {
          subject: 'CPU 급증 장애',
          predicate: '유발',
          object: '사용자 지연 및 타임아웃',
          confidence: 0.95,
        },
      ],
      { batchSize: 10, onlyUnprocessed: true }
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.materializedCount).toBe(1);
    expect(result[0]?.insertedCount).toBe(1);
    expect(store.relationshipRows).toHaveLength(1);
    expect(store.relationshipRows[0]?.target_id).toBe('kb-cpu-guide');
    expect(store.relationshipRows[0]?.metadata.extraction_source).toBe('title-anchor-fallback');
    expect(store.relationshipRows[0]?.bidirectional).toBe(true);
  });

  it('does not map generic content phrases to an unrelated target without title overlap', () => {
    const sourceEntry = {
      id: 'kb-storage-incident',
      title: 'Storage 서버 (storage-nas-01, storage-s3-gateway) 장애 대응',
      category: 'best_practice',
      content: '쓰기 부하가 큰 작업은 일시 중단하고 대응 절차를 순서대로 수행한다.',
      metadata: null,
    };
    const allEntries = [
      sourceEntry,
      {
        id: 'kb-docker',
        title: 'Docker 컨테이너 트러블슈팅',
        category: 'troubleshooting',
        content: '쓰기 부하가 큰 작업을 다루는 컨테이너 운영 대응 절차를 정리한다.',
        metadata: null,
      },
    ];

    const planned = planKnowledgeRelationships(sourceEntry, allEntries, [
      {
        subject: '쓰기 부하가 큰 작업',
        predicate: 'related to',
        object: '대응 절차',
        confidence: 0.8,
      },
    ]);

    expect(planned).toHaveLength(0);
  });

  it('reprocesses explicitly requested titles even when they are already indexed', async () => {
    const store = createMockSupabaseClient([
      {
        id: 'kb-cpu-incident',
        title: 'CPU 사용량 급증 대응 가이드',
        category: 'incident',
        content: 'CPU 급증 장애는 사용자 지연과 타임아웃을 빠르게 유발한다.',
        metadata: {
          indexed_by: 'llamaindex',
          triplets: [{ subject: 'old', predicate: 'old', object: 'old', confidence: 0.1 }],
        },
      },
      {
        id: 'kb-cpu-guide',
        title: 'CPU 사용률 급증 원인 분석 및 대응 가이드',
        category: 'troubleshooting',
        content: 'CPU 스파이크 원인 분석과 대응 순서를 설명한다.',
        metadata: { indexed_by: 'seed', triplets: [] },
      },
    ]);

    const extractTriplets = vi.fn(async () => [
      {
        subject: 'CPU 급증 장애',
        predicate: '유발',
        object: '사용자 지연',
        confidence: 0.92,
      },
    ]);

    const result = await extractRelationshipsFromKnowledgeBase(
      store.client as never,
      extractTriplets,
      {
        batchSize: 10,
        onlyUnprocessed: true,
        titles: ['CPU 사용량 급증 대응 가이드'],
      }
    );

    expect(extractTriplets).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect(result[0]?.materializedCount).toBe(1);
    expect(store.relationshipRows[0]?.target_id).toBe('kb-cpu-guide');
  });
});
