import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();
const getSupabaseConfigMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('./config-parser', () => ({
  getSupabaseConfig: getSupabaseConfigMock,
}));

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type QueryRow = {
  updated_at: string;
  metadata?: Record<string, unknown>;
  source_table?: string;
  target_table?: string;
};

function createMockSupabaseClient() {
  const knowledgeBaseRows: QueryRow[] = [
    {
      updated_at: '2026-04-12T14:39:12.265Z',
      metadata: {
        indexed_by: 'llamaindex',
        triplets: [
          { subject: 'a', predicate: 'b', object: 'c', confidence: 0.9 },
          { subject: 'd', predicate: 'e', object: 'f', confidence: 0.8 },
          { subject: 'g', predicate: 'h', object: 'i', confidence: 0.7 },
        ],
      },
    },
    {
      updated_at: '2026-04-12T13:00:00.000Z',
      metadata: { indexed_by: 'seed' },
    },
    {
      updated_at: '2026-04-12T13:30:00.000Z',
      metadata: {
        indexed_by: 'llamaindex',
        triplets: [
          { subject: 'j', predicate: 'k', object: 'l', confidence: 0.9 },
          { subject: 'm', predicate: 'n', object: 'o', confidence: 0.8 },
        ],
      },
    },
    {
      updated_at: '2026-04-12T15:00:00.000Z',
      metadata: {
        indexed_by: 'graphrag',
        triplets: [
          { subject: 'p', predicate: 'q', object: 'r', confidence: 0.9 },
          { subject: 's', predicate: 't', object: 'u', confidence: 0.8 },
          { subject: 'v', predicate: 'w', object: 'x', confidence: 0.7 },
          { subject: 'y', predicate: 'z', object: 'aa', confidence: 0.6 },
        ],
      },
    },
  ];
  const relationshipRows: QueryRow[] = [
    {
      updated_at: '2026-04-12T14:10:00.000Z',
      source_table: 'knowledge_base',
      target_table: 'knowledge_base',
      metadata: { extraction_source: 'llamaindex-triplets' },
    },
    {
      updated_at: '2026-04-12T14:00:00.000Z',
      source_table: 'knowledge_base',
      target_table: 'knowledge_base',
      metadata: { extraction_source: 'title-anchor-fallback' },
    },
    {
      updated_at: '2026-04-12T13:50:00.000Z',
      source_table: 'knowledge_base',
      target_table: 'knowledge_base',
      metadata: { extraction_source: 'seed-script' },
    },
  ];

  return {
    from(table: string) {
      return {
        select(columns: string, options?: { count?: string; head?: boolean }) {
          const eqFilters = new Map<string, unknown>();
          let orderColumn = '';
          let ascending = true;
          let limitValue: number | undefined;

          const orValues: string[][] = [];
          return {
            eq(column: string, value: unknown) {
              eqFilters.set(column, value);
              return this;
            },
            or(filter: string) {
              // Parse "metadata->>indexed_by.eq.v1,metadata->>indexed_by.eq.v2" pattern
              const values = filter.split(',').map((clause) => {
                const parts = clause.trim().split('.eq.');
                return parts[1] ?? '';
              });
              orValues.push(values);
              return this;
            },
            order(column: string, config: { ascending: boolean }) {
              orderColumn = column;
              ascending = config.ascending;
              return this;
            },
            limit(value: number) {
              limitValue = value;
              return this;
            },
            then(
              resolve: (value: {
                count?: number;
                data?: Array<{ updated_at: string }>;
                error: null;
              }) => void
            ) {
              if (options?.head) {
                resolve({
                  count: table === 'knowledge_base' ? 51 : 157,
                  error: null,
                });
                return;
              }

              let rows = table === 'knowledge_base'
                ? [...knowledgeBaseRows]
                : [...relationshipRows];

              rows = rows.filter((row) =>
                Array.from(eqFilters.entries()).every(([column, value]) => {
                  if (column === 'metadata->>indexed_by') {
                    return row.metadata?.indexed_by === value;
                  }
                  return (row as Record<string, unknown>)[column as keyof QueryRow] === value;
                })
              );

              // Apply OR filters (e.g. indexed_by IN ['llamaindex', 'graphrag'])
              for (const values of orValues) {
                rows = rows.filter((row) =>
                  values.some((v) => row.metadata?.indexed_by === v)
                );
              }

              if (orderColumn === 'updated_at') {
                rows.sort((left, right) => {
                  const delta =
                    new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime();
                  return ascending ? delta : -delta;
                });
              }

              if (typeof limitValue === 'number') {
                rows = rows.slice(0, limitValue);
              }

              const data = rows.map((row) => {
                if (columns === 'metadata') {
                  return { metadata: row.metadata };
                }
                if (columns === 'metadata, updated_at') {
                  return { metadata: row.metadata, updated_at: row.updated_at };
                }
                return { updated_at: row.updated_at };
              });

              resolve({
                data,
                error: null,
              });
            },
          };
        },
      };
    },
  };
}

describe('graphrag-service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getSupabaseConfigMock.mockReturnValue({
      url: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
    });
  });

  it('initializes lazily and reports the latest indexed timestamp', async () => {
    createClientMock.mockReturnValue(createMockSupabaseClient());

    const { getGraphRAGStats } = await import('./graphrag-service');
    const stats = await getGraphRAGStats();

    expect(createClientMock).toHaveBeenCalledOnce();
    expect(stats).toEqual({
      totalDocuments: 51,
      totalTriplets: 9, // llamaindex(3+2) + graphrag(4)
      totalExtractionEdges: 2,
      lastIndexed: '2026-04-12T15:00:00.000Z', // graphrag row is newest
    });
  });
});
